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
 */
import { getAdminFirestore } from "./firebase-admin";
import type {
  ExpenseScope,
  RecurringVariableExpense,
  RecurringVariableAmount,
} from "@ultranet/shared-types";
import { monthsBetween } from "./branch-accounting";

export const RECURRING_VAR_EXPENSES_COLLECTION = "n_recurring_var_expenses";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 10).slice(0, 7);
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

/** כל החודשים שההוצאה אמורה להיות מעודכנת בהם, מהתחלה ועד היום (או ועד סיומה). */
export function expectedMonths(expense: RecurringVariableExpense, upto = currentMonth()): string[] {
  if (!expense.startDate) return [];
  const start = expense.startDate.slice(0, 7);
  const end = expense.endDate && expense.endDate.slice(0, 7) < upto ? expense.endDate.slice(0, 7) : upto;
  if (end < start) return [];
  return monthsBetween(start, end);
}

export function amountForMonth(expense: RecurringVariableExpense, month: string): number | null {
  const hit = (expense.amounts ?? []).find((a) => a.month === month);
  return hit ? hit.amount : null;
}

/** החודשים שעדיין לא הוזן להם סכום. זו רשימת התזכורות, ולכן היא הפלט המרכזי של המודול. */
export function missingMonths(expense: RecurringVariableExpense, upto = currentMonth()): string[] {
  const have = new Set((expense.amounts ?? []).map((a) => a.month));
  return expectedMonths(expense, upto).filter((m) => !have.has(m));
}

/** סה"כ מה שנרשם בפועל על ההוצאה הזו עד היום. חודשים שלא עודכנו פשוט לא נספרים. */
export function totalToDate(expense: RecurringVariableExpense, upto = currentMonth()): number {
  return (expense.amounts ?? [])
    .filter((a) => a.month <= upto)
    .reduce((sum, a) => sum + (a.amount || 0), 0);
}

export interface RecurringReminder {
  expense: RecurringVariableExpense;
  missing: string[];
  /** החודש הכי ישן שחסר - זה מה שמציגים בהתראה */
  oldestMissing: string;
  suggestedAmount: number;
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
    });
  }
  return out.sort((a, b) => a.oldestMissing.localeCompare(b.oldestMissing));
}

/** כותב/מעדכן סכום לחודש אחד. הכתיבה היא upsert לפי חודש - אין שתי שורות לאותו חודש. */
export function upsertAmount(
  amounts: RecurringVariableAmount[] | undefined,
  entry: RecurringVariableAmount,
): RecurringVariableAmount[] {
  const rest = (amounts ?? []).filter((a) => a.month !== entry.month);
  return [...rest, entry].sort((a, b) => b.month.localeCompare(a.month));
}
