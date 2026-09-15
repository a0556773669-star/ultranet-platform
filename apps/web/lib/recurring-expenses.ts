/**
 * הוצאות קבועות משתנות (`n_recurring_var_expenses`).
 *
 * חשמל הוא הוצאה קבועה - הוא חוזר כל חודש, לנצח, ורוצים לראות אותו כשורה אחת לאורך שנה.
 * חשמל הוא גם הוצאה משתנה - הסכום אחר כל חודש. שתי המערכות הקיימות לא ידעו להחזיק את
 * שני הדברים יחד: `n_fixed_expenses` הניחה סכום אחד לתמיד, ו-`n_var_expenses` הניחה
 * אירוע חד-פעמי בלי המשך. התוצאה הייתה שחשמל נרשם כשורה נפרדת בכל חודש ואי אפשר היה
 * לעקוב אחריו.
 *
 * כאן זו שורה אחת עם סכום לכל חודש. חודש בלי סכום הוא לא אפס - הוא "עוד לא עודכן",
 * וזה מה שהתזכורת החודשית מחפשת (`missingMonths`). ההבחנה הזו היא כל התועלת של המודול:
 * "לא שילמתי חשמל" ו"לא רשמתי כמה שילמתי" הן שתי אמירות שונות לחלוטין.
 *
 * שני צירים נוספים, ושניהם נגזרים מ-`frequency`:
 *
 * 1. **מתי נדרש תשלום** (`dueMonths`). ארנונה דו-חודשית נדרשת בחודש מספר 1, 3, 5 - לא בכל
 *    חודש. התראה על חודש שבו אין מה לשלם היא רעש, ורעש מלמד להתעלם מההתראות.
 * 2. **על איזה חודש העלות נופלת** (`monthlyAllocation`). ביטוח שנתי של 12,000 ₪ הוא 12,000 ₪
 *    במזומן בינואר אבל 1,000 ₪ עלות בכל חודש. בלי פריסה ינואר נראה חודש אסון ושאר השנה
 *    נראית זולה מכפי שהיא, ואי אפשר להשוות חודש לחודש. שני המספרים אמיתיים ולכן שניהם
 *    נשמרים: `totalToDate` הוא מה ששולם, `monthlyAllocation` הוא מה שנעלה.
 */
import { getAdminFirestore } from "./firebase-admin";
import type {
  ExpenseScope,
  RecurringFrequency,
  RecurringVariableExpense,
  RecurringVariableAmount,
} from "@ultranet/shared-types";
import { RECURRING_FREQUENCY_MONTHS } from "@ultranet/shared-types";
import { monthsBetween } from "./branch-accounting";

export const RECURRING_VAR_EXPENSES_COLLECTION = "n_recurring_var_expenses";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 10).slice(0, 7);
}

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  monthly: "חודשי",
  bimonthly: "דו-חודשי",
  quarterly: "רבעוני",
  yearly: "שנתי",
};

/** רשומות שנכתבו לפני שהשדה קיים הן חודשיות - זו הייתה ההתנהגות היחידה שהייתה להן. */
export function frequencyOf(expense: Pick<RecurringVariableExpense, "frequency">): RecurringFrequency {
  return expense.frequency ?? "monthly";
}

/** אורך המחזור בחודשים: כל כמה חודשים מגיע תשלום, ועל פני כמה חודשים הוא נפרס. */
export function cycleMonths(expense: Pick<RecurringVariableExpense, "frequency">): number {
  return RECURRING_FREQUENCY_MONTHS[frequencyOf(expense)];
}

/**
 * האם לפרוס את התשלום על פני חודשי המחזור. ברירת המחדל לתדירות רב-חודשית היא כן, כי זו
 * הסיבה היחידה שמישהו מגדיר תדירות שנתית מלכתחילה. במחזור של חודש אין מה לפרוס.
 */
export function isSpread(expense: Pick<RecurringVariableExpense, "frequency" | "spread">): boolean {
  return cycleMonths(expense) > 1 && expense.spread !== false;
}

/** החודש האחרון שרלוונטי להוצאה: היום, או חודש ההפסקה אם הוא מוקדם יותר. */
function lastRelevantMonth(expense: RecurringVariableExpense, upto: string): string {
  const end = expense.endDate?.slice(0, 7);
  return end && end < upto ? end : upto;
}

/**
 * החודשים שבהם באמת מגיע תשלום, מחודש ההתחלה והלאה בקפיצות של `cycleMonths`.
 * זו רשימת החודשים שהמערכת מבקשת עליהם סכום - ורק עליהם.
 */
export function dueMonths(expense: RecurringVariableExpense, upto = currentMonth()): string[] {
  if (!expense.startDate) return [];
  const start = expense.startDate.slice(0, 7);
  const end = lastRelevantMonth(expense, upto);
  if (end < start) return [];
  const step = cycleMonths(expense);
  return monthsBetween(start, end).filter((_, i) => i % step === 0);
}

/**
 * כל החודשים שההוצאה נוגעת בהם - כולל חודשים שאין בהם תשלום אבל יש בהם עלות פרוסה.
 * זה מה שקובע את רוחב הטבלה, ולכן הוא רחב יותר מ-`dueMonths` בכוונה.
 */
export function coveredMonths(expense: RecurringVariableExpense, upto = currentMonth()): string[] {
  if (!expense.startDate) return [];
  const start = expense.startDate.slice(0, 7);
  const end = lastRelevantMonth(expense, upto);
  if (end < start) return [];
  return monthsBetween(start, end);
}

/**
 * שם היסטורי שנשאר מפני שהוא קריא במקום שבו הוא נקרא ("החודשים שמצפים להם סכום").
 * מאז הוספת התדירות זו בדיוק `dueMonths`.
 */
