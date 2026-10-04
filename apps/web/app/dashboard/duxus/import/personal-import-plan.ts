// ====================================================================
// מנוע הייבוא של "משימות ליוני". טהור לחלוטין - אינו נוגע ב-Firestore, ולכן
// אפשר להריץ עליו dry-run מלא ולאמת אותו בלי דאטה אמיתי.
//
// המנוע הזה **אינו נוגע בסלעים, בתתי-סלעים, באבני דרך או ברבעון.** הטאב האישי
// הוא מנגנון נפרד לגמרי, והייבוא הזה כותב רק ל-`n_personal_tasks` ולהערות שלו.
// ====================================================================

import type { PersonalTaskPriority, PersonalTaskStatus } from "@ultranet/shared-types";
import { ACTIVE_TASKS, COMPLETED_TASKS, type SourcePersonalTask } from "./personal-source-data";

/** מזהה האצווה - קבוע, וזה מה שהופך את הייבוא ל-idempotent. */
export const PERSONAL_IMPORT_BATCH = "yoni_tasks_legacy_import_01";

/**
 * עוגן זמן קבוע לכל הרשומות המיובאות.
 *
 * **בכוונה אינו `Date.now()`**: אילו היה, כל הרצה הייתה משנה את סדר הרשימה.
 * בזכות העוגן הקבוע הרצה חוזרת מייצרת בדיוק את אותם ערכים.
 */
const BASE = Date.UTC(2026, 8, 1, 8, 0, 0); // 2026-09-01T08:00:00Z
const MINUTE = 60_000;
const HOUR = 3_600_000;

export type PlannedPersonalTask = {
  importKey: string;
  title: string;
  description: string;
  contactName: string;
  contactPhone: string;
  priority: PersonalTaskPriority;
  status: PersonalTaskStatus;
  /** קובע את מיקום המשימה ברשימה הפעילה (הוותיקה קודם) */
  createdAt: number;
  /** קובע את מיקום המשימה בהיסטוריה (האחרונה שהושלמה בראש) */
  completedAt: number | null;
  comments: string[];
  review: string;
};

export type PersonalReviewItem = { key: string; title: string; reason: string };

export type PersonalImportPlan = {
  batch: string;
  tasks: PlannedPersonalTask[];
  review: PersonalReviewItem[];
  warnings: string[];
  stats: {
    active: number;
    completed: number;
    total: number;
    urgent: number;
    normal: number;
    comments: number;
    withPhone: number;
    withContact: number;
    needsReview: number;
    /** איחודים שבוצעו כבר בתרגום המקור (מרקוביץ, משה חיים, ביתר, נייר) */
    mergedAtSource: number;
  };
};

/**
 * מספר האיחודים שבוצעו בתרגום המקור עצמו - ארבעה נושאים שבהם כמה הודעות על
 * אותו עניין הפכו למשימה אחת, והנוסחים המקוריים נשמרו כהערות.
 */
const MERGED_AT_SOURCE = ["markovich-kiryat-yovel", "moshe-haim-quantity", "beitar-purchase", "paper-stock"];

function planOne(src: SourcePersonalTask, status: PersonalTaskStatus, createdAt: number, completedAt: number | null): PlannedPersonalTask {
  return {
    importKey: src.key,
    title: src.title.trim(),
    description: src.description?.trim() ?? "",
    contactName: src.contactName?.trim() ?? "",
    contactPhone: src.contactPhone?.trim() ?? "",
    priority: src.priority,
    status,
    createdAt,
    completedAt,
    comments: (src.comments ?? []).map((c) => c.trim()).filter(Boolean),
    review: src.review?.trim() ?? "",
  };
}

/**
 * בונה את תוכנית הייבוא. דטרמיניסטית לחלוטין - אין בה תלות בשעת ההרצה, ולכן
 * שתי הרצות מייצרות תוכנית זהה בייט-בייט.
 */
export function buildPersonalImportPlan(): PersonalImportPlan {
  const warnings: string[] = [];
  const review: PersonalReviewItem[] = [];
  const seen = new Set<string>();
  const tasks: PlannedPersonalTask[] = [];

  // פעילות: `createdAt` עולה עם סדר המקור, כך שהמיון "הוותיקה קודם" משמר אותו.
  ACTIVE_TASKS.forEach((src, i) => {
    if (seen.has(src.key)) {
      warnings.push(`מפתח מקור כפול: ${src.key}`);
      return;
    }
    seen.add(src.key);
    tasks.push(planOne(src, "new", BASE + i * MINUTE, null));
  });

  // היסטוריות: `completedAt` יורד עם סדר המקור, כך שהמיון "האחרונה בראש" משמר אותו.
  COMPLETED_TASKS.forEach((src, i) => {
    if (seen.has(src.key)) {
      warnings.push(`מפתח מקור כפול: ${src.key}`);
      return;
    }
    seen.add(src.key);
    tasks.push(planOne(src, "done", BASE - (i + 1) * HOUR, BASE - i * MINUTE));
  });

  tasks.forEach((t) => {
    if (!t.title) warnings.push(`משימה ללא כותרת: ${t.importKey}`);
    if (t.review) review.push({ key: t.importKey, title: t.title, reason: t.review });
  });

  const active = tasks.filter((t) => t.status !== "done");
  const completed = tasks.filter((t) => t.status === "done");

  return {
    batch: PERSONAL_IMPORT_BATCH,
    tasks,
    review,
    warnings,
    stats: {
      active: active.length,
      completed: completed.length,
      total: tasks.length,
      urgent: tasks.filter((t) => t.priority === "urgent").length,
      normal: tasks.filter((t) => t.priority === "normal").length,
      comments: tasks.reduce((sum, t) => sum + t.comments.length, 0),
      withPhone: tasks.filter((t) => t.contactPhone).length,
      withContact: tasks.filter((t) => t.contactName).length,
      needsReview: review.length,
      mergedAtSource: MERGED_AT_SOURCE.length,
    },
  };
}

/** ספרות בלבד, להשוואת כפילויות - אותו כלל בדיוק כמו ב-`personal/actions.ts`. */
export function phoneKey(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** נרמול כותרת להשוואת כפילויות מול משימות שכבר קיימות בטאב. */
export function titleKey(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}
