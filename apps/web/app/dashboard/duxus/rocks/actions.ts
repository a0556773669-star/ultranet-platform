"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import type { Firestore, WriteBatch } from "firebase-admin/firestore";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireModuleAccess } from "@/lib/perms";
import type {
  Quarter,
  QuarterStatus,
  Rock,
  RockStatus,
  Milestone,
  MilestoneStatus,
  MilestonePriority,
  MilestoneSource,
  MilestoneOrigin,
  PeriodAssignment,
  PeriodType,
  AssignmentOutcome,
  TaskActivity,
  TaskActivityAction,
  TaskEntityType,
  TaskSettings,
  RockReview,
  RockReviewPeriod,
} from "@ultranet/shared-types";
import { DEFAULT_TASK_SETTINGS } from "@ultranet/shared-types";
import {
  quarterLabel as gregorianQuarterLabel,
  quarterOrderValue,
  nextMonthKeyAfter,
  nextWeekKeyAfter,
  currentMonthKey,
} from "./date-utils";
import { assignmentId, isActiveMilestone } from "./task-status";

const QUARTERS = "n_quarters";
const ROCKS = "n_rocks";
const MILESTONES = "n_milestones";
const ASSIGNMENTS = "n_period_assignments";
const ACTIVITY = "n_task_activity";
const REVIEWS = "n_rock_reviews";
const SETTINGS = "n_task_settings";
const SETTINGS_DOC = "default";

/** רענון ברמת ה-layout של המודול כולו: סימון "הושלם" במסך השבוע חייב להופיע מיד
 *  גם בחודש, ברבעון ובהיסטוריה - בלי פעולה נוספת (קריטריון קבלה 1). */
const MODULE_PATH = "/dashboard/duxus";

const ARCHIVED_MESSAGE = "הרבעון נמצא בארכיון - לקריאה בלבד. כדי לשנות, יש להחזיר אותו לפעיל.";
const STALE_MESSAGE = "אבן הדרך עודכנה בינתיים על ידי משתמש אחר. יש לרענן את המסך ולנסות שוב.";

export type ActionResult = { ok: true } | { ok: false; message: string };
export type QuarterResult = { ok: true; quarterKey: string } | { ok: false; message: string };
export type PeriodResult = { ok: true; periodKey: string } | { ok: false; message: string };
export type CountResult = { ok: true; count: number } | { ok: false; message: string };

function revalidateModule() {
  revalidatePath(MODULE_PATH, "layout");
}

async function currentUserLabel(): Promise<string> {
  const session = await getServerSession(authOptions);
  return session?.user?.name ?? session?.user?.email ?? "";
}

// --- ממפי מסמכים ---

function toQuarter(id: string, data: Partial<Quarter> | undefined): Quarter {
  return {
    id,
    label: data?.label ?? gregorianQuarterLabel(id),
    status: data?.status ?? "active",
    startDate: data?.startDate ?? "",
    endDate: data?.endDate ?? "",
    order: data?.order ?? quarterOrderValue(id),
    activeMonthKey: data?.activeMonthKey ?? "",
    activeWeekKey: data?.activeWeekKey ?? "",
    rolledFromKey: data?.rolledFromKey ?? null,
    createdAt: data?.createdAt ?? 0,
    createdBy: data?.createdBy ?? "",
  };
}

function toRock(id: string, data: Partial<Rock> | undefined): Rock {
  return {
    id,
    title: data?.title ?? "",
    description: data?.description ?? "",
    quarterKey: data?.quarterKey ?? "",
    parentRockId: data?.parentRockId ?? null,
    ownerUserId: data?.ownerUserId ?? "",
    ownerName: data?.ownerName ?? "",
    status: data?.status ?? "active",
    dueDate: data?.dueDate ?? "",
    order: data?.order ?? 0,
    rolledFromId: data?.rolledFromId ?? null,
    deletedAt: data?.deletedAt ?? null,
    createdAt: data?.createdAt ?? 0,
    createdBy: data?.createdBy ?? "",
    updatedAt: data?.updatedAt ?? data?.createdAt ?? 0,
  };
}

/**
 * דאטה שנוצר לפני מודל הסטטוסים מכיל רק `done` בוליאני - הוא נגזר כאן ל-`status`
 * בזמן קריאה, בלי מיגרציה וכתיבה חוזרת ל-DB.
 */
function toMilestone(id: string, data: Partial<Milestone> | undefined): Milestone {
  const done = Boolean(data?.done);
  const status: MilestoneStatus = data?.status ?? (done ? "done" : "not_started");
  return {
    id,
    rockId: data?.rockId ?? "",
    quarterKey: data?.quarterKey ?? "",
    title: data?.title ?? "",
    description: data?.description ?? "",
    ownerUserId: data?.ownerUserId ?? "",
    ownerName: data?.ownerName ?? "",
    status,
    done: status === "done",
    priority: data?.priority ?? "normal",
    dueDate: data?.dueDate ?? "",
    notes: data?.notes ?? "",
    waitReason: data?.waitReason ?? "",
    waitUntil: data?.waitUntil ?? "",
    cancelReason: data?.cancelReason ?? "",
    doneAt: data?.doneAt ?? 0,
    completedBy: data?.completedBy ?? "",
    reopenCount: data?.reopenCount ?? 0,
    carryOverCount: data?.carryOverCount ?? 0,
    source: data?.source ?? "rock",
    origin: data?.origin ?? "quarter",
    rolledFromId: data?.rolledFromId ?? null,
    order: data?.order ?? 0,
    deletedAt: data?.deletedAt ?? null,
    createdAt: data?.createdAt ?? 0,
    createdBy: data?.createdBy ?? "",
    updatedAt: data?.updatedAt ?? data?.createdAt ?? 0,
    updatedBy: data?.updatedBy ?? "",
    stage: data?.stage,
    monthKey: data?.monthKey ?? "",
    weekKey: data?.weekKey ?? "",
  };
}

function toAssignment(id: string, data: Partial<PeriodAssignment> | undefined): PeriodAssignment {
  return {
    id,
    milestoneId: data?.milestoneId ?? "",
    quarterKey: data?.quarterKey ?? "",
    periodType: data?.periodType ?? "quarter",
    periodKey: data?.periodKey ?? "",
    assignedAt: data?.assignedAt ?? 0,
    assignedBy: data?.assignedBy ?? "",
    outcome: data?.outcome ?? "open",
    closedAt: data?.closedAt ?? 0,
  };
}

function toActivity(id: string, data: Partial<TaskActivity> | undefined): TaskActivity {
  return {
    id,
    entityType: data?.entityType ?? "milestone",
    entityId: data?.entityId ?? "",
    action: data?.action ?? "update",
    field: data?.field ?? "",
    oldValue: data?.oldValue ?? "",
    newValue: data?.newValue ?? "",
    milestoneId: data?.milestoneId ?? "",
    quarterKey: data?.quarterKey ?? "",
    note: data?.note ?? "",
    userName: data?.userName ?? "",
    at: data?.at ?? 0,
  };
}

function toReview(id: string, data: Partial<RockReview> | undefined): RockReview {
  return {
    id,
    period: data?.period ?? "quarterly",
    periodKey: data?.periodKey ?? "",
    notes: data?.notes ?? "",
    participants: data?.participants ?? [],
    meetingDate: data?.meetingDate ?? "",
    locked: data?.locked ?? false,
    createdAt: data?.createdAt ?? 0,
    updatedAt: data?.updatedAt ?? 0,
    createdBy: data?.createdBy ?? "",
  };
}

