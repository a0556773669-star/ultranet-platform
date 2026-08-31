"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import type { Firestore } from "firebase-admin/firestore";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireModuleAccess } from "@/lib/perms";
import type {
  Quarter,
  QuarterStatus,
  Rock,
  RockStatus,
  Milestone,
  MilestoneStage,
  MilestoneSource,
  RockReview,
  RockReviewPeriod,
} from "@ultranet/shared-types";
import {
  quarterLabel as gregorianQuarterLabel,
  quarterOrderValue,
  nextMonthKeyAfter,
  nextWeekKeyAfter,
  currentMonthKey,
} from "./date-utils";

const QUARTERS = "n_quarters";
const ROCKS = "n_rocks";
const MILESTONES = "n_milestones";
const REVIEWS = "n_rock_reviews";
const ROCKS_PATH = "/dashboard/duxus/rocks";

const ARCHIVED_MESSAGE = "הרבעון נמצא בארכיון - לקריאה בלבד. כדי לשנות, יש להחזיר אותו לפעיל.";

export type ActionResult = { ok: true } | { ok: false; message: string };
export type RolloverResult = { ok: true; quarterKey: string } | { ok: false; message: string };

async function currentUserLabel(): Promise<string> {
  const session = await getServerSession(authOptions);
  return session?.user?.name ?? session?.user?.email ?? "";
}

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
    order: data?.order ?? 0,
    rolledFromId: data?.rolledFromId ?? null,
    createdAt: data?.createdAt ?? 0,
    createdBy: data?.createdBy ?? "",
  };
}

function toMilestone(id: string, data: Partial<Milestone> | undefined): Milestone {
  return {
    id,
    rockId: data?.rockId ?? "",
    quarterKey: data?.quarterKey ?? "",
    title: data?.title ?? "",
    ownerUserId: data?.ownerUserId ?? "",
    ownerName: data?.ownerName ?? "",
    stage: data?.stage ?? "backlog",
    monthKey: data?.monthKey,
    weekKey: data?.weekKey,
    done: data?.done ?? false,
    doneAt: data?.doneAt,
    carryOverCount: data?.carryOverCount ?? 0,
    // דאטה שנוצר לפני מודל המשימות השוטפות נשאר "נגזר מסלע".
    source: data?.source ?? "rock",
    rolledFromId: data?.rolledFromId ?? null,
    order: data?.order ?? 0,
    createdAt: data?.createdAt ?? 0,
    createdBy: data?.createdBy ?? "",
  };
}

function toReview(id: string, data: Partial<RockReview> | undefined): RockReview {
  return {
    id,
    period: data?.period ?? "quarterly",
    periodKey: data?.periodKey ?? "",
    notes: data?.notes ?? "",
    createdAt: data?.createdAt ?? 0,
    updatedAt: data?.updatedAt ?? 0,
    createdBy: data?.createdBy ?? "",
  };
}

// --- שמירה על ארכיון: רבעון מאורכב הוא לקריאה בלבד ---

/** כל מפתחות הרבעונים שנמצאים בארכיון - שאילתה אחת קטנה שמשרתת את כל בדיקות הכתיבה. */
async function archivedQuarterKeys(db: Firestore): Promise<Set<string>> {
  const snap = await db.collection(QUARTERS).where("status", "==", "archived").get();
  return new Set(snap.docs.map((d) => d.id));
}

/** מחזירה הודעת שגיאה אם הרבעון בארכיון, או null אם מותר לכתוב. */
async function quarterWriteBlock(db: Firestore, quarterKey: string): Promise<string | null> {
  if (!quarterKey) return null;
  const archived = await archivedQuarterKeys(db);
  return archived.has(quarterKey) ? ARCHIVED_MESSAGE : null;
}

