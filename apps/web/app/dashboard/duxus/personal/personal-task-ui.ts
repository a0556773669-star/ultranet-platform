import type { PersonalTask, PersonalTaskPriority, PersonalTaskStatus } from "@ultranet/shared-types";

/**
 * הקבועים המשותפים לטאב "משימות ליוני" - תוויות, חיווי ומיון.
 *
 * הקובץ נטול `"use server"` ונטול תלות ב-Firestore בכוונה: גם השרת (שמרנדר את
 * הרשימה בפעם הראשונה) וגם הלקוח (שמסנן וממיין מיידית) חייבים להגיע **לאותו**
 * סדר ולאותו חיווי, אחרת השורות יקפצו ברגע שה-hydration ירוץ.
 */

export const PERSONAL_STATUSES: readonly PersonalTaskStatus[] = [
  "new",
  "open",
  "in_progress",
  "waiting",
  "done",
  "cancelled",
] as const;

export const PERSONAL_STATUS_LABEL: Record<PersonalTaskStatus, string> = {
  new: "חדש",
  open: "פתוח",
  in_progress: "בטיפול",
  waiting: "ממתין",
  done: "הושלם",
  cancelled: "בוטל",
};

/** הסטטוסים שניתן לבחור ידנית ברשימה הפעילה. "הושלם" נעשה בתיבת הסימון ו"בוטל"
 *  בפעולה נפרדת שדורשת סיבה - ולכן שניהם אינם בתפריט הסטטוס (סעיף 9). */
export const PERSONAL_ACTIVE_STATUSES: readonly PersonalTaskStatus[] = ["new", "open", "in_progress", "waiting"] as const;

export const PERSONAL_PRIORITIES: readonly PersonalTaskPriority[] = ["urgent", "important", "normal"] as const;

export const PERSONAL_PRIORITY_LABEL: Record<PersonalTaskPriority, string> = {
  urgent: "דחופה",
  important: "חשובה",
  normal: "רגילה",
};

/** תגיות עדינות בלבד - סעיף 13 אוסר במפורש לצבוע שורה שלמה בצבע חזק. */
export const PERSONAL_PRIORITY_BADGE: Record<PersonalTaskPriority, string> = {
  urgent: "border-red-200 bg-red-50 text-red-700",
  important: "border-amber-200 bg-amber-50 text-amber-700",
  normal: "border-card-border bg-[#f4f6f9] text-muted",
};

export const PERSONAL_STATUS_BADGE: Record<PersonalTaskStatus, string> = {
  new: "border-teal-bg bg-teal-bg text-teal-dark",
  open: "border-card-border bg-[#f4f6f9] text-muted",
  in_progress: "border-sky-200 bg-sky-50 text-sky-700",
  waiting: "border-slate-300 bg-slate-100 text-slate-600",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-card-border bg-[#f4f6f9] text-muted",
};

export function isActivePersonalTask(task: PersonalTask): boolean {
  if (task.deletedAt) return false;
  return task.status !== "done" && task.status !== "cancelled";
}

/** "באיחור" = יש תאריך יעד והוא לפני היום. משימה בלי תאריך יעד לעולם אינה באיחור (סעיף 8). */
export function isOverdue(task: PersonalTask, todayIso: string): boolean {
  if (!task.dueDate || !isActivePersonalTask(task)) return false;
  return task.dueDate < todayIso;
}

export function isDueToday(task: PersonalTask, todayIso: string): boolean {
  return Boolean(task.dueDate) && task.dueDate === todayIso;
}

/**
 * דירוג ברירת המחדל של הרשימה הפעילה, לפי הסדר שנקבע בסעיף 8:
 * דחופות → שעבר מועדן → להיום → חשובות → כל השאר.
 */
function defaultRank(task: PersonalTask, todayIso: string): number {
  if (task.priority === "urgent") return 0;
  if (isOverdue(task, todayIso)) return 1;
  if (isDueToday(task, todayIso)) return 2;
  if (task.priority === "important") return 3;
  return 4;
}

export type PersonalSort = "smart" | "due" | "newest" | "oldest" | "priority";

export const PERSONAL_SORT_LABEL: Record<PersonalSort, string> = {
  smart: "מומלץ",
  due: "תאריך יעד",
  newest: "נוצר לאחרונה",
  oldest: "הוותיק ביותר",
  priority: "דחיפות",
};

const PRIORITY_ORDER: Record<PersonalTaskPriority, number> = { urgent: 0, important: 1, normal: 2 };

/** תאריך יעד חסר נדחק לסוף בכל מיון שמסתמך עליו, במקום להיחשב "הכי מוקדם". */
function dueKey(task: PersonalTask): string {
  return task.dueDate ? `${task.dueDate} ${task.dueTime || "23:59"}` : "9999-12-31";
}

/**
 * מיון הרשימה הפעילה. משימה מוצמדת תמיד קודמת (סעיף 8), ובתוך אותה רמה תאריך היעד
 * הקרוב קודם, ולבסוף מועד היצירה מהישן לחדש - כדי שמשימה ותיקה לא תישכח בתחתית.
 */
export function sortActiveTasks(tasks: PersonalTask[], todayIso: string, sort: PersonalSort = "smart"): PersonalTask[] {
  return [...tasks].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;

    if (sort === "newest") return b.createdAt - a.createdAt;
    if (sort === "oldest") return a.createdAt - b.createdAt;
    if (sort === "due") {
      const cmp = dueKey(a).localeCompare(dueKey(b));
      if (cmp !== 0) return cmp;
      return a.createdAt - b.createdAt;
    }
    if (sort === "priority") {
      const cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (cmp !== 0) return cmp;
      return dueKey(a).localeCompare(dueKey(b)) || a.createdAt - b.createdAt;
    }

    const rank = defaultRank(a, todayIso) - defaultRank(b, todayIso);
    if (rank !== 0) return rank;
    const cmp = dueKey(a).localeCompare(dueKey(b));
    if (cmp !== 0) return cmp;
    return a.createdAt - b.createdAt;
  });
}

/** המושלמות מוצגות מהאחרונה שהושלמה לראשונה (סעיף 11). */
export function sortCompletedTasks(tasks: PersonalTask[]): PersonalTask[] {
  return [...tasks].sort((a, b) => (b.completedAt ?? b.updatedAt ?? 0) - (a.completedAt ?? a.updatedAt ?? 0));
}

/** תצוגת תאריך יעד קצרה לשורה: "12/03" או "12/03 14:30". */
export function formatDue(task: PersonalTask): string {
  if (!task.dueDate) return "";
  const [, month, day] = task.dueDate.split("-");
  const date = `${day}/${month}`;
  return task.dueTime ? `${date} ${task.dueTime}` : date;
}

export function formatStamp(ms: number | null | undefined): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

/** ספרות בלבד - כדי שקישור החיוג יעבוד גם על מספר שהוזן עם מקפים או רווחים. */
export function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : "";
}