function toSettings(data: Partial<TaskSettings> | undefined): TaskSettings {
  return {
    id: SETTINGS_DOC,
    weekStartDay: data?.weekStartDay ?? DEFAULT_TASK_SETTINGS.weekStartDay,
    warningWeekday: data?.warningWeekday ?? DEFAULT_TASK_SETTINGS.warningWeekday,
    recommendedRocksPerQuarter: data?.recommendedRocksPerQuarter ?? DEFAULT_TASK_SETTINGS.recommendedRocksPerQuarter,
    updatedAt: data?.updatedAt ?? 0,
    updatedBy: data?.updatedBy ?? "",
  };
}

// --- יומן פעילות (סעיף 16) ---

type ActivityEntry = {
  entityType: TaskEntityType;
  entityId: string;
  action: TaskActivityAction;
  field?: string;
  oldValue?: string;
  newValue?: string;
  milestoneId?: string;
  quarterKey?: string;
  note?: string;
};

/**
 * רישום ליומן. כשמועבר `batch` הרישום נכנס לאותה טרנזקציה של השינוי עצמו, כך שלא
 * ייתכן מצב חלקי שבו הנתון השתנה אך הפעולה לא תועדה (סעיף 15).
 */
function logActivity(db: Firestore, batch: WriteBatch | null, userName: string, entry: ActivityEntry): Promise<void> {
  const ref = db.collection(ACTIVITY).doc();
  const payload = {
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    field: entry.field ?? "",
    oldValue: entry.oldValue ?? "",
    newValue: entry.newValue ?? "",
    milestoneId: entry.milestoneId ?? (entry.entityType === "milestone" ? entry.entityId : ""),
    quarterKey: entry.quarterKey ?? "",
    note: entry.note ?? "",
    userName,
    at: Date.now(),
  };
  if (batch) {
    batch.set(ref, payload);
    return Promise.resolve();
  }
  return ref.set(payload).then(() => undefined);
}

// --- שמירה על ארכיון: רבעון מאורכב הוא לקריאה בלבד ---

async function archivedQuarterKeys(db: Firestore): Promise<Set<string>> {
  const snap = await db.collection(QUARTERS).where("status", "==", "archived").get();
  return new Set(snap.docs.map((d) => d.id));
}

async function quarterWriteBlock(db: Firestore, quarterKey: string): Promise<string | null> {
  if (!quarterKey) return null;
  const archived = await archivedQuarterKeys(db);
  return archived.has(quarterKey) ? ARCHIVED_MESSAGE : null;
}

/**
 * חסימת כתיבה על אבן דרך. לא די בכך שרבעון הבית שלה מאורכב: אבן דרך שהתחייבנו
 * אליה מחדש ברבעון פעיל (שיוך-רבעון) חייבת להישאר ניתנת לעדכון גם אחרי שהרבעון
 * שבו נולדה הועבר לארכיון - אחרת כל מה שגולגל קדימה היה הופך לקריאה בלבד.
 */
async function milestoneIdsWriteBlock(db: Firestore, ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const archived = await archivedQuarterKeys(db);
  if (!archived.size) return null;

  const docs = await Promise.all(ids.map((id) => db.collection(MILESTONES).doc(id).get()));
  const homeArchived = docs.filter((d) => archived.has((d.data() as Partial<Milestone> | undefined)?.quarterKey ?? ""));
  if (!homeArchived.length) return null;

  const rescued = await Promise.all(
    homeArchived.map(async (d) => {
      const snap = await db
        .collection(ASSIGNMENTS)
        .where("milestoneId", "==", d.id)
        .where("periodType", "==", "quarter")
        .get();
      return snap.docs.some((a) => !archived.has((a.data() as Partial<PeriodAssignment>).periodKey ?? ""));
    })
  );
  return rescued.every(Boolean) ? null : ARCHIVED_MESSAGE;
}

/** אותה בדיקה עבור רשומה שכבר נקראה - בלי שליפה חוזרת של המסמך. */
async function milestoneWriteBlock(db: Firestore, milestone: Milestone): Promise<string | null> {
  return milestoneIdsWriteBlock(db, [milestone.id]);
}

async function rockWriteBlock(db: Firestore, rockId: string): Promise<string | null> {
  const snap = await db.collection(ROCKS).doc(rockId).get();
  if (!snap.exists) return "הסלע לא נמצא";
  return quarterWriteBlock(db, (snap.data() as Partial<Rock>).quarterKey ?? "");
}

// --- קריאה: הגדרות ---

export async function getTaskSettings(): Promise<TaskSettings> {
  await requireModuleAccess("duxus");
  const doc = await getAdminFirestore().collection(SETTINGS).doc(SETTINGS_DOC).get();
  return toSettings(doc.exists ? (doc.data() as Partial<TaskSettings>) : undefined);
}

export async function saveTaskSettingsAction(input: {
  weekStartDay: number;
  warningWeekday: number;
  recommendedRocksPerQuarter: number;
}): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const weekStartDay = Math.min(6, Math.max(0, Math.round(input.weekStartDay)));
  const warningWeekday = Math.min(6, Math.max(0, Math.round(input.warningWeekday)));
  const recommended = Math.min(10, Math.max(1, Math.round(input.recommendedRocksPerQuarter)));
  const updatedBy = await currentUserLabel();
  await getAdminFirestore()
    .collection(SETTINGS)
    .doc(SETTINGS_DOC)
    .set({ weekStartDay, warningWeekday, recommendedRocksPerQuarter: recommended, updatedAt: Date.now(), updatedBy }, { merge: true });
  revalidateModule();
  return { ok: true };
}

// --- קריאה: רבעונים ---

/**
 * כל הרבעונים, חדש→ישן. מפתחות רבעון ישנים שמופיעים על סלעים אך אין להם עדיין מסמך
 * מוחזרים כרבעון "וירטואלי" פעיל - בלי לכתוב ל-DB בזמן רינדור. המסמך בפועל נוצר
 * ברגע שמבצעים עליהם פעולה (`ensureQuarterDoc`).
 */
export async function listQuarters(): Promise<Quarter[]> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const [quartersSnap, rocksSnap] = await Promise.all([db.collection(QUARTERS).get(), db.collection(ROCKS).get()]);

  const byKey = new Map<string, Quarter>();
  quartersSnap.docs.forEach((d) => byKey.set(d.id, toQuarter(d.id, d.data() as Partial<Quarter>)));
  rocksSnap.docs.forEach((d) => {
    const key = (d.data() as Partial<Rock>).quarterKey ?? "";
    if (key && !byKey.has(key)) byKey.set(key, toQuarter(key, undefined));
  });

  return Array.from(byKey.values()).sort((a, b) => b.order - a.order || b.id.localeCompare(a.id));
}

export async function getQuarter(quarterKey: string): Promise<Quarter> {
  await requireModuleAccess("duxus");
  const doc = await getAdminFirestore().collection(QUARTERS).doc(quarterKey).get();
  return toQuarter(quarterKey, doc.exists ? (doc.data() as Partial<Quarter>) : undefined);
}

async function ensureQuarterDoc(db: Firestore, quarterKey: string): Promise<void> {
  const ref = db.collection(QUARTERS).doc(quarterKey);
  const snap = await ref.get();
  if (snap.exists) return;
  await ref.set({
    label: gregorianQuarterLabel(quarterKey),
    status: "active" satisfies QuarterStatus,
    startDate: "",
    endDate: "",
    order: quarterOrderValue(quarterKey),
    rolledFromKey: null,
    createdAt: Date.now(),
    createdBy: "",
  });
}

// --- קריאה: לוח הרבעון (שליפה מרוכזת אחת לכל המסכים) ---

export type QuarterBoard = {
  quarter: Quarter;
  /** הסלעים של הרבעון + סלעים מרבעון קודם שיש להם אבן דרך שהתחייבנו אליה כאן */
  rocks: Rock[];
  milestones: Milestone[];
  assignments: PeriodAssignment[];
  settings: TaskSettings;
  /** החודש/השבוע ה"פתוחים" אחרי גזירה מדאטה ישן */
  activeMonthKey: string;
  activeWeekKey: string;
};

