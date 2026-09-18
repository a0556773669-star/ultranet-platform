"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import type { Firestore, WriteBatch } from "firebase-admin/firestore";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { currentModuleScope, isOwnerSession, resolveModuleScope } from "@/lib/perms";
import type { Session } from "next-auth";
import type {
  PersonalTask,
  PersonalTaskAccess,
  PersonalTaskComment,
  PersonalTaskPriority,
  PersonalTaskStatus,
  TaskActivity,
  TaskActivityAction,
  TaskSettings,
} from "@ultranet/shared-types";
import { DEFAULT_TASK_SETTINGS } from "@ultranet/shared-types";
import { todayIso } from "../rocks/date-utils";
import { PERSONAL_STATUSES, isActivePersonalTask } from "./personal-task-ui";

const TASKS = "n_personal_tasks";
const COMMENTS = "n_personal_task_comments";
/** אותו יומן פעילות של המודול האסטרטגי - סעיף 16 מתיר במפורש לחלוק תשתית. */
const ACTIVITY = "n_task_activity";
const SETTINGS = "n_task_settings";
const SETTINGS_DOC = "default";

const MODULE_PATH = "/dashboard/duxus";

const DENIED = "אין לך הרשאה לטאב הזה";
const READONLY = "ההרשאה שלך בטאב הזה היא לצפייה בלבד";
const NOT_FOUND = "המשימה לא נמצאה";
const STALE = "המשימה עודכנה בינתיים על ידי משתמש אחר. יש לרענן את המסך ולנסות שוב.";

export type ActionResult = { ok: true } | { ok: false; message: string };
export type CreateResult = { ok: true; id: string } | { ok: false; message: string };

const PRIORITIES: readonly PersonalTaskPriority[] = ["normal", "important", "urgent"] as const;

function revalidateModule() {
  revalidatePath(MODULE_PATH, "layout");
}

// --- הרשאות (סעיף 4) ---

function emailOf(session: Session | null | undefined): string {
  return (session?.user?.email ?? "").trim().toLowerCase();
}

function labelOf(session: Session | null | undefined): string {
  return session?.user?.name ?? session?.user?.email ?? "";
}

function toEmailList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean)));
}

async function readSettings(db: Firestore): Promise<Pick<TaskSettings, "personalOwnerEmails" | "personalEditorEmails" | "personalViewerEmails">> {
  const doc = await db.collection(SETTINGS).doc(SETTINGS_DOC).get();
  const data = doc.exists ? (doc.data() as Partial<TaskSettings>) : undefined;
  return {
    personalOwnerEmails: toEmailList(data?.personalOwnerEmails),
    personalEditorEmails: toEmailList(data?.personalEditorEmails),
    personalViewerEmails: toEmailList(data?.personalViewerEmails),
  };
}

/**
 * רמת הגישה של המשתמש הנוכחי.
 *
 * הרשאת המודול (`duxus`) היא תנאי הכרחי אך **לא** מספיק: הטאב הוא רשימת העבודה
 * האישית של אדם אחד, ולכן מי שאינו מופיע באחת משלוש הרשימות אינו רואה ממנו דבר -
 * לא בממשק ולא ב-API (קריטריון קבלה 9).
 *
 * חריג יחיד, לצורך אתחול: כל עוד שלוש הרשימות ריקות, המודול עוד לא הוגדר, ואז
 * בעלים נכנס כדי להגדיר אותו. ברגע שהוגדר שם אחד - גם הבעלים כפוף לרשימות.
 */
async function resolvePersonalAccess(session: Session | null | undefined, db: Firestore): Promise<PersonalTaskAccess> {
  if (!session) return "none";
  if (!resolveModuleScope(session, "duxus").granted) return "none";

  const settings = await readSettings(db);
  const email = emailOf(session);
  if (email && settings.personalOwnerEmails.includes(email)) return "owner";
  if (email && settings.personalEditorEmails.includes(email)) return "editor";
  if (email && settings.personalViewerEmails.includes(email)) return "viewer";

  const unconfigured =
    settings.personalOwnerEmails.length === 0 &&
    settings.personalEditorEmails.length === 0 &&
    settings.personalViewerEmails.length === 0;
  return unconfigured && isOwnerSession(session) ? "owner" : "none";
}

type Context = { db: Firestore; access: PersonalTaskAccess; user: string; email: string };

