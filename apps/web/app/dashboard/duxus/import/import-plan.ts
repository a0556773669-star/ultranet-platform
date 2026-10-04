// ====================================================================
// מנוע הייבוא: הופך את `source-data.ts` לתוכנית כתיבה מלאה.
//
// המודול הזה **טהור** - הוא לא נוגע ב-Firestore ולא תלוי בו. לכן אפשר להריץ
// עליו dry-run מלא, לספור, לאמת ולהשוות מול המקור בלי לגעת בדאטה אמיתי.
// ====================================================================

import type { AssignmentOutcome, MilestoneStatus, PeriodType, RockStatus } from "@ultranet/shared-types";
import {
  currentMonthKey,
  currentWeekKey,
  shiftMonthKey,
  shiftWeekKey,
  weekRangeIso,
} from "../rocks/date-utils";
import { ACTIVE_PERIODS, MILESTONES, ROCKS, type Mark, type PeriodTag, type SourceMilestone } from "./source-data";

/** מזהה האצווה - קבוע, וזה מה שהופך את הייבוא ל-idempotent. */
export const IMPORT_BATCH = "quarter_1_legacy_import";

/** מפתח הרבעון קבוע כדי שהרצה חוזרת תעדכן את אותו רבעון ולא תיצור חדש. */
export const QUARTER_KEY = "q_quarter_1_legacy";

export const QUARTER_LABEL = "רבעון 1";

/** סדר התקופות מהמוקדמת למאוחרת - קובע מהי "התקופה האחרונה" של כל אבן דרך. */
const PERIOD_ORDER: PeriodTag[] = ["Q", "M1", "M1W1", "M1W2", "M1W3", "M1W4", "M2", "M2W1"];

export type PeriodMap = Record<PeriodTag, { type: PeriodType; key: string; closed: boolean; endsAt: number }>;

/**
 * מיפוי תקופות המקור למפתחות האמיתיים של המודול:
 * חודש 2 = החודש הקלנדרי הנוכחי, שבוע 1 שלו = השבוע הנוכחי, וחודש 1 והשבועות
 * שלפניו נספרים אחורה. כך "חודש 2 ושבוע 1 פעילים" יוצא נכון בלי לנחש תאריכים עבריים.
 */
export function buildPeriodMap(now: Date): PeriodMap {
  const m2 = currentMonthKey(now);
  const m1 = shiftMonthKey(m2, -1);
  const w = currentWeekKey(now);

  const monthEnd = (key: string) => {
    const [y, mo] = key.split("-").map(Number);
    return Date.UTC(y as number, mo as number, 0, 23, 59, 59);
  };
  const weekEnd = (key: string) => new Date(`${weekRangeIso(key).end}T23:59:59Z`).getTime();

  return {
    // הרבעון עצמו אינו שיוך נפרד: אבן דרך שייכת לרבעון דרך הסלע שלה.
    Q: { type: "quarter", key: QUARTER_KEY, closed: false, endsAt: 0 },
    M1: { type: "month", key: m1, closed: true, endsAt: monthEnd(m1) },
    M1W1: { type: "week", key: shiftWeekKey(w, -4), closed: true, endsAt: weekEnd(shiftWeekKey(w, -4)) },
    M1W2: { type: "week", key: shiftWeekKey(w, -3), closed: true, endsAt: weekEnd(shiftWeekKey(w, -3)) },
    M1W3: { type: "week", key: shiftWeekKey(w, -2), closed: true, endsAt: weekEnd(shiftWeekKey(w, -2)) },
    M1W4: { type: "week", key: shiftWeekKey(w, -1), closed: true, endsAt: weekEnd(shiftWeekKey(w, -1)) },
    M2: { type: "month", key: m2, closed: false, endsAt: monthEnd(m2) },
    M2W1: { type: "week", key: w, closed: false, endsAt: weekEnd(w) },
  };
}

export type PlannedRock = {
  importKey: string;
  parentImportKey: string | null;
  title: string;
  description: string;
  ownerName: string;
  status: RockStatus;
  order: number;
};

export type PlannedMilestone = {
  importKey: string;
  rockImportKey: string;
  title: string;
  description: string;
  notes: string;
  ownerName: string;
  status: MilestoneStatus;
  doneAt: number;
  origin: "quarter" | "month" | "week";
  /** כמה פעמים שובצה מחדש בלי להסתיים - נגזר ממספר התקופות שבהן הופיעה */
  carryOverCount: number;
  order: number;
};

export type PlannedAssignment = {
  milestoneImportKey: string;
  periodType: PeriodType;
  periodKey: string;
  outcome: AssignmentOutcome;
  assignedAt: number;
  closedAt: number;
};

export type ReviewItem = { key: string; title: string; reason: string };

