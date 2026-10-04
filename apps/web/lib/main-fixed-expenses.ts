/**
 * הוצאות קבועות של העסק עצמו (`n_ah_fixed_expenses`).
 *
 * "הוצאות נוספות" הן ההוצאות שאינן של שום סניף, והיו בהן עד כה שני סוגים: רכישה
 * חד-פעמית (`n_ah_expenses`) והוצאה חוזרת שהסכום שלה משתנה כל חודש
 * (`n_recurring_var_expenses`, `scope: "main"`). הסוג השלישי — הוצאה שחוזרת כל חודש
 * ב**אותו** סכום, כמו שכירות המשרד או רואה החשבון — לא היה לו מקום, ולכן הוא נרשם
 * כרכישה חד-פעמית בכל חודש מחדש. זה בדיוק מה שהמודול הזה מחליף.
 *
 * הסמנטיקה זהה ל-`FixedExpense` של סניף (`fixedExpenseAccrued` ב-`lib/main-ledger.ts`):
 * הסכום החודשי נצבר מהחודש של `startDate` והלאה, והחודש הראשון נספר במלואו — זו הוצאה
 * חודשית ולא יומית, ופרורציה חלקית הייתה יוצרת שקלים שאף חשבונית לא מכירה. ההבדל
 * היחיד הוא שלרשומה כאן אין `branchId`: היא של העסק, ולכן היא גם לא יכולה להפוך
 * ל"שארית" כשסניף נמחק (`lib/leftovers.ts`).
 *
 * הספר הראשי מקבל מכאן **שורה לכל חודש** ולא שורה אחת מצטברת, בדיוק כמו הוצאה קבועה
 * משתנה: כך "כמה הוצאנו החודש" כולל את השכירות של החודש הזה, ולא רק את החודש שבו
 * ההוצאה נרשמה.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { AccountingFixedExpense } from "@ultranet/shared-types";
import { monthsBetween } from "./branch-accounting";

export const MAIN_FIXED_EXPENSES_COLLECTION = "n_ah_fixed_expenses";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

type AccrualFields = Pick<AccountingFixedExpense, "amount" | "startDate" | "endDate">;

/**
 * החודשים שההוצאה נספרת בהם — מחודש ההתחלה ועד החודש של `endDate` (כולל) או עד `upto`,
 * המוקדם מביניהם. הוצאה שתאריך ההתחלה שלה עתידי מחזירה רשימה ריקה.
 */
export function mainFixedExpenseMonths(e: AccrualFields, upto = currentMonth()): string[] {
  if (!e.startDate) return [];
  const start = e.startDate.slice(0, 7);
  if (start > upto) return [];
  const endMonth = e.endDate?.slice(0, 7);
  const end = endMonth && endMonth < upto ? endMonth : upto;
  if (end < start) return [];
  return monthsBetween(start, end);
}

/** מה שההוצאה עלתה מתחילתה ועד `upto` — הסכום החודשי כפול מספר החודשים שנספרו. */
export function mainFixedExpenseAccrued(e: AccrualFields, upto = currentMonth()): number {
  return (e.amount || 0) * mainFixedExpenseMonths(e, upto).length;
}

/** סך הסכום החודשי של ההוצאות שעוד פעילות בחודש `month`. */
export function mainFixedMonthlyTotal(expenses: AccrualFields[], month = currentMonth()): number {
  return expenses
    .filter((e) => mainFixedExpenseMonths(e, month).includes(month))
    .reduce((sum, e) => sum + (e.amount || 0), 0);
}

/** האם ההוצאה עוד פעילה (לא סומן לה תאריך סיום שעבר). */
export function isMainFixedExpenseActive(e: AccountingFixedExpense, upto = currentMonth()): boolean {
  return !e.endDate || e.endDate.slice(0, 7) >= upto;
}

export async function loadMainFixedExpenses(): Promise<AccountingFixedExpense[]> {
  const snap = await getAdminFirestore().collection(MAIN_FIXED_EXPENSES_COLLECTION).get();
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<AccountingFixedExpense, "id">), id: d.id }) as AccountingFixedExpense)
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
}
