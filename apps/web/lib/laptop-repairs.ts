/**
 * תקופות תיקון של מחשבים ניידים (`n_laptop_repairs`) — מודול טהור (בלי firebase-admin), נצרך גם
 * ע"י רכיבי לקוח. ראו `LaptopRepair` ב-shared-types וסעיף "מחשב בתיקון" ב-SPEC.
 *
 * תקופה **פתוחה** = אין לה `to`. אם בטעות קיימות כמה תקופות פתוחות לאותו מחשב (לא אמור לקרות —
 * הפתיחה בודקת), המחשב בתיקון מהמוקדמת שבהן.
 */
import type { LaptopRepair } from "@ultranet/shared-types";

export const LAPTOP_REPAIRS_COLLECTION = "n_laptop_repairs";

export function isRepairOpen(r: Pick<LaptopRepair, "to">): boolean {
  return !r.to;
}

/** הפרש ימים קלנדריים בין שני תאריכי YYYY-MM-DD (b - a), בלי תלות באזור זמן. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 0;
}

/**
 * כמה ימים המחשב בתיקון. תקופה פתוחה נמדדת עד `today`; סגורה — עד `to`. יום היציאה ויום החזרה
 * לא נספרים שניהם: יצא ב-10 וחזר ב-15 = 5 ימים (אותו גבול יום כמו ב-`equivalent-computers.ts`).
 */
export function repairDays(r: Pick<LaptopRepair, "from" | "to">, today: string): number {
  return Math.max(0, daysBetween(r.from, r.to ?? today));
}

/** "4 ימים" / "יום אחד" / "מהיום" (תקופה פתוחה שנפתחה היום). */
export function repairDaysText(r: Pick<LaptopRepair, "from" | "to">, today: string): string {
  const d = repairDays(r, today);
  if (d === 0) return r.to ? "פחות מיום" : "מהיום";
  if (d === 1) return "יום אחד";
  return `${d} ימים`;
}

/** "בתיקון · 4 ימים". */
export function repairLabel(r: Pick<LaptopRepair, "from" | "to">, today: string): string {
  return `בתיקון · ${repairDaysText(r, today)}`;
}

/** התקופה הפתוחה (אם יש) לכל מחשב. */
export function openRepairsByLaptop<T extends Pick<LaptopRepair, "laptopId" | "from" | "to">>(
  repairs: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const r of repairs) {
    if (!isRepairOpen(r)) continue;
    const prev = map.get(r.laptopId);
    if (!prev || r.from < prev.from) map.set(r.laptopId, r);
  }
  return map;
}