/**
 * סינתזה של שיוכי תקופה לדאטה שקדם ל-`n_period_assignments`:
 *
 * 1. לכל אבן דרך שהרבעון הוא ביתה נוצר שיוך-רבעון משתמע (היא שייכת לרבעון דרך הסלע
 *    שלה, ואין טעם לכתוב על כך רשומה).
 * 2. `monthKey`/`weekKey` ישנים הופכים לשיוכי חודש/שבוע - כך שלוח ישן נראה בדיוק
 *    כפי שנראה קודם, בלי מיגרציה.
 *
 * שיוך שנכתב בפועל תמיד גובר על הסינתזה (אותו מזהה דטרמיניסטי).
 */
function synthesizeAssignments(quarterKey: string, milestones: Milestone[], stored: PeriodAssignment[]): PeriodAssignment[] {
  const byId = new Map(stored.map((a) => [a.id, a]));
  const add = (m: Milestone, periodType: PeriodType, periodKey: string) => {
    if (!periodKey) return;
    const id = assignmentId(m.id, periodType, periodKey);
    if (byId.has(id)) return;
    const outcome: AssignmentOutcome = m.status === "done" ? "done" : m.status === "cancelled" ? "cancelled" : "open";
    byId.set(id, {
      id,
      milestoneId: m.id,
      quarterKey,
      periodType,
      periodKey,
      assignedAt: m.createdAt,
      assignedBy: m.createdBy,
      outcome,
    });
  };
  milestones.forEach((m) => {
    if (m.quarterKey === quarterKey) add(m, "quarter", quarterKey);
    if (m.monthKey) add(m, "month", m.monthKey);
    if (m.weekKey) add(m, "week", m.weekKey);
  });
  return Array.from(byId.values());
}

async function fetchByIds<T>(db: Firestore, collection: string, ids: string[], map: (id: string, data: never) => T): Promise<T[]> {
  if (!ids.length) return [];
  const docs = await db.getAll(...ids.map((id) => db.collection(collection).doc(id)));
  return docs.filter((d) => d.exists).map((d) => map(d.id, d.data() as never));
}

/**
 * כל מה שדרוש למסכי השבוע/החודש/הרבעון בשליפה אחת: הסטטוסים וההתקדמות נגזרים אצל
 * כולם מאותם נתונים, ולכן אין סיכון ששני מסכים יראו מצב שונה (סעיף 15).
 */
export async function loadQuarterBoard(quarterKey: string): Promise<QuarterBoard> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();

  const [quarterDoc, rocksSnap, milestonesSnap, assignmentsSnap, settingsDoc] = await Promise.all([
    db.collection(QUARTERS).doc(quarterKey).get(),
    db.collection(ROCKS).where("quarterKey", "==", quarterKey).get(),
    db.collection(MILESTONES).where("quarterKey", "==", quarterKey).get(),
    db.collection(ASSIGNMENTS).where("quarterKey", "==", quarterKey).get(),
    db.collection(SETTINGS).doc(SETTINGS_DOC).get(),
  ]);

  const quarter = toQuarter(quarterKey, quarterDoc.exists ? (quarterDoc.data() as Partial<Quarter>) : undefined);
  const ownRocks = rocksSnap.docs.map((d) => toRock(d.id, d.data() as Partial<Rock>)).filter((r) => !r.deletedAt);
  const ownMilestones = milestonesSnap.docs.map((d) => toMilestone(d.id, d.data() as Partial<Milestone>)).filter((m) => !m.deletedAt);
  const stored = assignmentsSnap.docs.map((d) => toAssignment(d.id, d.data() as Partial<PeriodAssignment>));

  // אבני דרך מרבעון קודם שהתחייבנו אליהן כאן - אותה רשומה, שיוך נוסף (סעיף 8).
  const ownIds = new Set(ownMilestones.map((m) => m.id));
  const foreignIds = Array.from(new Set(stored.map((a) => a.milestoneId).filter((id) => id && !ownIds.has(id))));
  const foreignMilestones = (await fetchByIds(db, MILESTONES, foreignIds, toMilestone)).filter((m) => !m.deletedAt);

  // הסלעים של אבני הדרך הזרות, כולל סלע-האב, כדי שהן יוצגו בהיררכיה המלאה ולא כיתומות.
  const ownRockIds = new Set(ownRocks.map((r) => r.id));
  const missingRockIds = Array.from(
    new Set(foreignMilestones.map((m) => m.rockId).filter((id) => id && !ownRockIds.has(id)))
  );
  const foreignRocks = (await fetchByIds(db, ROCKS, missingRockIds, toRock)).filter((r) => !r.deletedAt);
  const parentIds = Array.from(
    new Set(foreignRocks.map((r) => r.parentRockId ?? "").filter((id) => id && !ownRockIds.has(id) && !missingRockIds.includes(id)))
  );
  const parentRocks = (await fetchByIds(db, ROCKS, parentIds, toRock)).filter((r) => !r.deletedAt);

  const milestones = [...ownMilestones, ...foreignMilestones].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt
  );
  const rocks = [...ownRocks, ...foreignRocks, ...parentRocks].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt
  );
  const assignments = synthesizeAssignments(quarterKey, milestones, stored);

  // רבעונים שנוצרו לפני שדות ה"תקופה הפתוחה" נופלים לתקופה המאוחרת ביותר שיש לה שיוך.
  const latestOf = (type: PeriodType, cmp: (a: string, b: string) => number) =>
    assignments
      .filter((a) => a.periodType === type)
      .map((a) => a.periodKey)
      .sort(cmp)
      .pop() ?? "";

  const activeMonthKey = quarter.activeMonthKey || latestOf("month", (a, b) => a.localeCompare(b));
  const activeWeekKey = quarter.activeWeekKey || latestOf("week", (a, b) => Number(a.slice(1)) - Number(b.slice(1)));

  return {
    quarter,
    rocks,
    milestones,
    assignments,
    settings: toSettings(settingsDoc.exists ? (settingsDoc.data() as Partial<TaskSettings>) : undefined),
    activeMonthKey,
    activeWeekKey,
  };
}

// --- קריאה: יומן פעילות ---

export async function listMilestoneActivity(milestoneId: string): Promise<TaskActivity[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(ACTIVITY).where("milestoneId", "==", milestoneId).get();
  return snap.docs.map((d) => toActivity(d.id, d.data() as Partial<TaskActivity>)).sort((a, b) => b.at - a.at);
}

export async function listQuarterActivity(quarterKey: string, limit = 300): Promise<TaskActivity[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(ACTIVITY).where("quarterKey", "==", quarterKey).get();
  return snap.docs
    .map((d) => toActivity(d.id, d.data() as Partial<TaskActivity>))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit);
}

// --- קריאה: סיכומי ישיבות ---

export async function getReview(period: RockReviewPeriod, periodKey: string): Promise<RockReview | null> {
  await requireModuleAccess("duxus");
  const doc = await getAdminFirestore().collection(REVIEWS).doc(`${period}_${periodKey}`).get();
  if (!doc.exists) return null;
  return toReview(doc.id, doc.data() as Partial<RockReview>);
}