async function context(): Promise<Context> {
  const session = await getServerSession(authOptions);
  const db = getAdminFirestore();
  return { db, access: await resolvePersonalAccess(session, db), user: labelOf(session), email: emailOf(session) };
}

/** הגישה נבדקת **בשרת בכל פעולה** ולא רק בממשק (סעיף 18). */
function denyRead(ctx: Context): string | null {
  return ctx.access === "none" ? DENIED : null;
}

function denyWrite(ctx: Context): string | null {
  if (ctx.access === "none") return DENIED;
  if (ctx.access === "viewer") return READONLY;
  return null;
}

/** פעולות שמורות ליוני בלבד: מחיקה לוגית, שחזור, ועריכת משימה שכבר הושלמה (סעיף 4). */
function denyOwnerOnly(ctx: Context): string | null {
  if (ctx.access === "none") return DENIED;
  return ctx.access === "owner" ? null : "הפעולה שמורה לבעל הרשימה";
}

// --- ממפי מסמכים ---

function toTask(id: string, data: Partial<PersonalTask> | undefined): PersonalTask {
  const status = PERSONAL_STATUSES.includes(data?.status as PersonalTaskStatus) ? (data?.status as PersonalTaskStatus) : "new";
  return {
    id,
    title: data?.title ?? "",
    description: data?.description ?? "",
    contactName: data?.contactName ?? "",
    contactPhone: data?.contactPhone ?? "",
    priority: PRIORITIES.includes(data?.priority as PersonalTaskPriority) ? (data?.priority as PersonalTaskPriority) : "normal",
    status,
    dueDate: data?.dueDate ?? "",
    dueTime: data?.dueTime ?? "",
    pinned: Boolean(data?.pinned),
    lastNote: data?.lastNote ?? "",
    createdBy: data?.createdBy ?? "",
    createdAt: data?.createdAt ?? 0,
    viewedAt: data?.viewedAt ?? null,
    completedBy: data?.completedBy ?? "",
    completedAt: data?.completedAt ?? null,
    cancelledBy: data?.cancelledBy ?? "",
    cancelledAt: data?.cancelledAt ?? null,
    cancelReason: data?.cancelReason ?? "",
    reopenCount: data?.reopenCount ?? 0,
    deletedAt: data?.deletedAt ?? null,
    deletedBy: data?.deletedBy ?? "",
    updatedAt: data?.updatedAt ?? data?.createdAt ?? 0,
    updatedBy: data?.updatedBy ?? "",
  };
}

function toComment(id: string, data: Partial<PersonalTaskComment> | undefined): PersonalTaskComment {
  return {
    id,
    taskId: data?.taskId ?? "",
    body: data?.body ?? "",
    createdBy: data?.createdBy ?? "",
    createdAt: data?.createdAt ?? 0,
    editedAt: data?.editedAt ?? null,
  };
}

function toActivity(id: string, data: Partial<TaskActivity> | undefined): TaskActivity {
  return {
    id,
    entityType: data?.entityType ?? "personal_task",
    entityId: data?.entityId ?? "",
    action: (data?.action ?? "update") as TaskActivityAction,
    field: data?.field ?? "",
    oldValue: data?.oldValue ?? "",
    newValue: data?.newValue ?? "",
    personalTaskId: data?.personalTaskId ?? "",
    note: data?.note ?? "",
    userName: data?.userName ?? "",
    at: data?.at ?? 0,
  };
}

// --- יומן פעילות (סעיף 15) ---

type ActivityEntry = {
  taskId: string;
  action: TaskActivityAction;
  field?: string;
  oldValue?: string;
  newValue?: string;
  note?: string;
};

/**
 * רישום ליומן. כשמועבר `batch` הרישום נכנס לאותה כתיבה אטומית של השינוי עצמו, כך
 * שלא ייתכן מצב שבו הנתון השתנה אך הפעולה לא תועדה (סעיף 18).
 */