/** בדיקת ארכיון לרשימת אבני דרך - קוראת את המסמכים כדי לדעת לאיזה רבעון הן שייכות. */
async function milestonesWriteBlock(db: Firestore, ids: string[]): Promise<string | null> {
  if (!ids.length) return null;
  const archived = await archivedQuarterKeys(db);
  if (!archived.size) return null;
  const docs = await Promise.all(ids.map((id) => db.collection(MILESTONES).doc(id).get()));
  const blocked = docs.some((d) => {
    const key = (d.data() as Partial<Milestone> | undefined)?.quarterKey ?? "";
    return archived.has(key);
  });
  return blocked ? ARCHIVED_MESSAGE : null;
}

async function rockWriteBlock(db: Firestore, rockId: string): Promise<string | null> {
  const snap = await db.collection(ROCKS).doc(rockId).get();
  if (!snap.exists) return "הסלע לא נמצא";
  const key = (snap.data() as Partial<Rock>).quarterKey ?? "";
  return quarterWriteBlock(db, key);
}

// --- קריאה: רבעונים ---

/**
 * כל הרבעונים, חדש→ישן. רבעונים שיש להם מסמך ב-`n_quarters` מוחזרים כמות שהם;
 * מפתחות רבעון ישנים שמופיעים על סלעים אך אין להם עדיין מסמך (הדאטה שקדם למודל
 * הרבעונים) מוחזרים כרבעון "וירטואלי" פעיל עם תווית לועזית - בלי לכתוב ל-DB בזמן
 * רינדור. המסמך בפועל נוצר ברגע שמבצעים עליו פעולה (`ensureQuarterDoc`).
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

/** הרבעון שאליו נכנסים כברירת מחדל: הפעיל החדש ביותר, ואם אין - הרבעון הלועזי הנוכחי. */
export async function defaultQuarterKey(fallback: string): Promise<string> {
  const quarters = await listQuarters();
  const active = quarters.filter((q) => q.status === "active");
  return active[0]?.id ?? quarters[0]?.id ?? fallback;
}

/** יוצרת מסמך רבעון אם עדיין אין (ולא נוגעת בו אם יש) - כדי שפעולות ארכוב/שינוי שם יעבדו גם על מפתחות ישנים. */
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

// --- קריאה: סלעים / אבני דרך / סיכומים ---

export async function getRocksForQuarter(quarterKey: string): Promise<Rock[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(ROCKS).where("quarterKey", "==", quarterKey).get();
  return snap.docs
    .map((d) => toRock(d.id, d.data() as Partial<Rock>))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
}

export async function getMilestonesForQuarter(quarterKey: string): Promise<Milestone[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(MILESTONES).where("quarterKey", "==", quarterKey).get();
  return snap.docs
    .map((d) => toMilestone(d.id, d.data() as Partial<Milestone>))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
}

export async function getMilestonesByMonthKey(monthKey: string): Promise<Milestone[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(MILESTONES).where("monthKey", "==", monthKey).get();
  return snap.docs
    .map((d) => toMilestone(d.id, d.data() as Partial<Milestone>))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
}

export async function getMilestonesByWeekKey(weekKey: string): Promise<Milestone[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(MILESTONES).where("weekKey", "==", weekKey).get();
  return snap.docs
    .map((d) => toMilestone(d.id, d.data() as Partial<Milestone>))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
}

export async function getMilestonesByStage(stage: MilestoneStage): Promise<Milestone[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(MILESTONES).where("stage", "==", stage).get();
  return snap.docs.map((d) => toMilestone(d.id, d.data() as Partial<Milestone>));
}

export async function getDoneMilestones(): Promise<Milestone[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(MILESTONES).where("done", "==", true).get();
  return snap.docs
    .map((d) => toMilestone(d.id, d.data() as Partial<Milestone>))
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
}

export async function getAllRocks(): Promise<Rock[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(ROCKS).get();
  return snap.docs.map((d) => toRock(d.id, d.data() as Partial<Rock>));
}