export async function listReviews(period: RockReviewPeriod): Promise<RockReview[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(REVIEWS).where("period", "==", period).get();
  return snap.docs
    .map((d) => toReview(d.id, d.data() as Partial<RockReview>))
    .filter((r) => r.notes.trim().length > 0 || (r.participants?.length ?? 0) > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// --- קריאה: היסטוריה חוצת-רבעונים ---

export type HistoryData = {
  quarters: Quarter[];
  rocks: Rock[];
  milestones: Milestone[];
  assignments: PeriodAssignment[];
  reviews: RockReview[];
};

/** כל הדאטה של המודול - מסך ההיסטוריה מסנן אותו בצד הלקוח (תקופה/סלע/אחראי/סטטוס/מקור). */
export async function loadHistory(): Promise<HistoryData> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const [quarters, rocksSnap, milestonesSnap, assignmentsSnap, reviewsSnap] = await Promise.all([
    listQuarters(),
    db.collection(ROCKS).get(),
    db.collection(MILESTONES).get(),
    db.collection(ASSIGNMENTS).get(),
    db.collection(REVIEWS).get(),
  ]);

  const rocks = rocksSnap.docs.map((d) => toRock(d.id, d.data() as Partial<Rock>)).filter((r) => !r.deletedAt);
  const milestones = milestonesSnap.docs.map((d) => toMilestone(d.id, d.data() as Partial<Milestone>)).filter((m) => !m.deletedAt);
  const stored = assignmentsSnap.docs.map((d) => toAssignment(d.id, d.data() as Partial<PeriodAssignment>));

  // אותה סינתזה כמו בלוח, רבעון-רבעון, כדי שדאטה ישן ייראה בהיסטוריה בדיוק כמו חדש.
  const byQuarter = new Map<string, Milestone[]>();
  milestones.forEach((m) => byQuarter.set(m.quarterKey, [...(byQuarter.get(m.quarterKey) ?? []), m]));
  const assignments = Array.from(byQuarter.entries()).flatMap(([key, list]) =>
    synthesizeAssignments(
      key,
      list,
      stored.filter((a) => a.quarterKey === key)
    )
  );
  const storedElsewhere = stored.filter((a) => !byQuarter.has(a.quarterKey));

  return {
    quarters,
    rocks,
    milestones,
    assignments: [...assignments, ...storedElsewhere],
    reviews: reviewsSnap.docs.map((d) => toReview(d.id, d.data() as Partial<RockReview>)),
  };
}

// --- כתיבה: רבעונים ---

export async function createQuarterAction(input: { label: string; startDate?: string; endDate?: string }): Promise<QuarterResult> {
  await requireModuleAccess("duxus");
  const label = input.label.trim();
  if (!label) return { ok: false, message: "יש להזין שם לרבעון" };
  const createdBy = await currentUserLabel();
  const db = getAdminFirestore();
  const now = Date.now();
  const quarterKey = `q${now.toString(36)}`;
  await db.collection(QUARTERS).doc(quarterKey).set({
    label,
    status: "active" satisfies QuarterStatus,
    startDate: input.startDate?.trim() ?? "",
    endDate: input.endDate?.trim() ?? "",
    order: now,
    rolledFromKey: null,
    createdAt: now,
    createdBy,
  });
  await logActivity(db, null, createdBy, { entityType: "quarter", entityId: quarterKey, action: "create", quarterKey, newValue: label });
  revalidateModule();
  return { ok: true, quarterKey };
}

export async function updateQuarterAction(
  quarterKey: string,
  input: { label: string; startDate?: string; endDate?: string }
): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const label = input.label.trim();
  if (!label) return { ok: false, message: "יש להזין שם לרבעון" };
  const db = getAdminFirestore();
  const blocked = await quarterWriteBlock(db, quarterKey);
  if (blocked) return { ok: false, message: blocked };
  await ensureQuarterDoc(db, quarterKey);
  const before = toQuarter(quarterKey, (await db.collection(QUARTERS).doc(quarterKey).get()).data() as Partial<Quarter>);
  const startDate = input.startDate?.trim() ?? "";
  const endDate = input.endDate?.trim() ?? "";
  await db.collection(QUARTERS).doc(quarterKey).set({ label, startDate, endDate }, { merge: true });

  const user = await currentUserLabel();
  if (before.label !== label) {
    await logActivity(db, null, user, { entityType: "quarter", entityId: quarterKey, action: "update", field: "שם", oldValue: before.label, newValue: label, quarterKey });
  }
  // שינוי תאריכי תקופה לא מוחק שיוכים קיימים (סעיף 14) - רק נרשם ביומן.
  if ((before.startDate ?? "") !== startDate || (before.endDate ?? "") !== endDate) {
    await logActivity(db, null, user, {
      entityType: "quarter",
      entityId: quarterKey,
      action: "update",
      field: "תאריכים",
      oldValue: `${before.startDate ?? ""} - ${before.endDate ?? ""}`,
      newValue: `${startDate} - ${endDate}`,
      quarterKey,
    });
  }
  revalidateModule();
  return { ok: true };
}

/** ארכוב/פתיחה מחדש של רבעון - פעולה מפורשת שנרשמת ביומן (סעיף 14). */
export async function setQuarterStatusAction(quarterKey: string, status: QuarterStatus): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  await ensureQuarterDoc(db, quarterKey);
  await db.collection(QUARTERS).doc(quarterKey).set({ status }, { merge: true });
  await logActivity(db, null, await currentUserLabel(), {
    entityType: "quarter",
    entityId: quarterKey,
    action: status === "archived" ? "delete" : "restore",
    field: "מצב",
    newValue: status === "archived" ? "ארכיון" : "פעיל",
    quarterKey,
  });
  revalidateModule();
  return { ok: true };
}

/**
 * נועלת את תוצאות ההתחייבות של תקופה שנסגרת: מה שלא הושלם נשאר מתועד כ"לא הושלם"
 * גם אם המשימה תושלם אחר כך בתקופה אחרת (סעיף 8) - זו האמת ההיסטורית.
 */
async function closePeriodOutcomes(db: Firestore, quarterKey: string, periodType: PeriodType, periodKey: string): Promise<void> {
  if (!periodKey) return;
  const snap = await db
    .collection(ASSIGNMENTS)
    .where("quarterKey", "==", quarterKey)
    .where("periodType", "==", periodType)
    .where("periodKey", "==", periodKey)
    .get();
  const open = snap.docs.filter((d) => ((d.data() as Partial<PeriodAssignment>).outcome ?? "open") === "open");
  if (!open.length) return;

  const milestones = await fetchByIds(
    db,
    MILESTONES,
    open.map((d) => (d.data() as Partial<PeriodAssignment>).milestoneId ?? "").filter(Boolean),
    toMilestone
  );
  const statusById = new Map(milestones.map((m) => [m.id, m.status]));

  const batch = db.batch();
  const now = Date.now();
  open.forEach((d) => {
    const milestoneId = (d.data() as Partial<PeriodAssignment>).milestoneId ?? "";
    const status = statusById.get(milestoneId);
    const outcome: AssignmentOutcome = status === "done" ? "done" : status === "cancelled" ? "cancelled" : "missed";
    batch.set(d.ref, { outcome, closedAt: now }, { merge: true });
  });
  await batch.commit();
}

export async function openNextMonthAction(quarterKey: string, fromKey = ""): Promise<PeriodResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await quarterWriteBlock(db, quarterKey);
  if (blocked) return { ok: false, message: blocked };
  await ensureQuarterDoc(db, quarterKey);
  await closePeriodOutcomes(db, quarterKey, "month", fromKey);
  const activeMonthKey = nextMonthKeyAfter(fromKey);
  await db.collection(QUARTERS).doc(quarterKey).set({ activeMonthKey }, { merge: true });
  revalidateModule();
  return { ok: true, periodKey: activeMonthKey };
}

export async function openNextWeekAction(quarterKey: string, fromKey = "", monthKey = ""): Promise<PeriodResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await quarterWriteBlock(db, quarterKey);
  if (blocked) return { ok: false, message: blocked };
  await ensureQuarterDoc(db, quarterKey);
  await closePeriodOutcomes(db, quarterKey, "week", fromKey);
  const activeWeekKey = nextWeekKeyAfter(fromKey);
  const update: Record<string, unknown> = { activeWeekKey };
  if (!monthKey) update.activeMonthKey = currentMonthKey();
  await db.collection(QUARTERS).doc(quarterKey).set(update, { merge: true });
  revalidateModule();
  return { ok: true, periodKey: activeWeekKey };
}