function logActivity(db: Firestore, batch: WriteBatch | null, userName: string, entry: ActivityEntry): Promise<void> {
  const ref = db.collection(ACTIVITY).doc();
  const payload = {
    entityType: "personal_task" as const,
    entityId: entry.taskId,
    personalTaskId: entry.taskId,
    action: entry.action,
    field: entry.field ?? "",
    oldValue: entry.oldValue ?? "",
    newValue: entry.newValue ?? "",
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

// --- קריאה ---

export type PersonalBoard = {
  access: PersonalTaskAccess;
  /** שם התצוגה של המשתמש הנוכחי - כדי שהלקוח ידע לסמן "נוצר על ידי" בלי שליפה נוספת */
  currentUser: string;
  /** "YYYY-MM-DD" מחושב בשרת, כדי שהצביעה של "היום"/"באיחור" תהיה זהה בשני הצדדים */
  today: string;
  active: PersonalTask[];
  completed: PersonalTask[];
  /** מבוטלות ומחוקות לוגית - נטענות רק כדי שהמסנן "בוטלו" יעבוד בלי סבב נוסף לשרת */
  archived: PersonalTask[];
};

/**
 * כל הרשימה בשליפה אחת. הסינון והמיון נעשים בלקוח (הרשימה של אדם אחד היא בסדר
 * גודל של מאות רשומות לכל היותר), ולכן כל שינוי במסננים הוא מיידי ובלי סבב לשרת.
 */
export async function loadPersonalBoard(): Promise<PersonalBoard> {
  const session = await getServerSession(authOptions);
  const db = getAdminFirestore();
  const access = await resolvePersonalAccess(session, db);
  const empty: PersonalBoard = { access, currentUser: labelOf(session), today: todayIso(), active: [], completed: [], archived: [] };
  if (access === "none") return empty;

  const snap = await db.collection(TASKS).get();
  const all = snap.docs.map((d) => toTask(d.id, d.data() as Partial<PersonalTask>));

  return {
    ...empty,
    active: all.filter((t) => isActivePersonalTask(t)),
    completed: all.filter((t) => !t.deletedAt && t.status === "done"),
    // מחוקות לוגית מוצגות לבעל הרשימה בלבד - הוא היחיד שיכול למחוק ולשחזר, ולכן
    // הוא היחיד שיש לו מה לעשות איתן. מבוטלות נשארות גלויות לכולם (סעיף 9).
    archived: all.filter((t) => (t.deletedAt ? access === "owner" : t.status === "cancelled")),
  };
}

export async function listPersonalComments(taskId: string): Promise<PersonalTaskComment[]> {
  const ctx = await context();
  if (denyRead(ctx)) return [];
  const snap = await ctx.db.collection(COMMENTS).where("taskId", "==", taskId).get();
  return snap.docs.map((d) => toComment(d.id, d.data() as Partial<PersonalTaskComment>)).sort((a, b) => a.createdAt - b.createdAt);
}

export async function listPersonalActivity(taskId: string): Promise<TaskActivity[]> {
  const ctx = await context();
  if (denyRead(ctx)) return [];
  const snap = await ctx.db.collection(ACTIVITY).where("personalTaskId", "==", taskId).get();
  return snap.docs.map((d) => toActivity(d.id, d.data() as Partial<TaskActivity>)).sort((a, b) => b.at - a.at);
}

// --- כתיבה ---

export type PersonalTaskInput = {
  title: string;
  description?: string;
  contactName?: string;
  contactPhone?: string;
  priority?: PersonalTaskPriority;
  dueDate?: string;
  dueTime?: string;
};

function cleanInput(input: PersonalTaskInput) {
  const priority = PRIORITIES.includes(input.priority as PersonalTaskPriority) ? (input.priority as PersonalTaskPriority) : "normal";
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate ?? "") ? (input.dueDate as string) : "";
  return {
    title: (input.title ?? "").trim(),
    description: (input.description ?? "").trim(),
    contactName: (input.contactName ?? "").trim(),
    // נשמר כטקסט חופשי: פורמט לא תקין אינו חוסם שמירה (סעיף 17).
    contactPhone: (input.contactPhone ?? "").trim(),
    priority,
    dueDate,
    // שעה בלי תאריך היא חסרת משמעות, ולכן נזרקת יחד איתו.
    dueTime: dueDate && /^\d{2}:\d{2}$/.test(input.dueTime ?? "") ? (input.dueTime as string) : "",
  };
}

/** ספרות בלבד, להשוואת כפילויות: "052-1234567" ו-"0521234567" הם אותו מספר. */
function phoneKey(phone: string): string {
  return phone.replace(/\D/g, "");
}

export type DuplicateHit = { id: string; title: string; contactName: string; createdBy: string };

/**
 * אזהרת כפילות עדינה - מאתרת משימה **פעילה** עם אותה כותרת או אותו טלפון. היא
 * אף פעם לא חוסמת שמירה, רק מציגה קישור למשימה הדומה (סעיף 6).
 */
export async function findPersonalDuplicates(title: string, phone: string, excludeId = ""): Promise<DuplicateHit[]> {
  const ctx = await context();
  if (denyRead(ctx)) return [];
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedPhone = phoneKey(phone);
  if (!normalizedTitle && !normalizedPhone) return [];

  const snap = await ctx.db.collection(TASKS).get();
  return snap.docs
    .map((d) => toTask(d.id, d.data() as Partial<PersonalTask>))
    .filter((t) => t.id !== excludeId && isActivePersonalTask(t))
    .filter(
      (t) =>
        (normalizedTitle && t.title.trim().toLowerCase() === normalizedTitle) ||
        (normalizedPhone.length >= 7 && phoneKey(t.contactPhone ?? "") === normalizedPhone)
    )
    .slice(0, 3)
    .map((t) => ({ id: t.id, title: t.title, contactName: t.contactName ?? "", createdBy: t.createdBy ?? "" }));
}

export async function createPersonalTaskAction(input: PersonalTaskInput): Promise<CreateResult> {
  const ctx = await context();
  const denied = denyWrite(ctx);
  if (denied) return { ok: false, message: denied };

  const fields = cleanInput(input);
  if (!fields.title) return { ok: false, message: "יש להזין כותרת למשימה" };

  const now = Date.now();
  const ref = ctx.db.collection(TASKS).doc();
  const batch = ctx.db.batch();
  batch.set(ref, {
    ...fields,
    status: "new" as PersonalTaskStatus,
    pinned: false,
    lastNote: "",
    createdBy: ctx.user,
    createdAt: now,
    viewedAt: null,
    completedBy: "",
    completedAt: null,
    cancelledBy: "",
    cancelledAt: null,
    cancelReason: "",
    reopenCount: 0,
    deletedAt: null,
    updatedAt: now,
    updatedBy: ctx.user,
  });
  logActivity(ctx.db, batch, ctx.user, { taskId: ref.id, action: "create", newValue: fields.title });
  await batch.commit();

  revalidateModule();
  return { ok: true, id: ref.id };
}

/**
 * קריאה + בדיקת גרסה. הלקוח שולח את ה-`updatedAt` שהוא ראה, והשרת דוחה עדכון על
 * גרסה ישנה - כך שני משתמשים אינם דורסים זה את שינויי זה בשקט (קריטריון קבלה 10).
 */
async function loadForWrite(ctx: Context, id: string, expectedUpdatedAt?: number): Promise<{ task: PersonalTask } | { message: string }> {
  const snap = await ctx.db.collection(TASKS).doc(id).get();
  if (!snap.exists) return { message: NOT_FOUND };
  const task = toTask(snap.id, snap.data() as Partial<PersonalTask>);
  if (task.deletedAt) return { message: "המשימה נמחקה" };
  if (expectedUpdatedAt !== undefined && task.updatedAt && expectedUpdatedAt !== task.updatedAt) return { message: STALE };
  return { task };
}

const FIELD_LABEL: Record<string, string> = {
  title: "כותרת",
  description: "פירוט",
  contactName: "שם הפונה",
  contactPhone: "טלפון הפונה",
  priority: "דחיפות",
  dueDate: "תאריך יעד",
  dueTime: "שעת יעד",
};

export async function updatePersonalTaskAction(
  id: string,
  input: PersonalTaskInput,
  expectedUpdatedAt?: number
): Promise<ActionResult> {
  const ctx = await context();
  const denied = denyWrite(ctx);
  if (denied) return { ok: false, message: denied };

  const fields = cleanInput(input);
  if (!fields.title) return { ok: false, message: "יש להזין כותרת למשימה" };

  const loaded = await loadForWrite(ctx, id, expectedUpdatedAt);
  if ("message" in loaded) return { ok: false, message: loaded.message };
  const before = loaded.task;

  // עריכת משימה שכבר הושלמה מותרת ליוני בלבד, ואינה מאפסת את ההשלמה (סעיף 17).
  if (before.status === "done" && ctx.access !== "owner") {
    return { ok: false, message: "משימה שהושלמה ניתנת לעריכה על ידי בעל הרשימה בלבד" };
  }

  const now = Date.now();
  const batch = ctx.db.batch();
  batch.set(ctx.db.collection(TASKS).doc(id), { ...fields, updatedAt: now, updatedBy: ctx.user }, { merge: true });

  const previous = before as unknown as Record<string, unknown>;
  (Object.keys(FIELD_LABEL) as (keyof typeof fields)[]).forEach((key) => {
    const oldValue = String(previous[key] ?? "");
    const newValue = String(fields[key] ?? "");
    if (oldValue === newValue) return;
    logActivity(ctx.db, batch, ctx.user, {
      taskId: id,
      action: "update",
      field: FIELD_LABEL[key],
      oldValue,
      newValue,
    });
  });

  await batch.commit();
  revalidateModule();
  return { ok: true };
}

/**
 * פתיחה ראשונה של המשימה על ידי בעל הרשימה: מסירה את חיווי "חדש" ומעבירה
 * `new` → `open`. היא **אינה** מקדמת ל"בטיפול" - זו החלטה של יוני, לא של המערכת
 * (סעיף 7).
 */
export async function markPersonalTaskViewedAction(id: string): Promise<ActionResult> {
  const ctx = await context();
  if (ctx.access !== "owner") return { ok: true };

  const snap = await ctx.db.collection(TASKS).doc(id).get();
  if (!snap.exists) return { ok: false, message: NOT_FOUND };
  const task = toTask(snap.id, snap.data() as Partial<PersonalTask>);
  if (task.viewedAt) return { ok: true };

  const now = Date.now();
  const batch = ctx.db.batch();
  const patch: Record<string, unknown> = { viewedAt: now };
  if (task.status === "new") patch.status = "open";
  batch.set(ctx.db.collection(TASKS).doc(id), patch, { merge: true });
  logActivity(ctx.db, batch, ctx.user, { taskId: id, action: "view" });
  await batch.commit();

  revalidateModule();
  return { ok: true };
}

export async function setPersonalTaskStatusAction(
  id: string,
  status: PersonalTaskStatus,
  note = "",
  expectedUpdatedAt?: number
): Promise<ActionResult> {
  const ctx = await context();
  const denied = denyWrite(ctx);
  if (denied) return { ok: false, message: denied };
  if (!PERSONAL_STATUSES.includes(status)) return { ok: false, message: "סטטוס לא מוכר" };
  // "הושלם" ו"בוטל" הם פעולות משלהן, שכותבות גם מי ומתי - ולכן לא עוברות כאן.
  if (status === "done" || status === "cancelled") return { ok: false, message: "יש להשתמש בפעולה הייעודית" };

  const loaded = await loadForWrite(ctx, id, expectedUpdatedAt);
  if ("message" in loaded) return { ok: false, message: loaded.message };
  const before = loaded.task;
  if (before.status === status) return { ok: true };

  const now = Date.now();
  const batch = ctx.db.batch();
  batch.set(ctx.db.collection(TASKS).doc(id), { status, updatedAt: now, updatedBy: ctx.user }, { merge: true });
  logActivity(ctx.db, batch, ctx.user, { taskId: id, action: "status", oldValue: before.status, newValue: status, note });
  await batch.commit();

  revalidateModule();
  return { ok: true };
}

/**
 * סימון הושלם - הפעולה המרכזית של המסך, בלחיצה אחת ובלי אישור נוסף (סעיף 20).
 * הכתיבה אטומית: הסטטוס, מי השלים, מתי והרישום ליומן נשמרים יחד (סעיף 18).
 */
export async function completePersonalTaskAction(id: string, expectedUpdatedAt?: number): Promise<ActionResult> {
  const ctx = await context();
  const denied = denyWrite(ctx);
  if (denied) return { ok: false, message: denied };

  const loaded = await loadForWrite(ctx, id, expectedUpdatedAt);
  if ("message" in loaded) return { ok: false, message: loaded.message };
  const before = loaded.task;
  if (before.status === "done") return { ok: true };

  const now = Date.now();
  const batch = ctx.db.batch();
  batch.set(
    ctx.db.collection(TASKS).doc(id),
    { status: "done", completedAt: now, completedBy: ctx.user, pinned: false, updatedAt: now, updatedBy: ctx.user },
    { merge: true }
  );
  logActivity(ctx.db, batch, ctx.user, { taskId: id, action: "complete", oldValue: before.status, newValue: "done" });
  await batch.commit();

  revalidateModule();
  return { ok: true };
}

/**
 * פתיחה מחדש - מחזירה **את אותה משימה** לרשימה הפעילה ולעולם לא יוצרת עותק
 * (קריטריון קבלה 5). `silent` הוא חלון ה"ביטול" של כמה שניות אחרי סימון בטעות:
 * אותה פעולה בדיוק, רק בלי לנפח את מונה הפתיחות מחדש (סעיף 10).
 */
export async function reopenPersonalTaskAction(id: string, reason = "", silent = false): Promise<ActionResult> {
  const ctx = await context();
  const denied = denyWrite(ctx);
  if (denied) return { ok: false, message: denied };

  const snap = await ctx.db.collection(TASKS).doc(id).get();
  if (!snap.exists) return { ok: false, message: NOT_FOUND };
  const before = toTask(snap.id, snap.data() as Partial<PersonalTask>);
  if (before.deletedAt) return { ok: false, message: "המשימה נמחקה" };
  if (isActivePersonalTask(before)) return { ok: true };

  const now = Date.now();
  const batch = ctx.db.batch();
  batch.set(
    ctx.db.collection(TASKS).doc(id),
    {
      status: "open",
      completedAt: null,
      completedBy: "",
      cancelledAt: null,
      cancelledBy: "",
      cancelReason: "",
      reopenCount: (before.reopenCount ?? 0) + (silent ? 0 : 1),
      updatedAt: now,
      updatedBy: ctx.user,
    },
    { merge: true }
  );
  if (!silent) {
    logActivity(ctx.db, batch, ctx.user, { taskId: id, action: "reopen", oldValue: before.status, newValue: "open", note: reason });
  }
  await batch.commit();

  revalidateModule();
  return { ok: true };
}

/** ביטול דורש סיבה קצרה - גם מהמזכירה, ובמיוחד ממנה (סעיף 4). */
export async function cancelPersonalTaskAction(id: string, reason: string, expectedUpdatedAt?: number): Promise<ActionResult> {
  const ctx = await context();
  const denied = denyWrite(ctx);
  if (denied) return { ok: false, message: denied };

  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, message: "יש להזין סיבת ביטול" };

  const loaded = await loadForWrite(ctx, id, expectedUpdatedAt);
  if ("message" in loaded) return { ok: false, message: loaded.message };
  const before = loaded.task;

  const now = Date.now();
  const batch = ctx.db.batch();
  batch.set(
    ctx.db.collection(TASKS).doc(id),
    { status: "cancelled", cancelledAt: now, cancelledBy: ctx.user, cancelReason: trimmed, pinned: false, updatedAt: now, updatedBy: ctx.user },
    { merge: true }
  );
  logActivity(ctx.db, batch, ctx.user, { taskId: id, action: "cancel", oldValue: before.status, newValue: "cancelled", note: trimmed });
  await batch.commit();

  revalidateModule();
  return { ok: true };
}