export async function getReview(period: RockReviewPeriod, periodKey: string): Promise<RockReview | null> {
  await requireModuleAccess("duxus");
  const doc = await getAdminFirestore()
    .collection(REVIEWS)
    .doc(`${period}_${periodKey}`)
    .get();
  if (!doc.exists) return null;
  return toReview(doc.id, doc.data() as Partial<RockReview>);
}

export async function listReviews(period: RockReviewPeriod): Promise<RockReview[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(REVIEWS).where("period", "==", period).get();
  return snap.docs
    .map((d) => toReview(d.id, d.data() as Partial<RockReview>))
    .filter((r) => r.notes.trim().length > 0)
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
}

// --- כתיבה: רבעונים ---

export async function createQuarterAction(input: {
  label: string;
  startDate?: string;
  endDate?: string;
}): Promise<RolloverResult> {
  await requireModuleAccess("duxus");
  const label = input.label.trim();
  if (!label) return { ok: false, message: "יש להזין שם לרבעון" };
  const createdBy = await currentUserLabel();
  const now = Date.now();
  const quarterKey = `q${now.toString(36)}`;
  await getAdminFirestore()
    .collection(QUARTERS)
    .doc(quarterKey)
    .set({
      label,
      status: "active" satisfies QuarterStatus,
      startDate: input.startDate?.trim() ?? "",
      endDate: input.endDate?.trim() ?? "",
      order: now,
      rolledFromKey: null,
      createdAt: now,
      createdBy,
    });
  revalidatePath(ROCKS_PATH, "layout");
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
  await db
    .collection(QUARTERS)
    .doc(quarterKey)
    .set({ label, startDate: input.startDate?.trim() ?? "", endDate: input.endDate?.trim() ?? "" }, { merge: true });
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

export async function setQuarterStatusAction(quarterKey: string, status: QuarterStatus): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  await ensureQuarterDoc(db, quarterKey);
  await db.collection(QUARTERS).doc(quarterKey).set({ status }, { merge: true });
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

export type PeriodResult = { ok: true; periodKey: string } | { ok: false; message: string };

/**
 * פותחת את החודש הבא ברבעון. החודש הקודם לא נמחק ולא ננעל - הוא פשוט יורד מקומת
 * החודש ל"חודשים קודמים", ואבני הדרך שלו ממשיכות להופיע ברמת החודש/רבעון כל עוד
 * הרבעון פעיל.
 *
 * `fromKey` הוא החודש הפתוח כפי שהלקוח רואה אותו - כולל הגזירה מהדאטה לרבעונים
 * ישנים שאין להם עדיין `activeMonthKey` שמור.
 */
export async function openNextMonthAction(quarterKey: string, fromKey = ""): Promise<PeriodResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await quarterWriteBlock(db, quarterKey);
  if (blocked) return { ok: false, message: blocked };
  await ensureQuarterDoc(db, quarterKey);
  const activeMonthKey = nextMonthKeyAfter(fromKey);
  await db.collection(QUARTERS).doc(quarterKey).set({ activeMonthKey }, { merge: true });
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true, periodKey: activeMonthKey };
}

/**
 * פותחת את השבוע הבא ברבעון, ושולחת את השבוע הקודם ל"שבועות קודמים". אם עוד לא
 * נפתח חודש ברבעון - נפתח גם חודש, כי שבוע תמיד יושב בתוך חודש.
 */
export async function openNextWeekAction(quarterKey: string, fromKey = "", monthKey = ""): Promise<PeriodResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await quarterWriteBlock(db, quarterKey);
  if (blocked) return { ok: false, message: blocked };
  await ensureQuarterDoc(db, quarterKey);
  const activeWeekKey = nextWeekKeyAfter(fromKey);
  const update: Record<string, unknown> = { activeWeekKey };
  if (!monthKey) update.activeMonthKey = currentMonthKey();
  await db.collection(QUARTERS).doc(quarterKey).set(update, { merge: true });
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true, periodKey: activeWeekKey };
}

// --- כתיבה: סלעים ---