// --- כתיבה: סלעים ותתי-סלעים ---

export async function createRockAction(input: {
  title: string;
  description?: string;
  quarterKey: string;
  parentRockId?: string | null;
  ownerName?: string;
  dueDate?: string;
}): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const title = input.title.trim();
  if (!title) return { ok: false, message: "יש להזין כותרת לסלע" };
  if (!input.quarterKey) return { ok: false, message: "חסר רבעון" };
  const db = getAdminFirestore();
  const blocked = await quarterWriteBlock(db, input.quarterKey);
  if (blocked) return { ok: false, message: blocked };
  const createdBy = await currentUserLabel();
  const now = Date.now();
  const ref = db.collection(ROCKS).doc();
  const batch = db.batch();
  batch.set(ref, {
    title,
    description: input.description?.trim() ?? "",
    quarterKey: input.quarterKey,
    parentRockId: input.parentRockId ?? null,
    ownerUserId: "",
    ownerName: input.ownerName?.trim() ?? "",
    status: "active" satisfies RockStatus,
    dueDate: input.dueDate?.trim() ?? "",
    order: now,
    rolledFromId: null,
    deletedAt: null,
    createdAt: now,
    createdBy,
    updatedAt: now,
  });
  logActivity(db, batch, createdBy, {
    entityType: "rock",
    entityId: ref.id,
    action: "create",
    newValue: title,
    quarterKey: input.quarterKey,
    note: input.parentRockId ? "תת-סלע" : "סלע",
  });
  await batch.commit();
  revalidateModule();
  return { ok: true };
}

export async function updateRockAction(
  id: string,
  input: { title?: string; description?: string; ownerName?: string; dueDate?: string }
): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await rockWriteBlock(db, id);
  if (blocked) return { ok: false, message: blocked };
  const ref = db.collection(ROCKS).doc(id);
  const before = toRock(id, (await ref.get()).data() as Partial<Rock>);

  const next: Partial<Rock> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { ok: false, message: "יש להזין כותרת לסלע" };
    next.title = title;
  }
  if (input.description !== undefined) next.description = input.description.trim();
  if (input.ownerName !== undefined) next.ownerName = input.ownerName.trim();
  if (input.dueDate !== undefined) next.dueDate = input.dueDate.trim();

  const user = await currentUserLabel();
  const batch = db.batch();
  batch.set(ref, { ...next, updatedAt: Date.now() }, { merge: true });
  const labels: Record<string, string> = { title: "כותרת", description: "תיאור", ownerName: "אחראי", dueDate: "תאריך יעד" };
  (Object.keys(next) as (keyof Rock)[]).forEach((key) => {
    const oldValue = String(before[key] ?? "");
    const newValue = String(next[key] ?? "");
    if (oldValue === newValue) return;
    logActivity(db, batch, user, {
      entityType: "rock",
      entityId: id,
      action: "update",
      field: labels[key as string] ?? String(key),
      oldValue,
      newValue,
      quarterKey: before.quarterKey,
    });
  });
  await batch.commit();
  revalidateModule();
  return { ok: true };
}

/**
 * ביטול/החזרה של סלע. **אין** סימון ידני של "הושלם" - זה מחושב מאבני הדרך (סעיף 19);
 * הפעולה הידנית היחידה היא ביטול סלע שהוחלט לא לבצע.
 */
export async function setRockDroppedAction(id: string, dropped: boolean, reason = ""): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await rockWriteBlock(db, id);
  if (blocked) return { ok: false, message: blocked };
  if (dropped && !reason.trim()) return { ok: false, message: "יש להזין סיבת ביטול" };

  const ref = db.collection(ROCKS).doc(id);
  const before = toRock(id, (await ref.get()).data() as Partial<Rock>);
  const user = await currentUserLabel();
  const batch = db.batch();
  batch.set(ref, { status: dropped ? "dropped" : "active", updatedAt: Date.now() }, { merge: true });
  logActivity(db, batch, user, {
    entityType: "rock",
    entityId: id,
    action: dropped ? "cancel" : "restore",
    field: "מצב",
    oldValue: before.status,
    newValue: dropped ? "dropped" : "active",
    note: reason.trim(),
    quarterKey: before.quarterKey,
  });
  await batch.commit();
  if (!dropped) await recomputeRockCompletion(db, id);
  revalidateModule();
  return { ok: true };
}

async function collectRockSubtree(db: Firestore, rockId: string): Promise<string[]> {
  const subs = await db.collection(ROCKS).where("parentRockId", "==", rockId).get();
  const nested = await Promise.all(subs.docs.map((d) => collectRockSubtree(db, d.id)));
  return [rockId, ...nested.flat()];
}

/**
 * מחיקת סלע. סלע שיש לו ילדים או אבני דרך **אינו נמחק פיזית** (סעיף 14) אלא מאורכב
 * במחיקה לוגית, כדי לא לפגוע בהיסטוריה; סלע ריק לגמרי נמחק באמת.
 */
export async function deleteRockAction(id: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await rockWriteBlock(db, id);
  if (blocked) return { ok: false, message: blocked };

  const ref = db.collection(ROCKS).doc(id);
  const before = toRock(id, (await ref.get()).data() as Partial<Rock>);
  const subtree = await collectRockSubtree(db, id);
  const milestoneGroups = await Promise.all(subtree.map((rid) => db.collection(MILESTONES).where("rockId", "==", rid).get()));
  const milestoneDocs = milestoneGroups.flatMap((g) => g.docs);
  const user = await currentUserLabel();
  const now = Date.now();
  const batch = db.batch();

  if (subtree.length === 1 && milestoneDocs.length === 0) {
    batch.delete(ref);
    logActivity(db, batch, user, { entityType: "rock", entityId: id, action: "delete", oldValue: before.title, quarterKey: before.quarterKey });
  } else {
    // ארכוב מדורג: הסלע, תתי-הסלעים ואבני הדרך יורדים מהלוח אך נשארים בהיסטוריה.
    subtree.forEach((rid) => batch.set(db.collection(ROCKS).doc(rid), { deletedAt: now, updatedAt: now }, { merge: true }));
    milestoneDocs.forEach((d) => batch.set(d.ref, { deletedAt: now, updatedAt: now }, { merge: true }));
    logActivity(db, batch, user, {
      entityType: "rock",
      entityId: id,
      action: "delete",
      oldValue: before.title,
      note: `ארכוב לוגי · ${subtree.length - 1} תתי-סלעים · ${milestoneDocs.length} אבני דרך`,
      quarterKey: before.quarterKey,
    });
  }
  await batch.commit();
  revalidateModule();
  return { ok: true };
}

// --- כתיבה: אבני דרך ---

/**
 * מסנכרנת את מצב הסלע עם אבני הדרך שלו (סעיף 6): כל הפעילות (ללא מבוטלות) הושלמו
 * וקיימת לפחות אחת → `done`; נוספה אבן דרך חדשה או נפתחה אחת מחדש → חזרה ל-`active`.
 * סלע שסומן ידנית `dropped` לא נגרר אחרי החישוב. החישוב מטפס גם לסלע-האב.
 */
