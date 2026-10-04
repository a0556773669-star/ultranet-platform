import type { OpsScope, OpsTaskFreq } from "@ultranet/shared-types";

/**
 * העזרים ה"טהורים" של מודול התפעול — בלי `firebase-admin` ובלי `next-auth`.
 *
 * הפיצול הזה הוא הכרחי, לא סגנוני: `lib/operations.ts` מייבא `firebase-admin`,
 * וכל קומפוננטת `"use client"` שהייתה מייבאת ממנו הייתה גוררת אותו לבאנדל
 * הדפדפן ושוברת את ה-build. קומפוננטות לקוח מייבאות מכאן בלבד.
 */

/** סניף שהמשתמש רשאי לראות במודול התפעול */
export type OpsBranch = { id: string; name: string };

/**
 * מפתח החודש, `YYYY-MM`. זהו מנגנון האיפוס של עדכון המלאי: בכל ראשון לחודש
 * המפתח משתנה, המסמך של החודש החדש עוד לא קיים, וכל הסימונים חוזרים לריק.
 */
export function getMonthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** מפתח השבוע לפי ISO-8601 (שבוע שמתחיל ביום שני), `YYYY-Www`. */
export function getWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** התקופה הפעילה של משימה לפי תדירותה. */
export function periodKeyForFreq(freq: OpsTaskFreq, date: Date = new Date()): string {
  return freq === "weekly" ? getWeekKey(date) : getMonthKey(date);
}

/** מזהה מסמך דטרמיניסטי לרשומת סימון (סניף + תקופה), כדי שסימון יהיה upsert. */
export function checkDocId(branchId: string, periodKey: string): string {
  return `${branchId}__${periodKey}`;
}

/** תצוגה עברית של מפתח תקופה. */
export function formatPeriod(periodKey: string): string {
  const week = periodKey.match(/^(\d{4})-W(\d{2})$/);
  if (week) return `שבוע ${Number(week[2])}/${week[1]}`;
  const month = periodKey.match(/^(\d{4})-(\d{2})$/);
  if (month) return `${month[2]}/${month[1]}`;
  return periodKey;
}

/** האם פריט/משימה חלים על סניף מסוים. */
export function appliesToBranch(
  def: { scope: OpsScope; branchIds: string[] },
  branchId: string,
): boolean {
  return def.scope === "all" || def.branchIds.includes(branchId);
}