export const expectedMonths = dueMonths;

export function amountForMonth(expense: RecurringVariableExpense, month: string): number | null {
  const hit = (expense.amounts ?? []).find((a) => a.month === month);
  return hit ? hit.amount : null;
}

/** החודשים שעדיין לא הוזן להם סכום. זו רשימת התזכורות, ולכן היא הפלט המרכזי של המודול. */
export function missingMonths(expense: RecurringVariableExpense, upto = currentMonth()): string[] {
  const have = new Set((expense.amounts ?? []).map((a) => a.month));
  return dueMonths(expense, upto).filter((m) => !have.has(m));
}

/** סה"כ מה שנרשם בפועל על ההוצאה הזו עד היום. חודשים שלא עודכנו פשוט לא נספרים. */
export function totalToDate(expense: RecurringVariableExpense, upto = currentMonth()): number {
  return (expense.amounts ?? [])
    .filter((a) => a.month <= upto)
    .reduce((sum, a) => sum + (a.amount || 0), 0);
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * העלות החודשית: לכל חודש, כמה מההוצאה הזו נופל עליו.
 *
 * תשלום חודשי נופל כולו על החודש שלו. תשלום רב-חודשי פרוס מתחלק שווה בשווה על חודשי
 * המחזור שהוא משלם עליהם (מחודש התשלום והלאה). חודש שעדיין לא הגיע (`> upto`) לא נספר
 * גם אם כבר שולם עליו - הכסף יצא, אבל העלות שייכת לחודש שלה.
 */
export function monthlyAllocation(
  expense: RecurringVariableExpense,
  upto = currentMonth(),
): Map<string, number> {
  const out = new Map<string, number>();
  const step = isSpread(expense) ? cycleMonths(expense) : 1;
  const end = lastRelevantMonth(expense, upto);
  for (const a of expense.amounts ?? []) {
    if (a.month > upto) continue;
    const share = (a.amount || 0) / step;
    for (let i = 0; i < step; i += 1) {
      const month = addMonths(a.month, i);
      // חודש התשלום עצמו נספר תמיד, גם אם הוא אחרי `endDate`: כסף שיצא לא מתאדה מהספר
      // רק מפני שההוצאה כבר הופסקה. מה שנחתך הוא רק המשך הפריסה קדימה.
      if (i > 0 && month > end) break;
      out.set(month, (out.get(month) ?? 0) + share);
    }
  }
  return out;
}

/** כמה מההוצאה נופל על חודש מסוים, אחרי פריסה. `0` = כלום. */
export function allocationForMonth(
  expense: RecurringVariableExpense,
  month: string,
  upto = currentMonth(),
): number {
  return monthlyAllocation(expense, upto).get(month) ?? 0;
}

export interface RecurringReminder {
  expense: RecurringVariableExpense;
  missing: string[];
  /** החודש הכי ישן שחסר - זה מה שמציגים בהתראה */
  oldestMissing: string;
  suggestedAmount: number;
  /** האם החודש הנוכחי הוא אחד מהחסרים - זו התזכורת "שלם את זה עכשיו" */
  dueNow: boolean;
  /** חסרים שאינם החודש הנוכחי: היסטוריה שלא הושלמה */
  overdue: number;
}

/**
 * ההתראות שצריך להציג היום: כל הוצאה קבועה משתנה שחסר לה חודש אחד או יותר.
 * הסכום המוצע הוא הסכום האחרון שנרשם, ובהיעדרו `defaultAmount` - כי בפועל אף אחד לא
 * מקליד את חשבון החשמל מאפס, הוא מתקן את של החודש שעבר.
 */
export function buildReminders(expenses: RecurringVariableExpense[], upto = currentMonth()): RecurringReminder[] {
  const out: RecurringReminder[] = [];
  for (const expense of expenses) {
    const missing = missingMonths(expense, upto);
    if (missing.length === 0) continue;
    const latest = (expense.amounts ?? [])
      .slice()
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    out.push({
      expense,
      missing,
      oldestMissing: missing[0]!,
      suggestedAmount: latest?.amount ?? expense.defaultAmount ?? 0,
      dueNow: missing.includes(upto),
      overdue: missing.filter((m) => m !== upto).length,
    });
  }
  return out.sort((a, b) => a.oldestMissing.localeCompare(b.oldestMissing));
}

export async function loadRecurringVariableExpenses(params?: {
  scope?: ExpenseScope;
  branchId?: string;
}): Promise<RecurringVariableExpense[]> {
  const snap = await getAdminFirestore().collection(RECURRING_VAR_EXPENSES_COLLECTION).get();
  let rows = snap.docs.map(
    (d) => ({ ...(d.data() as Omit<RecurringVariableExpense, "id">), id: d.id }) as RecurringVariableExpense,
  );
  if (params?.scope) rows = rows.filter((r) => r.scope === params.scope);
  if (params?.branchId !== undefined) rows = rows.filter((r) => (r.branchId ?? "") === params.branchId);
  return rows
    .map((r) => ({ ...r, amounts: [...(r.amounts ?? [])].sort((a, b) => b.month.localeCompare(a.month)) }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

/** כותב/מעדכן סכום לחודש אחד. הכתיבה היא upsert לפי חודש - אין שתי שורות לאותו חודש. */
export function upsertAmount(
  amounts: RecurringVariableAmount[] | undefined,
  entry: RecurringVariableAmount,
): RecurringVariableAmount[] {
  const rest = (amounts ?? []).filter((a) => a.month !== entry.month);
  return [...rest, entry].sort((a, b) => b.month.localeCompare(a.month));
}