async function recomputeRockCompletion(db: Firestore, rockId: string): Promise<void> {
  if (!rockId) return;
  const rockSnap = await db.collection(ROCKS).doc(rockId).get();
  if (!rockSnap.exists) return;
  const rock = toRock(rockSnap.id, rockSnap.data() as Partial<Rock>);
  if (rock.status === "dropped") return;

  const subRocksSnap = await db.collection(ROCKS).where("parentRockId", "==", rockId).get();
  const rockIds = [rockId, ...subRocksSnap.docs.filter((d) => !(d.data() as Partial<Rock>).deletedAt).map((d) => d.id)];
  const groups = await Promise.all(rockIds.map((id) => db.collection(MILESTONES).where("rockId", "==", id).get()));
  const milestones = groups
    .flatMap((g) => g.docs.map((d) => toMilestone(d.id, d.data() as Partial<Milestone>)))
    .filter((m) => !m.deletedAt);

  const active = milestones.filter(isActiveMilestone);
  const allDone = active.length > 0 && active.every((m) => m.status === "done");
  const nextStatus: RockStatus = allDone ? "done" : "active";
  if (nextStatus !== rock.status) {
    await db.collection(ROCKS).doc(rockId).set({ status: nextStatus, updatedAt: Date.now() }, { merge: true });
  }
  if (rock.parentRockId) await recomputeRockCompletion(db, rock.parentRockId);
}

export async function createMilestoneAction(input: {
  rockId: string;
  quarterKey: string;
  title: string;
  description?: string;
  ownerName?: string;
  dueDate?: string;
  priority?: MilestonePriority;
  source?: MilestoneSource;
  origin?: MilestoneOrigin;
  /** שיוך מיידי לתקופות שבהן נוצרה (למשל "נוסף במהלך השבוע") */
  assignTo?: { periodType: PeriodType; periodKey: string }[];
}): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const title = input.title.trim();
  if (!title) return { ok: false, message: "יש להזין כותרת לאבן דרך" };
  const source: MilestoneSource = input.source ?? "rock";
  // אבן דרך שנוספה בשבוע/חודש בלי שיוך קודם חייבת תת-סלע (סעיף 8).
  if (source === "rock" && !input.rockId) return { ok: false, message: "יש לבחור סלע או תת-סלע לאבן הדרך" };

  const db = getAdminFirestore();
  const blocked = await quarterWriteBlock(db, input.quarterKey);
  if (blocked) return { ok: false, message: blocked };

  const assignTo = input.assignTo ?? [];
  // לפני שיבוץ לשבוע חייבים אחראי (סעיף 14).
  if (assignTo.some((a) => a.periodType === "week") && !input.ownerName?.trim()) {
    return { ok: false, message: "לפני שיבוץ לשבוע יש לבחור אחראי לאבן הדרך" };
  }

  const createdBy = await currentUserLabel();
  const now = Date.now();
  const origin: MilestoneOrigin = input.origin ?? "quarter";
  const ref = db.collection(MILESTONES).doc();
  const batch = db.batch();

  batch.set(ref, {
    rockId: source === "adhoc" ? "" : input.rockId,
    quarterKey: input.quarterKey,
    title,
    description: input.description?.trim() ?? "",
    ownerUserId: "",
    ownerName: input.ownerName?.trim() ?? "",
    status: "not_started" satisfies MilestoneStatus,
    done: false,
    priority: input.priority ?? "normal",
    dueDate: input.dueDate?.trim() ?? "",
    notes: "",
    waitReason: "",
    waitUntil: "",
    cancelReason: "",
    reopenCount: 0,
    carryOverCount: 0,
    source,
    origin,
    rolledFromId: null,
    order: now,
    deletedAt: null,
    createdAt: now,
    createdBy,
    updatedAt: now,
    updatedBy: createdBy,
  });
  logActivity(db, batch, createdBy, {
    entityType: "milestone",
    entityId: ref.id,
    action: "create",
    newValue: title,
    quarterKey: input.quarterKey,
    note: origin === "quarter" ? "נוצרה בתכנון הרבעון" : origin === "month" ? "נוספה במהלך החודש" : "נוספה במהלך השבוע",
  });

  assignTo.forEach(({ periodType, periodKey }) => {
    if (!periodKey) return;
    const id = assignmentId(ref.id, periodType, periodKey);
    batch.set(db.collection(ASSIGNMENTS).doc(id), {
      milestoneId: ref.id,
      quarterKey: input.quarterKey,
      periodType,
      periodKey,
      assignedAt: now,
      assignedBy: createdBy,
      outcome: "open" satisfies AssignmentOutcome,
    });
    logActivity(db, batch, createdBy, {
      entityType: "milestone",
      entityId: ref.id,
      action: "assign",
      field: periodType,
      newValue: periodKey,
      quarterKey: input.quarterKey,
    });
  });

  await batch.commit();
  // הוספת אבן דרך לתת-סלע שהושלם פותחת אותו מחדש (סעיף 6, קריטריון קבלה 6).
  if (source === "rock") await recomputeRockCompletion(db, input.rockId);
  revalidateModule();
  return { ok: true };
}

const FIELD_LABELS: Record<string, string> = {
  title: "כותרת",
  description: "תיאור",
  ownerName: "אחראי",
  dueDate: "תאריך יעד",
  priority: "עדיפות",
  notes: "הערה",
  waitReason: "סיבת המתנה",
  waitUntil: "תאריך מעקב",
  rockId: "שיוך לתת-סלע",
};

/**
 * עריכת אבן דרך מחלונית הצד. `expectedUpdatedAt` הוא נעילה אופטימית: אם משתמש אחר
 * שמר בינתיים, העדכון נדחה עם בקשת רענון במקום דריסה שקטה (סעיף 14).
 */
export async function updateMilestoneAction(
  id: string,
  input: {
    title?: string;
    description?: string;
    ownerName?: string;
    dueDate?: string;
    priority?: MilestonePriority;
    notes?: string;
    waitReason?: string;
    waitUntil?: string;
    /** העברה לתת-סלע אחר - מותרת ונרשמת ביומן (סעיף 10) */
    rockId?: string;
  },
  expectedUpdatedAt?: number
): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const ref = db.collection(MILESTONES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "אבן הדרך לא נמצאה" };
  const before = toMilestone(id, snap.data() as Partial<Milestone>);

  const blocked = await milestoneWriteBlock(db, before);
  if (blocked) return { ok: false, message: blocked };
  if (expectedUpdatedAt !== undefined && (before.updatedAt ?? 0) > expectedUpdatedAt) {
    return { ok: false, message: STALE_MESSAGE };
  }

  const next: Record<string, string> = {};
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return { ok: false, message: "יש להזין כותרת לאבן הדרך" };
    next.title = title;
  }
  if (input.description !== undefined) next.description = input.description.trim();
  if (input.ownerName !== undefined) next.ownerName = input.ownerName.trim();
  if (input.dueDate !== undefined) next.dueDate = input.dueDate.trim();
  if (input.priority !== undefined) next.priority = input.priority;
  if (input.notes !== undefined) next.notes = input.notes.trim();
  if (input.waitReason !== undefined) next.waitReason = input.waitReason.trim();
  if (input.waitUntil !== undefined) next.waitUntil = input.waitUntil.trim();
  if (input.rockId !== undefined && input.rockId !== before.rockId) next.rockId = input.rockId;

  const user = await currentUserLabel();
  const now = Date.now();
  const batch = db.batch();
  batch.set(ref, { ...next, updatedAt: now, updatedBy: user }, { merge: true });
  Object.keys(next).forEach((key) => {
    const oldValue = String((before as unknown as Record<string, unknown>)[key] ?? "");
    const newValue = String(next[key] ?? "");
    if (oldValue === newValue) return;
    logActivity(db, batch, user, {
      entityType: "milestone",
      entityId: id,
      action: key === "rockId" ? "move" : "update",
      field: FIELD_LABELS[key] ?? key,
      oldValue,
      newValue,
      quarterKey: before.quarterKey,
    });
  });
  await batch.commit();

  // מעבר בין תתי-סלעים מחייב חישוב מחדש בשני הצדדים.
  if (next.rockId !== undefined) {
    await recomputeRockCompletion(db, before.rockId);
    await recomputeRockCompletion(db, next.rockId);
  }
  revalidateModule();
  return { ok: true };
}