export async function createRockAction(input: {
  title: string;
  description?: string;
  quarterKey: string;
  parentRockId?: string | null;
  ownerUserId?: string;
  ownerName?: string;
}): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const title = input.title.trim();
  if (!title) return { ok: false, message: "יש להזין כותרת לסלע" };
  if (!input.quarterKey) return { ok: false, message: "חסר רבעון" };
  const db = getAdminFirestore();
  const blocked = await quarterWriteBlock(db, input.quarterKey);
  if (blocked) return { ok: false, message: blocked };
  const createdBy = await currentUserLabel();
  await db.collection(ROCKS).add({
    title,
    description: input.description?.trim() ?? "",
    quarterKey: input.quarterKey,
    parentRockId: input.parentRockId ?? null,
    ownerUserId: input.ownerUserId ?? "",
    ownerName: input.ownerName ?? "",
    status: "active" satisfies RockStatus,
    order: Date.now(),
    rolledFromId: null,
    createdAt: Date.now(),
    createdBy,
  });
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

export async function updateRockStatusAction(id: string, status: RockStatus): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await rockWriteBlock(db, id);
  if (blocked) return { ok: false, message: blocked };
  await db.collection(ROCKS).doc(id).set({ status }, { merge: true });
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

async function cascadeDeleteRock(db: Firestore, rockId: string): Promise<void> {
  const subRocksSnap = await db.collection(ROCKS).where("parentRockId", "==", rockId).get();
  for (const sub of subRocksSnap.docs) {
    await cascadeDeleteRock(db, sub.id);
  }
  const milestonesSnap = await db.collection(MILESTONES).where("rockId", "==", rockId).get();
  const batch = db.batch();
  milestonesSnap.docs.forEach((m) => batch.delete(m.ref));
  batch.delete(db.collection(ROCKS).doc(rockId));
  await batch.commit();
}