export async function setPersonalTaskPinnedAction(id: string, pinned: boolean): Promise<ActionResult> {
  const ctx = await context();
  const denied = denyWrite(ctx);
  if (denied) return { ok: false, message: denied };

  const now = Date.now();
  await ctx.db.collection(TASKS).doc(id).set({ pinned, updatedAt: now, updatedBy: ctx.user }, { merge: true });
  revalidateModule();
  return { ok: true };
}

/** מחיקה לוגית בלבד: המידע נשמר לצורכי שחזור ולעולם לא נמחק פיזית (סעיף 17). */
export async function deletePersonalTaskAction(id: string): Promise<ActionResult> {
  const ctx = await context();
  const denied = denyOwnerOnly(ctx);
  if (denied) return { ok: false, message: denied };

  const snap = await ctx.db.collection(TASKS).doc(id).get();
  if (!snap.exists) return { ok: false, message: NOT_FOUND };
  const before = toTask(snap.id, snap.data() as Partial<PersonalTask>);

  const now = Date.now();
  const batch = ctx.db.batch();
  batch.set(ctx.db.collection(TASKS).doc(id), { deletedAt: now, deletedBy: ctx.user, pinned: false, updatedAt: now, updatedBy: ctx.user }, { merge: true });
  logActivity(ctx.db, batch, ctx.user, { taskId: id, action: "delete", oldValue: before.title });
  await batch.commit();

  revalidateModule();
  return { ok: true };
}

