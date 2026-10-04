// סטטוסים, צבעים וחישובי התקדמות - לוגיקה טהורה שמשותפת לשרת וללקוח.
//
// כלל היסוד (סעיף 6 באפיון): **רק אבן דרך מקבלת סטטוס ידני.** מצבם של סלע ותת-סלע
// מחושב מאבני הדרך שמתחתיהם, ומשימה מבוטלת לא נספרת במכנה ההתקדמות.

import type { Milestone, MilestoneStatus, PeriodAssignment, PeriodType } from "@ultranet/shared-types";
import { isPastDue } from "./date-utils";

export const MILESTONE_STATUSES: MilestoneStatus[] = ["not_started", "in_progress", "waiting", "done", "cancelled"];

export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  not_started: "טרם התחיל",
  in_progress: "בביצוע",
  waiting: "ממתין לגורם אחר",
  done: "הושלם",
  cancelled: "בוטל",
};

/** תווית קצרה לשורה צרה (סרגל הפעולה, תגים) */
export const STATUS_SHORT: Record<MilestoneStatus, string> = {
  not_started: "טרם התחיל",
  in_progress: "בביצוע",
  waiting: "ממתין",
  done: "הושלם",
  cancelled: "בוטל",
};

/**
 * החיווי הוויזואלי של שורה. האפיון (סעיף 9) מבקש עיצוב רגוע: **לא לצבוע שורה שלמה
 * בצבע חזק** אלא נקודה, תג קטן ופס צד דק - ולכן כל גוון כאן מוגדר כשלישייה
 * (נקודה / תג / פס צד) ולא כרקע מלא.
 */
export type ToneKey = "idle" | "progress" | "warn" | "overdue" | "done" | "waiting" | "cancelled";

export type Tone = {
  /** פס הצד הדק של השורה */
  side: string;
  /** הנקודה שמימין לכותרת */
  dot: string;
  /** התג הקטן */
  badge: string;
  label: string;
};

export const TONES: Record<ToneKey, Tone> = {
  idle: { side: "border-r-card-border", dot: "bg-[#c3ccd8]", badge: "border-card-border bg-[#f4f6f9] text-muted", label: "טרם התחיל" },
  progress: { side: "border-r-teal", dot: "bg-teal", badge: "border-teal bg-teal-bg text-teal-dark", label: "בביצוע" },
  warn: { side: "border-r-amber-400", dot: "bg-amber-400", badge: "border-amber-300 bg-amber-50 text-amber-700", label: "טרם התחיל השבוע" },
  overdue: { side: "border-r-red-400", dot: "bg-red-400", badge: "border-red-300 bg-red-50 text-red-700", label: "עבר יעד" },
  done: { side: "border-r-emerald-400", dot: "bg-emerald-500", badge: "border-emerald-300 bg-emerald-50 text-emerald-700", label: "הושלם" },
  waiting: { side: "border-r-purple", dot: "bg-purple", badge: "border-purple/40 bg-[#f4ecf8] text-purple", label: "ממתין" },
  cancelled: { side: "border-r-card-border", dot: "bg-[#c3ccd8]", badge: "border-card-border bg-[#f4f6f9] text-muted", label: "בוטל" },
};

/**
 * הקשר התצוגה שקובע אם מגיעה אזהרה כתומה - האזהרה שייכת למשימות השבוע בלבד.
 * `today` ו-`weekWarningActive` מחושבים בשרת ומועברים כ-props, כדי שהשרת והלקוח
 * יציירו בדיוק אותו דבר.
 */
export type ToneContext = {
  /** "YYYY-MM-DD" של היום, כפי שחושב בשרת */
  today: string;
  /** האם המשימה נבחרה לשבוע הפתוח */
  inCurrentWeek?: boolean;
  /** האם עבר מועד האזהרה השבועית (מחושב מהגדרות המערכת) */
  weekWarningActive?: boolean;
};

/**
 * הגוון של אבן דרך לפי סדר עדיפויות: הושלם/בוטל הם מצב סופי; אחריהם עבר-יעד (אדום
 * עדין); אחריו המתנה; אחריו אזהרת השבוע הכתומה; ולבסוף בביצוע/טרם התחיל.
 */