export async function deleteRockAction(id: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await rockWriteBlock(db, id);
  if (blocked) return { ok: false, message: blocked };
  await cascadeDeleteRock(db, id);
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

// --- כתיבה: אבני דרך ---

/**
 * יוצרת אבן דרך. ברירת המחדל היא stage="backlog" (כמו ביצירה מטאב רבעון); אם
 * מעבירים stage="month"/"week" (יצירה ישירה מטאב חודשי/שבועי) יש לצרף גם את
 * monthKey/weekKey המתאימים כדי שהיא תופיע מיד בדלי הנכון.
 *
 * `source: "adhoc"` (משימה שבועית/שוטפת) נוצרת בלי `rockId` - היא שייכת לרבעון/חודש/שבוע
 * בלבד ולא מוצגת בעץ הסלעים אלא בקטע המשימות השוטפות.
 */
export async function createMilestoneAction(input: {
  rockId: string;
  quarterKey: string;
  title: string;
  ownerUserId?: string;
  ownerName?: string;
  stage?: MilestoneStage;
  monthKey?: string;
  weekKey?: string;
  source?: MilestoneSource;
}): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const title = input.title.trim();
  if (!title) return { ok: false, message: "יש להזין כותרת לאבן דרך" };
  const source: MilestoneSource = input.source ?? "rock";
  if (source === "rock" && !input.rockId) return { ok: false, message: "חסר סלע לאבן הדרך" };
  const db = getAdminFirestore();
  const blocked = await quarterWriteBlock(db, input.quarterKey);
  if (blocked) return { ok: false, message: blocked };
  const createdBy = await currentUserLabel();
  const stage: MilestoneStage = input.stage ?? "backlog";
  const data: Record<string, unknown> = {
    rockId: source === "adhoc" ? "" : input.rockId,
    quarterKey: input.quarterKey,
    title,
    ownerUserId: input.ownerUserId ?? "",
    ownerName: input.ownerName ?? "",
    stage,
    done: false,
    carryOverCount: 0,
    source,
    rolledFromId: null,
    order: Date.now(),
    createdAt: Date.now(),
    createdBy,
  };
  if (stage === "month" || stage === "week") data.monthKey = input.monthKey;
  if (stage === "week") data.weekKey = input.weekKey;
  await db.collection(MILESTONES).add(data);
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

export async function deleteMilestoneAction(id: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await milestonesWriteBlock(db, [id]);
  if (blocked) return { ok: false, message: blocked };
  const snap = await db.collection(MILESTONES).doc(id).get();
  const rockId = (snap.data() as Partial<Milestone> | undefined)?.rockId ?? "";
  await db.collection(MILESTONES).doc(id).delete();
  if (rockId) await recomputeRockCompletion(db, rockId);
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

export async function promoteMilestonesToMonthAction(ids: string[], monthKey: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  if (!ids.length) return { ok: false, message: "לא נבחרו אבני דרך" };
  const db = getAdminFirestore();
  const blocked = await milestonesWriteBlock(db, ids);
  if (blocked) return { ok: false, message: blocked };
  const batch = db.batch();
  ids.forEach((id) => {
    batch.set(db.collection(MILESTONES).doc(id), { stage: "month", monthKey }, { merge: true });
  });
  await batch.commit();
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

export async function promoteMilestonesToWeekAction(ids: string[], weekKey: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  if (!ids.length) return { ok: false, message: "לא נבחרו אבני דרך" };
  const db = getAdminFirestore();
  const blocked = await milestonesWriteBlock(db, ids);
  if (blocked) return { ok: false, message: blocked };
  const batch = db.batch();
  ids.forEach((id) => {
    batch.set(db.collection(MILESTONES).doc(id), { stage: "week", weekKey }, { merge: true });
  });
  await batch.commit();
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

/** "משהו לא הושלם - להעביר קדימה?" - שינוי דלי + הגדלת מונה ההעברות. */
export async function carryOverMilestoneToMonthAction(id: string, monthKey: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await milestonesWriteBlock(db, [id]);
  if (blocked) return { ok: false, message: blocked };
  const ref = db.collection(MILESTONES).doc(id);
  const snap = await ref.get();
  const current = (snap.data() as Partial<Milestone> | undefined)?.carryOverCount ?? 0;
  await ref.set({ stage: "month", monthKey, carryOverCount: current + 1 }, { merge: true });
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

export async function carryOverMilestoneToWeekAction(id: string, weekKey: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const blocked = await milestonesWriteBlock(db, [id]);
  if (blocked) return { ok: false, message: blocked };
  const ref = db.collection(MILESTONES).doc(id);
  const snap = await ref.get();
  const current = (snap.data() as Partial<Milestone> | undefined)?.carryOverCount ?? 0;
  await ref.set({ stage: "week", weekKey, carryOverCount: current + 1 }, { merge: true });
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

/**
 * מסנכרנת את סטטוס הסלע עם אבני הדרך שלו: כשכל אבני הדרך שלו ושל תתי-הסלעים שלו
 * סומנו כבוצעו - הסלע עובר אוטומטית ל-`done`; אם אבן דרך נפתחה מחדש והסלע היה
 * `done` - הוא חוזר ל-`active`. סלע שסומן ידנית `dropped` לא נגרר אחרי החישוב.
 * הפעולה מטפסת גם לסלע-האב, כך שתת-סלע שהושלם מעדכן את הסלע שמעליו.
 */
async function recomputeRockCompletion(db: Firestore, rockId: string): Promise<void> {
  const rockSnap = await db.collection(ROCKS).doc(rockId).get();
  if (!rockSnap.exists) return;
  const rock = toRock(rockSnap.id, rockSnap.data() as Partial<Rock>);
  if (rock.status === "dropped") return;

  const subRocksSnap = await db.collection(ROCKS).where("parentRockId", "==", rockId).get();
  const rockIds = [rockId, ...subRocksSnap.docs.map((d) => d.id)];
  const milestoneGroups = await Promise.all(
    rockIds.map((id) => db.collection(MILESTONES).where("rockId", "==", id).get())
  );
  const milestones = milestoneGroups.flatMap((g) => g.docs.map((d) => toMilestone(d.id, d.data() as Partial<Milestone>)));

  const allDone = milestones.length > 0 && milestones.every((m) => m.done);
  const nextStatus: RockStatus = allDone ? "done" : "active";
  if (nextStatus !== rock.status) {
    await db.collection(ROCKS).doc(rockId).set({ status: nextStatus }, { merge: true });
  }

  if (rock.parentRockId) await recomputeRockCompletion(db, rock.parentRockId);
}

export async function toggleMilestoneDoneAction(id: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const db = getAdminFirestore();
  const ref = db.collection(MILESTONES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "אבן הדרך לא נמצאה" };
  const data = snap.data() as Partial<Milestone>;
  const blocked = await quarterWriteBlock(db, data.quarterKey ?? "");
  if (blocked) return { ok: false, message: blocked };
  const done = Boolean(data.done);
  await ref.set({ done: !done, doneAt: !done ? Date.now() : null }, { merge: true });
  if (data.rockId) await recomputeRockCompletion(db, data.rockId);
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}

// --- כתיבה: פתיחת רבעון חדש וגלגול מה שלא הושלם ---

/** אוסף סלע + כל אבותיו, כדי שאבן דרך שנבחרה תגיע לרבעון החדש עם ההקשר המלא ולא כמשימה יתומה. */
function collectWithAncestors(rockId: string, rocksById: Map<string, Rock>, into: Set<string>): void {
  let cursor: string | null | undefined = rockId;
  while (cursor && rocksById.has(cursor) && !into.has(cursor)) {
    into.add(cursor);
    cursor = rocksById.get(cursor)?.parentRockId ?? null;
  }
}

/**
 * פותחת רבעון חדש ומגלגלת אליו את מה שנבחר מהרבעון הקודם.
 *
 * - כל סלע/תת-סלע/אבן דרך שנבחרו משוכפלים כרשומות חדשות ברבעון החדש, עם
 *   `rolledFromId` שמצביע על המקור (הרבעון הישן נשאר שלם להיסטוריה).
 * - אבן דרך שנבחרה גוררת אוטומטית את הסלע ותת-הסלע שמעליה, כך שההיררכיה
 *   סלע ➔ תת-סלע ➔ אבן דרך נשמרת ולא נוצרת משימה יתומה.
 * - אבני הדרך המגולגלות חוזרות ל-`backlog` (בלי חודש/שבוע), לא מסומנות כבוצעו,
 *   ו-`carryOverCount` גדל ב-1 כדי שרואים כמה פעמים משהו נדחה.
 * - הרבעון המקורי עובר ל-`archived` (קריאה בלבד) אלא אם ביקשו אחרת.
 */
export async function rolloverQuarterAction(input: {
  fromQuarterKey: string;
  label: string;
  startDate?: string;
  endDate?: string;
  rockIds: string[];
  milestoneIds: string[];
  archiveSource?: boolean;
}): Promise<RolloverResult> {
  await requireModuleAccess("duxus");
  const label = input.label.trim();
  if (!label) return { ok: false, message: "יש להזין שם לרבעון החדש" };

  const db = getAdminFirestore();
  const createdBy = await currentUserLabel();
  const now = Date.now();
  const newQuarterKey = `q${now.toString(36)}`;

  const [rocksSnap, milestonesSnap] = await Promise.all([
    db.collection(ROCKS).where("quarterKey", "==", input.fromQuarterKey).get(),
    db.collection(MILESTONES).where("quarterKey", "==", input.fromQuarterKey).get(),
  ]);
  const rocks = rocksSnap.docs.map((d) => toRock(d.id, d.data() as Partial<Rock>));
  const milestones = milestonesSnap.docs.map((d) => toMilestone(d.id, d.data() as Partial<Milestone>));
  const rocksById = new Map(rocks.map((r) => [r.id, r]));

  const selectedMilestoneIds = new Set(input.milestoneIds);
  const selectedMilestones = milestones.filter((m) => selectedMilestoneIds.has(m.id));

  // הסלעים שיועתקו: מה שנבחר במפורש + כל שרשרת האבות של כל אבן דרך שנבחרה.
  const rockIdsToClone = new Set<string>();
  input.rockIds.forEach((id) => collectWithAncestors(id, rocksById, rockIdsToClone));
  selectedMilestones.forEach((m) => {
    if (m.rockId) collectWithAncestors(m.rockId, rocksById, rockIdsToClone);
  });

  // רבעון חדש בלי שום גלגול הוא תרחיש לגיטימי ("מתחילים דף חדש") - ממשיכים גם אם לא נבחר כלום.
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

  // שכפול הסלעים מלמעלה למטה, כדי שכשמגיעים לתת-סלע כבר יש מיפוי לאב החדש.
  const idMap = new Map<string, string>();
  const ordered = Array.from(rockIdsToClone).sort((a, b) => {
    const depth = (id: string) => (rocksById.get(id)?.parentRockId ? 1 : 0);
    return depth(a) - depth(b);
  });
  ordered.forEach((oldId) => {
    const rock = rocksById.get(oldId);
    if (!rock) return;
    const ref = db.collection(ROCKS).doc();
    idMap.set(oldId, ref.id);
    batch.set(ref, {
      title: rock.title,
      description: rock.description ?? "",
      quarterKey: newQuarterKey,
      parentRockId: rock.parentRockId ? idMap.get(rock.parentRockId) ?? null : null,
      ownerUserId: rock.ownerUserId ?? "",
      ownerName: rock.ownerName ?? "",
      status: "active" satisfies RockStatus,
      order: rock.order ?? now,
      rolledFromId: oldId,
      createdAt: now,
      createdBy,
    });
  });

  selectedMilestones.forEach((m) => {
    const newRockId = m.rockId ? idMap.get(m.rockId) ?? "" : "";
    if (m.source !== "adhoc" && !newRockId) return;
    const ref = db.collection(MILESTONES).doc();
    batch.set(ref, {
      rockId: newRockId,
      quarterKey: newQuarterKey,
      title: m.title,
      ownerUserId: m.ownerUserId ?? "",
      ownerName: m.ownerName ?? "",
      stage: "backlog" satisfies MilestoneStage,
      done: false,
      carryOverCount: (m.carryOverCount ?? 0) + 1,
      source: m.source ?? "rock",
      rolledFromId: m.id,
      order: m.order ?? now,
      createdAt: now,
      createdBy,
    });
  });

  await batch.commit();

  if (input.archiveSource !== false && input.fromQuarterKey) {
    await ensureQuarterDoc(db, input.fromQuarterKey);
    await db.collection(QUARTERS).doc(input.fromQuarterKey).set({ status: "archived" }, { merge: true });
  }

  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true, quarterKey: newQuarterKey };
}

// --- כתיבה: סיכומי פגישות ---

export async function saveReviewAction(period: RockReviewPeriod, periodKey: string, notes: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const createdBy = await currentUserLabel();
  const db = getAdminFirestore();
  if (period === "quarterly") {
    const blocked = await quarterWriteBlock(db, periodKey);
    if (blocked) return { ok: false, message: blocked };
  }
  const ref = db.collection(REVIEWS).doc(`${period}_${periodKey}`);
  const existing = await ref.get();
  const existingData = existing.data() as Partial<RockReview> | undefined;
  await ref.set(
    {
      period,
      periodKey,
      notes,
      createdAt: existingData?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      createdBy: existingData?.createdBy ?? createdBy,
    },
    { merge: true }
  );
  revalidatePath(ROCKS_PATH, "layout");
  return { ok: true };
}