export type ImportPlan = {
  batch: string;
  quarterKey: string;
  quarterLabel: string;
  periods: PeriodMap;
  activeMonthKey: string;
  activeWeekKey: string;
  rocks: PlannedRock[];
  milestones: PlannedMilestone[];
  assignments: PlannedAssignment[];
  review: ReviewItem[];
  warnings: string[];
  stats: {
    rocks: number;
    subRocks: number;
    milestones: number;
    assignments: number;
    sourceRows: number;
    mergedDuplicates: number;
    done: number;
    open: number;
    inMonth2: number;
    inWeek1: number;
    openInMonth2: number;
    openInWeek1: number;
    monthOnlyNotInWeek: number;
    /** אבני דרך שלא שובצו לאף חודש/שבוע - פתוחות ברבעון וזמינות לבחירה */
    quarterBacklog: number;
    /** שובצו רק בתקופות סגורות - היסטוריה בלבד */
    historyOnly: number;
    reopened: number;
  };
};

/** השבועות של כל חודש - שבוע תמיד יושב בתוך חודש, ולכן שיוך שבוע גורר שיוך חודש. */
const WEEKS_OF_MONTH: Record<"M1" | "M2", PeriodTag[]> = {
  M1: ["M1W1", "M1W2", "M1W3", "M1W4"],
  M2: ["M2W1"],
};

const MONTH_OF_WEEK: Partial<Record<PeriodTag, PeriodTag>> = {
  M1W1: "M1",
  M1W2: "M1",
  M1W3: "M1",
  M1W4: "M1",
  M2W1: "M2",
};

/** משלימה את שיוך החודש לכל שבוע שנבחר, בסדר כרונולוגי יציב. */
function withParentMonths(tags: PeriodTag[]): PeriodTag[] {
  const set = new Set(tags);
  tags.forEach((t) => {
    const month = MONTH_OF_WEEK[t];
    if (month) set.add(month);
  });
  return PERIOD_ORDER.filter((t) => t !== "Q" && set.has(t));
}

/** תוצאת שיוך חודש שנגזר משבועותיו: הושלם אם הושלם באחד מהם. */
function derivedMonthMark(ms: SourceMilestone, tag: PeriodTag): Mark {
  const weeks = WEEKS_OF_MONTH[tag as "M1" | "M2"] ?? [];
  return weeks.some((w) => ms.marks[w] === "done") ? "done" : "open";
}

/** התקופה המאוחרת ביותר שבה אבן הדרך הופיעה - היא שקובעת את הסטטוס הנוכחי. */
function latestPeriod(ms: SourceMilestone): { tag: PeriodTag; mark: Mark } | null {
  for (let i = PERIOD_ORDER.length - 1; i >= 0; i -= 1) {
    const tag = PERIOD_ORDER[i] as PeriodTag;
    const mark = ms.marks[tag];
    if (mark) return { tag, mark };
  }
  return null;
}

function originOf(ms: SourceMilestone): "quarter" | "month" | "week" {
  if (ms.marks.Q) return "quarter";
  if (ms.marks.M1 || ms.marks.M2) return "month";
  return "week";
}

/**
 * בונה את תוכנית הייבוא המלאה. הפונקציה דטרמיניסטית ביחס ל-`now`: אותו קלט תמיד
 * מייצר את אותה תוכנית, וזה מה שמאפשר להשוות dry-run להרצה בפועל.
 */