export function milestoneTone(m: Milestone, ctx: ToneContext): ToneKey {
  if (m.status === "done") return "done";
  if (m.status === "cancelled") return "cancelled";
  if (isPastDue(m.dueDate, ctx.today)) return "overdue";
  if (m.status === "waiting") return "waiting";
  if (m.status === "not_started" && ctx.inCurrentWeek && ctx.weekWarningActive) return "warn";
  if (m.status === "in_progress") return "progress";
  return "idle";
}

/** משימה פעילה = נספרת בהתקדמות. מבוטלת ומחוקה לוגית יוצאות מהמכנה. */
export function isActiveMilestone(m: Milestone): boolean {
  return !m.deletedAt && m.status !== "cancelled";
}

/** משימה פתוחה = זמינה לבחירה לתקופה הבאה. מה שהושלם או בוטל נעלם מרשימות הבחירה. */
export function isOpenMilestone(m: Milestone): boolean {
  return isActiveMilestone(m) && m.status !== "done";
}

export type ProgressState = "empty" | "open" | "progress" | "done";

export type Progress = {
  /** אבני דרך פעילות (ללא מבוטלות) */
  total: number;
  done: number;
  percent: number;
  state: ProgressState;
  /** כמה מבוטלות סוננו החוצה - מוצג כהערת שוליים ולא נספר */
  cancelled: number;
};

/**
 * אחוז ההתקדמות = הושלמו / פעילות (ללא מבוטלות). תת-סלע/סלע נחשב "הושלם" רק כאשר
 * **כל** הפעילות הושלמו **וקיימת לפחות אחת** - כך שתת-סלע ריק לעולם לא מתחזה להושלם.
 */
export function computeProgress(milestones: Milestone[]): Progress {
  const active = milestones.filter(isActiveMilestone);
  const cancelled = milestones.filter((m) => !m.deletedAt && m.status === "cancelled").length;
  const total = active.length;
  const done = active.filter((m) => m.status === "done").length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const state: ProgressState = total === 0 ? "empty" : done === total ? "done" : done > 0 ? "progress" : "open";
  return { total, done, percent, state, cancelled };
}

/**
 * תג האזהרה של תת-סלע (סעיף 9): מגיע **רק** אם יש בו אבני דרך שנבחרו לתקופה הרלוונטית
 * ואף אחת מהן לא התחילה, או אם יש בו אבן דרך שעברה את היעד. סלע מציג סיכום של ילדיו
 * ואינו מקבל צבע עצמאי ידני.
 */
export function rockWarning(
  milestones: Milestone[],
  ctx: { today: string; selectedIds?: Set<string>; weekWarningActive?: boolean }
): "none" | "overdue" | "warn" {
  const active = milestones.filter(isActiveMilestone);
  if (active.some((m) => m.status !== "done" && isPastDue(m.dueDate, ctx.today))) return "overdue";
  if (!ctx.weekWarningActive || !ctx.selectedIds?.size) return "none";
  const selected = active.filter((m) => ctx.selectedIds?.has(m.id));
  if (selected.length > 0 && selected.every((m) => m.status === "not_started")) return "warn";
  return "none";
}

// --- שיוכי תקופה ---

/** מזהה דטרמיניסטי לשיוך - הוא שאוכף "אבן דרך אחת לכל תקופה" ברמת בסיס הנתונים. */
export function assignmentId(milestoneId: string, periodType: PeriodType, periodKey: string): string {
  return `${milestoneId}__${periodType}__${periodKey}`;
}

/** אינדקס מהיר: אילו אבני דרך משויכות לתקופה מסוימת. */
export function milestoneIdsInPeriod(assignments: PeriodAssignment[], periodType: PeriodType, periodKey: string): Set<string> {
  return new Set(
    assignments.filter((a) => a.periodType === periodType && a.periodKey === periodKey).map((a) => a.milestoneId)
  );
}

/** כל השיוכים של אבן דרך, ממוינים מהחדש לישן - להצגה בחלונית הצד. */
export function assignmentsOf(assignments: PeriodAssignment[], milestoneId: string): PeriodAssignment[] {
  return assignments.filter((a) => a.milestoneId === milestoneId).sort((a, b) => b.assignedAt - a.assignedAt);
}