export async function restorePersonalTaskAction(id: string): Promise<ActionResult> {
  const ctx = await context();
  const denied = denyOwnerOnly(ctx);
  if (denied) return { ok: false, message: denied };

  const now = Date.now();
  const batch = ctx.db.batch();
  batch.set(ctx.db.collection(TASKS).doc(id), { deletedAt: null, deletedBy: "", updatedAt: now, updatedBy: ctx.user }, { merge: true });
  logActivity(ctx.db, batch, ctx.user, { taskId: id, action: "restore" });
  await batch.commit();

  revalidateModule();
  return { ok: true };
}

/**
 * הערה חדשה. `lastNote` מוכפל על המשימה עצמה כדי שהשורה ברשימה תציג את ההערה
 * האחרונה בלי לשלוף את שרשור ההערות של כל שורה (סעיף 7).
 */
export async function addPersonalCommentAction(taskId: string, body: string): Promise<ActionResult> {
  const ctx = await context();
  const denied = denyWrite(ctx);
  if (denied) return { ok: false, message: denied };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, message: "יש להזין תוכן להערה" };

  const snap = await ctx.db.collection(TASKS).doc(taskId).get();
  if (!snap.exists) return { ok: false, message: NOT_FOUND };

  const now = Date.now();
  const batch = ctx.db.batch();
  batch.set(ctx.db.collection(COMMENTS).doc(), { taskId, body: trimmed, createdBy: ctx.user, createdAt: now, editedAt: null });
  batch.set(ctx.db.collection(TASKS).doc(taskId), { lastNote: trimmed, updatedAt: now, updatedBy: ctx.user }, { merge: true });
  logActivity(ctx.db, batch, ctx.user, { taskId, action: "comment", note: trimmed });
  await batch.commit();

  revalidateModule();
  return { ok: true };
}