export function buildImportPlan(now: Date = new Date()): ImportPlan {
  const periods = buildPeriodMap(now);
  const warnings: string[] = [];
  const review: ReviewItem[] = [];

  // סדר יציב ולא תלוי בשעת ההרצה, כדי שהרצה חוזרת לא תשנה מיון.
  const baseOrder = periods.M1.endsAt;

  const rockIndex = new Map(ROCKS.map((r) => [r.key, r]));
  const rocks: PlannedRock[] = ROCKS.map((r, i) => ({
    importKey: r.key,
    parentImportKey: r.parent ?? null,
    title: r.title,
    description: r.description ?? "",
    ownerName: r.owner ?? "",
    status: "active",
    order: baseOrder + i,
  }));

  const seenKeys = new Set<string>();
  const milestones: PlannedMilestone[] = [];
  const assignments: PlannedAssignment[] = [];
  let sourceRows = 0;
  let reopened = 0;

  MILESTONES.forEach((ms, i) => {
    if (seenKeys.has(ms.key)) {
      warnings.push(`מפתח כפול בנתוני המקור: ${ms.key}`);
      return;
    }
    seenKeys.add(ms.key);
    if (!rockIndex.has(ms.sub)) {
      warnings.push(`אבן הדרך "${ms.title}" מפנה לתת-סלע לא מוכר: ${ms.sub}`);
      return;
    }

    const tags = PERIOD_ORDER.filter((t) => ms.marks[t]);
    sourceRows += tags.length;

    const latest = latestPeriod(ms);
    let status: MilestoneStatus = latest?.mark === "done" ? "done" : "not_started";
    let doneAt = 0;
    const notes: string[] = ms.notes ? [ms.notes] : [];

    if (status === "done") {
      // תאריך ההשלמה = סוף התקופה האחרונה שבה סומנה, כדי שההיסטוריה תהיה במקום הנכון.
      doneAt = periods[latest!.tag].endsAt || periods.M1.endsAt;
    }

    // הושלמה בתקופה סגורה אך חוזרת פתוחה בתקופה פעילה - פתיחה מחדש או ביצוע מחזורי.
    const doneWhenClosed = tags.some((t) => periods[t].closed && ms.marks[t] === "done");
    const openWhenActive = ACTIVE_PERIODS.some((t) => ms.marks[t] === "open");
    if (doneWhenClosed && openWhenActive && status !== "done") {
      reopened += 1;
      notes.push("הושלמה בתקופה קודמת ומופיעה שוב כפתוחה");
      review.push({ key: ms.key, title: ms.title, reason: "הושלמה בעבר ומופיעה שוב כפתוחה - לאשר אם זו פתיחה מחדש או ביצוע מחזורי" });
    }

    if (ms.review) review.push({ key: ms.key, title: ms.title, reason: ms.review });
    if (ms.ownerNote) notes.push(`אחריות: ${ms.ownerNote}`);

    // שבוע תמיד יושב בתוך חודש: אבן דרך שהופיעה בשבוע מקבלת גם את שיוך החודש שלו,
    // גם אם המקור לא חזר עליה ברשימה החודשית. בלי זה משימת שבוע לא הייתה מופיעה
    // בהקשר של החודש (בדיקת קבלה: "משימות שבוע 1 מופיעות גם בהקשר של חודש 2").
    const explicit = tags.filter((t) => t !== "Q");
    const periodTags = withParentMonths(explicit);
    const carryOverCount = Math.max(0, explicit.length - 1);

    milestones.push({
      importKey: ms.key,
      rockImportKey: ms.sub,
      title: ms.title,
      description: ms.description ?? "",
      notes: notes.join(" · "),
      ownerName: ms.owner ?? "",
      status,
      doneAt,
      origin: originOf(ms),
      carryOverCount,
      order: baseOrder + i,
    });

    periodTags.forEach((tag) => {
      const period = periods[tag];
      // שיוך חודש שנגזר משבוע יורש את התוצאה: הושלם אם הושלם באחד משבועות אותו חודש.
      const mark: Mark = ms.marks[tag] ?? (derivedMonthMark(ms, tag) as Mark);
      const outcome: AssignmentOutcome = !period.closed ? "open" : mark === "done" ? "done" : "missed";
      assignments.push({
        milestoneImportKey: ms.key,
        periodType: period.type,
        periodKey: period.key,
        outcome,
        assignedAt: period.endsAt,
        closedAt: period.closed ? period.endsAt : 0,
      });
    });
  });

  // מצב הסלע מחושב מאבני הדרך שתחתיו - בדיוק ככלל של המודול (סעיף 6).
  const byRock = new Map<string, PlannedMilestone[]>();
  milestones.forEach((ms) => byRock.set(ms.rockImportKey, [...(byRock.get(ms.rockImportKey) ?? []), ms]));
  const descendants = (key: string): PlannedMilestone[] => [
    ...(byRock.get(key) ?? []),
    ...rocks.filter((r) => r.parentImportKey === key).flatMap((r) => descendants(r.importKey)),
  ];
  rocks.forEach((r) => {
    const own = descendants(r.importKey).filter((ms) => ms.status !== "cancelled");
    r.status = own.length > 0 && own.every((ms) => ms.status === "done") ? "done" : "active";
  });

  const m2Ids = new Set(assignments.filter((a) => a.periodKey === periods.M2.key).map((a) => a.milestoneImportKey));
  const w1Ids = new Set(assignments.filter((a) => a.periodKey === periods.M2W1.key).map((a) => a.milestoneImportKey));
  const statusOf = new Map(milestones.map((ms) => [ms.importKey, ms.status]));
  const assignedIds = new Set(assignments.map((a) => a.milestoneImportKey));

  const stats: ImportPlan["stats"] = {
    rocks: rocks.filter((r) => !r.parentImportKey).length,
    subRocks: rocks.filter((r) => r.parentImportKey).length,
    milestones: milestones.length,
    assignments: assignments.length,
    sourceRows,
    mergedDuplicates: sourceRows - milestones.length,
    done: milestones.filter((ms) => ms.status === "done").length,
    open: milestones.filter((ms) => ms.status !== "done").length,
    inMonth2: m2Ids.size,
    inWeek1: w1Ids.size,
    openInMonth2: [...m2Ids].filter((k) => statusOf.get(k) !== "done").length,
    openInWeek1: [...w1Ids].filter((k) => statusOf.get(k) !== "done").length,
    monthOnlyNotInWeek: [...m2Ids].filter((k) => !w1Ids.has(k)).length,
    quarterBacklog: milestones.filter((ms) => !assignedIds.has(ms.importKey)).length,
    historyOnly: milestones.filter((ms) => assignedIds.has(ms.importKey) && !m2Ids.has(ms.importKey) && !w1Ids.has(ms.importKey)).length,
    reopened,
  };

  return {
    batch: IMPORT_BATCH,
    quarterKey: QUARTER_KEY,
    quarterLabel: QUARTER_LABEL,
    periods,
    activeMonthKey: periods.M2.key,
    activeWeekKey: periods.M2W1.key,
    rocks,
    milestones,
    assignments,
    review,
    warnings,
    stats,
  };
}