/**
 * שינוי סטטוס אבן דרך - הפעולה המרכזית של המודול. הסטטוס נשמר **פעם אחת**, ולכן
 * סימון במסך השבוע מתעדכן מיד גם בחודש וברבעון (קריטריון קבלה 1).
 *
 * כללי הוולידציה של סעיף 6: המתנה מחייבת הערה, ביטול מחייב סיבה, ופתיחה מחדש של
 * משימה שהושלמה היא פעולה מפורשת (`reopenMilestoneAction`) ולא לחיצה חוזרת.
 */
export async function setMilestoneStatusAction(
  id: string,
  status: MilestoneStatus,
  input: { reason?: string; waitUntil?: string } = {}
): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const ref = db.collection(MILESTONES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "אבן הדרך לא נמצאה" };
  const before = toMilestone(id, snap.data() as Partial<Milestone>);

  const blocked = await milestoneWriteBlock(db, before);
  if (blocked) return { ok: false, message: blocked };

  const reason = input.reason?.trim() ?? "";
  if (status === "waiting" && !reason) return { ok: false, message: "בסטטוס \"ממתין לגורם אחר\" חובה להזין הערה" };
  if (status === "cancelled" && !reason) return { ok: false, message: "יש להזין סיבת ביטול" };
  if (before.status === "done" && status !== "done") {
    return { ok: false, message: "אבן דרך שהושלמה נפתחת מחדש בפעולה מפורשת בלבד" };
  }
  if (before.status === status) return { ok: true };

  const user = await currentUserLabel();
  const now = Date.now();
  const patch: Record<string, unknown> = {
    status,
    done: status === "done",
    updatedAt: now,
    updatedBy: user,
  };
  if (status === "done") {
    patch.doneAt = now;
    patch.completedBy = user;
  }
  if (status === "waiting") {
    patch.waitReason = reason;
    patch.waitUntil = input.waitUntil?.trim() ?? "";
  }
  if (status === "cancelled") patch.cancelReason = reason;

  const batch = db.batch();
  batch.set(ref, patch, { merge: true });
  logActivity(db, batch, user, {
    entityType: "milestone",
    entityId: id,
    action: status === "done" ? "complete" : status === "cancelled" ? "cancel" : "status",
    field: "סטטוס",
    oldValue: before.status,
    newValue: status,
    note: reason,
    quarterKey: before.quarterKey,
  });
  await batch.commit();

  if (before.rockId) await recomputeRockCompletion(db, before.rockId);
  revalidateModule();
  return { ok: true };
}

/** השלמה בלחיצה אחת - אין אישור כפול בגרסה הראשונה (סעיף 19). */
export async function completeMilestoneAction(id: string): Promise<ActionResult> {
  return setMilestoneStatusAction(id, "done");
}

/**
 * פתיחה מחדש: פעולה מפורשת עם סיבה. תאריך ההשלמה הקודם יורד מהרשומה אך **נשאר ביומן**
 * (סעיף 6), כך שההיסטוריה ממשיכה להראות שהמשימה הושלמה ואז נפתחה.
 */
export async function reopenMilestoneAction(id: string, reason: string, status: MilestoneStatus = "in_progress"): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  if (status !== "in_progress" && status !== "not_started") return { ok: false, message: "פתיחה מחדש מחזירה לסטטוס בביצוע או טרם התחיל" };
  const db = getAdminFirestore();
  const ref = db.collection(MILESTONES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "אבן הדרך לא נמצאה" };
  const before = toMilestone(id, snap.data() as Partial<Milestone>);
  const blocked = await milestoneWriteBlock(db, before);
  if (blocked) return { ok: false, message: blocked };
  if (before.status !== "done" && before.status !== "cancelled") return { ok: false, message: "אבן הדרך אינה במצב שדורש פתיחה מחדש" };

  const user = await currentUserLabel();
  const now = Date.now();
  const batch = db.batch();
  batch.set(
    ref,
    {
      status,
      done: false,
      doneAt: 0,
      completedBy: "",
      cancelReason: "",
      reopenCount: (before.reopenCount ?? 0) + 1,
      updatedAt: now,
      updatedBy: user,
    },
    { merge: true }
  );
  logActivity(db, batch, user, {
    entityType: "milestone",
    entityId: id,
    action: "reopen",
    field: "סטטוס",
    oldValue: before.status,
    newValue: status,
    note: reason.trim() || (before.doneAt ? `הושלמה ב-${new Date(before.doneAt).toLocaleDateString("he-IL")}` : ""),
    quarterKey: before.quarterKey,
  });
  await batch.commit();
  if (before.rockId) await recomputeRockCompletion(db, before.rockId);
  revalidateModule();
  return { ok: true };
}

/**
 * מחיקה. אבן דרך שיש לה שיוך לתקופה או היסטוריה אינה נמחקת פיזית (סעיף 10) אלא
 * במחיקה לוגית; אבן דרך טרייה בלי שום שיוך נמחקת באמת.
 */
export async function deleteMilestoneAction(id: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await milestoneIdsWriteBlock(db, [id]);
  if (blocked) return { ok: false, message: blocked };
  const ref = db.collection(MILESTONES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: true };
  const before = toMilestone(id, snap.data() as Partial<Milestone>);
  const assignments = await db.collection(ASSIGNMENTS).where("milestoneId", "==", id).get();
  const user = await currentUserLabel();
  const batch = db.batch();

  if (assignments.empty && before.status === "not_started") {
    batch.delete(ref);
  } else {
    batch.set(ref, { deletedAt: Date.now(), updatedAt: Date.now(), updatedBy: user }, { merge: true });
  }
  logActivity(db, batch, user, {
    entityType: "milestone",
    entityId: id,
    action: "delete",
    oldValue: before.title,
    note: assignments.empty ? "" : "מחיקה לוגית - נשמרת בהיסטוריה",
    quarterKey: before.quarterKey,
  });
  await batch.commit();
  if (before.rockId) await recomputeRockCompletion(db, before.rockId);
  revalidateModule();
  return { ok: true };
}

// --- כתיבה: שיוכי תקופה (ההתחייבות לחודש/שבוע) ---

/**
 * שיוך מרוכז של אבני דרך לתקופה - הפעולה של מצב הישיבה (סעיף 7.4): עשרות שורות,
 * אישור אחד, **בלי שכפול רשומות**. מזהה השיוך דטרמיניסטי, ולכן שיוך כפול לאותה
 * תקופה נחסם ברמת בסיס הנתונים ולא רק בממשק (קריטריון קבלה 2).
 *
 * אבן דרך שכבר הייתה משויכת לתקופה קודמת מאותו סוג ולא הושלמה נספרת כהתחייבות
 * מחודשת (`carryOverCount`) - כך רואים מה נדחה שוב ושוב.
 */
