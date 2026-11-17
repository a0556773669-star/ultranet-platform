/**
 * תמחור "חנות סניפים" (שלב א', בלי מלאי): אין לנו עדיין מחשבים במלאי, ולכן המחיר שמנהל הסניף
 * מקבל הוא **טווח הערכה** שנגזר ממחיר השוק, ולא מחיר סופי. הבעלים/המזכירה בודקים התאמה אמיתית
 * ומעדכנים את הלקוח.
 *
 * הכלל (מהבעלים): סוקרים את השוק, מתעלמים ממחירים חריגים (למשל 1,000 או 2,000 כשכולם ב-1,600),
 * לוקחים את הממוצע **הנמוך**, ומוסיפים 300-500 ₪ מרווח לעסק.
 */
export const STORE_MARKUP_MIN_ILS = 300;
export const STORE_MARKUP_MAX_ILS = 500;

export function quotedRange(marketLowILS: number): { from: number; to: number } {
  return { from: marketLowILS + STORE_MARKUP_MIN_ILS, to: marketLowILS + STORE_MARKUP_MAX_ILS };
}

/** עיגול לעשרות שקלים - טווח מוצג ללקוח לא צריך להיראות כמו חישוב מדויק. */
export function roundTen(n: number): number {
  return Math.round(n / 10) * 10;
}