// --- הגדרות הגישה (סעיף 4) ---

/**
 * מי רואה את הטאב. שמירה שמורה לבעלים בלבד: זו החלטה על מי נחשף לרשימה האישית
 * של מישהו אחר, ולא הגדרת תצוגה.
 */
export async function savePersonalAccessAction(input: {
  ownerEmails: string[];
  editorEmails: string[];
  viewerEmails: string[];
}): Promise<ActionResult> {
  const scope = await currentModuleScope("duxus");
  if (!scope?.isOwner) return { ok: false, message: "רק בעלים יכול לשנות את הרשאות הטאב" };

  const user = labelOf(await getServerSession(authOptions));
  await getAdminFirestore()
    .collection(SETTINGS)
    .doc(SETTINGS_DOC)
    .set(
      {
        personalOwnerEmails: toEmailList(input.ownerEmails),
        personalEditorEmails: toEmailList(input.editorEmails),
        personalViewerEmails: toEmailList(input.viewerEmails),
        updatedAt: Date.now(),
        updatedBy: user,
      },
      { merge: true }
    );

  revalidateModule();
  return { ok: true };
}

/** ברירות המחדל נחשפות כדי שמסך ההגדרות יוכל להציג רשימה ריקה בלי לשכפל קבועים. */
export async function getPersonalAccessSettings(): Promise<{
  ownerEmails: string[];
  editorEmails: string[];
  viewerEmails: string[];
}> {
  const scope = await currentModuleScope("duxus");
  if (!scope?.granted) {
    return { ownerEmails: [], editorEmails: [], viewerEmails: [] };
  }
  const settings = await readSettings(getAdminFirestore());
  return {
    ownerEmails: settings.personalOwnerEmails ?? DEFAULT_TASK_SETTINGS.personalOwnerEmails,
    editorEmails: settings.personalEditorEmails ?? DEFAULT_TASK_SETTINGS.personalEditorEmails,
    viewerEmails: settings.personalViewerEmails ?? DEFAULT_TASK_SETTINGS.personalViewerEmails,
  };
}

/** האם להציג את הלשונית בסרגל - נקרא מהשרת בלבד, לפני הרינדור. */
export async function canSeePersonalTab(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return (await resolvePersonalAccess(session, getAdminFirestore())) !== "none";
}
