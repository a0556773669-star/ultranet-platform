/**
 * הכלל היחיד של ההנה"ח הראשית, במקום אחד.
 *
 * `countsToMain` הוא השדה שמחליט אם שקל מסוים נכנס לסה"כ ב-`/dashboard/accounting`.
 * הוא לא נגזר משום דבר אחר - לא ממי שילם, לא מסוג הסניף, לא מהקטגוריה - וזו כל הנקודה:
 * כשהתשובה נגזרה, כל מסך גזר אותה אחרת. ראה `COUNTS_TO_MAIN_DOC` ב-`@ultranet/shared-types`.
 *
 * המודול הזה טהור בכוונה (אין בו firebase): גם טפסי הלקוח מייבאים ממנו את התוויות, כדי
 * שהניסוח שהמשתמש רואה בצ'קבוקס יהיה בדיוק הניסוח שהמסך הראשי מסביר בו את עצמו.
 */

/** קורא את הדגל מכל רשומה שיש עליה אותו. `undefined` = לא מתחשבן (ראה הדוק בטיפוסים). */
export function countsToMain(row: { countsToMain?: boolean } | null | undefined): boolean {
  return row?.countsToMain === true;
}

/** קורא את הדגל מ-FormData של טופס. checkbox לא מסומן פשוט לא נשלח. */
export function countsToMainFromForm(formData: FormData, field = "countsToMain"): boolean {
  const raw = formData.get(field);
  return raw === "on" || raw === "true" || raw === "1";
}

export const COUNTS_TO_MAIN_LABEL = 'לחשבן בהנה"ח הראשית';

export const COUNTS_TO_MAIN_HINT =
  'מסומן — הסכום נכנס לסה"כ של ההנה"ח הראשית. לא מסומן — הוא נשאר בספר של הסניף/המודול בלבד.';

/** תווית קצרה לשורה ברשימה. */
export function countsToMainBadge(row: { countsToMain?: boolean } | null | undefined): string {
  return countsToMain(row) ? 'ראשי' : 'סניף בלבד';
}

/**
 * עלות הקמה של סניף — החריג היחיד לכלל "`undefined` = לא מתחשבן".
 *
 * הבעלים ביקש שעלויות ההקמה ייכנסו להנה"ח הראשית, ועלות הקמה אינה "שורה שמישהו הזין"
 * אלא שדה אחד לסניף שגלוי בטופס. לכן ברירת המחדל כאן דלוקה, והצ'קבוקס בחלון הפירוט
 * משמש להחריג סניף מסוים - לא לצרף אותו. הכלל חי כאן ולא במסך, בדיוק כמו אחיו למעלה.
 */
export function setupCostCountsToMain(branch: { setupCountsToMain?: boolean } | null | undefined): boolean {
  return branch?.setupCountsToMain !== false;
}

/** קורא את הדגל מטופס הסניף. `SetupCostField` שולח אותו תמיד כ-"true"/"false" מפורש. */
export function setupCostCountsToMainFromForm(formData: FormData): boolean | undefined {
  const raw = formData.get("setupCountsToMain");
  if (raw === null) return undefined;
  return raw !== "false";
}