export async function assignMilestonesAction(
  ids: string[],
  periodType: PeriodType,
  periodKey: string,
  quarterKey: string
): Promise<CountResult> {
  await requireModuleAccess("duxus");
  if (!ids.length) return { ok: false, message: "לא נבחרו אבני דרך" };
  if (!periodKey) return { ok: false, message: "לא נבחרה תקופה" };
  const db = getAdminFirestore();
  const blocked = await quarterWriteBlock(db, quarterKey);
  if (blocked) return { ok: false, message: blocked };

  const milestones = await fetchByIds(db, MILESTONES, ids, toMilestone);
  const open = milestones.filter((m) => !m.deletedAt && m.status !== "done" && m.status !== "cancelled");
  // לפני שיבוץ לשבוע חייבים אחראי (סעיף 14).
  if (periodType === "week") {
    const missing = open.filter((m) => !m.ownerName?.trim());
    if (missing.length) {
      return {
        ok: false,
        message: `לפני שיבוץ לשבוע יש לבחור אחראי: ${missing.slice(0, 3).map((m) => m.title).join(", ")}${missing.length > 3 ? "..." : ""}`,
      };
    }
  }

  const existing = await db
    .collection(ASSIGNMENTS)
    .where("quarterKey", "==", quarterKey)
    .where("periodType", "==", periodType)
    .get();
  const existingKeys = new Map<string, string[]>();
  existing.docs.forEach((d) => {
    const a = toAssignment(d.id, d.data() as Partial<PeriodAssignment>);
    existingKeys.set(a.milestoneId, [...(existingKeys.get(a.milestoneId) ?? []), a.periodKey]);
  });

  const user = await currentUserLabel();
  const now = Date.now();
  const batch = db.batch();
  let count = 0;

  open.forEach((m) => {
    const keys = existingKeys.get(m.id) ?? [];
    // אבן דרך שכבר משויכת לתקופה הזו מדולגת בשקט - בממשק היא ממילא מסומנת ומנוטרלת.
    if (keys.includes(periodKey)) return;
    const id = assignmentId(m.id, periodType, periodKey);
    batch.set(db.collection(ASSIGNMENTS).doc(id), {
      milestoneId: m.id,
      quarterKey,
      periodType,
      periodKey,
      assignedAt: now,
      assignedBy: user,
      outcome: "open" satisfies AssignmentOutcome,
    });
    if (keys.length > 0) {
      batch.set(db.collection(MILESTONES).doc(m.id), { carryOverCount: (m.carryOverCount ?? 0) + 1 }, { merge: true });
    }
    logActivity(db, batch, user, {
      entityType: "milestone",
      entityId: m.id,
      action: "assign",
      field: periodType,
      newValue: periodKey,
      note: keys.length > 0 ? "התחייבות מחודשת" : "",
      quarterKey,
    });
    count += 1;
  });

  await batch.commit();
  revalidateModule();
  return { ok: true, count };
}

/**
 * הסרת התחייבות מתקופה **פתוחה** בלבד. שיוך שתוצאתו כבר ננעלה הוא אירוע עבר ואין
 * למחוק אותו (סעיף 16).
 */
export async function unassignMilestoneAction(
  milestoneId: string,
  periodType: PeriodType,
  periodKey: string,
  reason = ""
): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await milestoneIdsWriteBlock(db, [milestoneId]);
  if (blocked) return { ok: false, message: blocked };

  const ref = db.collection(ASSIGNMENTS).doc(assignmentId(milestoneId, periodType, periodKey));
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "השיוך כבר לא קיים" };
  const assignment = toAssignment(snap.id, snap.data() as Partial<PeriodAssignment>);
  if (assignment.outcome !== "open") return { ok: false, message: "לא ניתן להסיר התחייבות של תקופה שכבר נסגרה" };

  const user = await currentUserLabel();
  const batch = db.batch();
  batch.delete(ref);
  logActivity(db, batch, user, {
    entityType: "milestone",
    entityId: milestoneId,
    action: "unassign",
    field: periodType,
    oldValue: periodKey,
    note: reason.trim(),
    quarterKey: assignment.quarterKey,
  });
  await batch.commit();
  revalidateModule();
  return { ok: true };
}

// --- כתיבה: פתיחת רבעון חדש ---

/**
 * פותחת רבעון חדש ומתחייבת מחדש למה שנבחר מהרבעון הקודם.
 *
 * **אין שכפול** (סעיף 19): אבן הדרך נשארת אותה רשומה אחת עם אותה היסטוריה, ומקבלת
 * שיוך נוסף לרבעון החדש. הסלע שלה נגרר איתה לתצוגה, ולכן היא מגיעה בהיררכיה
 * המלאה ולא כמשימה יתומה.
 */
export async function rolloverQuarterAction(input: {
  fromQuarterKey: string;
  label: string;
  startDate?: string;
  endDate?: string;
  milestoneIds: string[];
  archiveSource?: boolean;
}): Promise<QuarterResult> {
  await requireModuleAccess("duxus");
  const label = input.label.trim();
  if (!label) return { ok: false, message: "יש להזין שם לרבעון החדש" };

  const db = getAdminFirestore();
  const createdBy = await currentUserLabel();
  const now = Date.now();
  const newQuarterKey = `q${now.toString(36)}`;

  const milestones = (await fetchByIds(db, MILESTONES, input.milestoneIds, toMilestone)).filter(
    (m) => !m.deletedAt && m.status !== "done" && m.status !== "cancelled"
  );

  const batch = db.batch();
  batch.set(db.collection(QUARTERS).doc(newQuarterKey), {
    label,
    status: "active" satisfies QuarterStatus,
    startDate: input.startDate?.trim() ?? "",
    endDate: input.endDate?.trim() ?? "",
    order: now,
    rolledFromKey: input.fromQuarterKey,
    createdAt: now,
    createdBy,
  });
  logActivity(db, batch, createdBy, {
    entityType: "quarter",
    entityId: newQuarterKey,
    action: "create",
    newValue: label,
    note: input.fromQuarterKey ? `נפתח מתוך ${input.fromQuarterKey}` : "",
    quarterKey: newQuarterKey,
  });

  milestones.forEach((m) => {
    const id = assignmentId(m.id, "quarter", newQuarterKey);
    batch.set(db.collection(ASSIGNMENTS).doc(id), {
      milestoneId: m.id,
      quarterKey: newQuarterKey,
      periodType: "quarter" satisfies PeriodType,
      periodKey: newQuarterKey,
      assignedAt: now,
      assignedBy: createdBy,
      outcome: "open" satisfies AssignmentOutcome,
    });
    batch.set(db.collection(MILESTONES).doc(m.id), { carryOverCount: (m.carryOverCount ?? 0) + 1 }, { merge: true });
    logActivity(db, batch, createdBy, {
      entityType: "milestone",
      entityId: m.id,
      action: "assign",
      field: "quarter",
      newValue: newQuarterKey,
      note: "התחייבות מחודשת ברבעון חדש",
      quarterKey: newQuarterKey,
    });
  });

  await batch.commit();

  if (input.fromQuarterKey) {
    await closePeriodOutcomes(db, input.fromQuarterKey, "quarter", input.fromQuarterKey);
    if (input.archiveSource !== false) {
      await ensureQuarterDoc(db, input.fromQuarterKey);
      await db.collection(QUARTERS).doc(input.fromQuarterKey).set({ status: "archived" }, { merge: true });
    }
  }

  revalidateModule();
  return { ok: true, quarterKey: newQuarterKey };
}

// --- כתיבה: סיכומי ישיבות ---

export async function saveReviewAction(
  period: RockReviewPeriod,
  periodKey: string,
  input: { notes: string; participants?: string[]; meetingDate?: string; locked?: boolean }
): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const createdBy = await currentUserLabel();
  const db = getAdminFirestore();
  if (period === "quarterly") {
    const blocked = await quarterWriteBlock(db, periodKey);
    if (blocked) return { ok: false, message: blocked };
  }
  const ref = db.collection(REVIEWS).doc(`${period}_${periodKey}`);
  const existing = toReview(ref.id, (await ref.get()).data() as Partial<RockReview> | undefined);
  if (existing.locked && input.locked !== false) return { ok: false, message: "הישיבה נעולה. כדי לערוך יש לפתוח אותה מחדש." };

  await ref.set(
    {
      period,
      periodKey,
      notes: input.notes,
      participants: input.participants ?? existing.participants ?? [],
      meetingDate: input.meetingDate ?? existing.meetingDate ?? "",
      locked: input.locked ?? false,
      createdAt: existing.createdAt || Date.now(),
      updatedAt: Date.now(),
      createdBy: existing.createdBy || createdBy,
    },
    { merge: true }
  );
  revalidateModule();
  return { ok: true };
}
