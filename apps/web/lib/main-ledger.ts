/**
 * ההנה"ח הראשית — הספר של העסק מול עצמו.
 *
 * המסך הראשי עונה על שלוש שאלות: כמה הוצאנו עד היום, כמה הכנסנו עד היום, ומה המאזן.
 * הקוד שמתחתיו הוא סכום, ולא יותר מזה, וזו החלטה: כל מה שהיה כאן קודם - מודל תנועות,
 * מראות, ספרים מקבילים, "מזכר הוני" - היה מנגנון שנועד להסיק אילו סכומים שייכים לספר
 * הראשי. עכשיו לא מסיקים: על כל שורה בעסק יש דגל `countsToMain`, מישהו סימן אותו,
 * והספר הראשי הוא הסכום של המסומנים.
 *
 * מה שמצטרף (רק כשהדגל דלוק):
 *   הוצאות — `n_fixed_expenses` (נצברת חודש-חודש מ-`startDate`), `n_var_expenses`,
 *            `n_multi_branch_expenses`, `n_recurring_var_expenses` (סכום החודשים שנרשמו),
 *            `n_ah_expenses` (שורות "הוצאות נוספות").
 *   הכנסות — `n_ah_income` (כל מה שנוסף במסך הראשי: אשראי / מזומן / ניידים / מכירה),
 *            ותשלומי משרד שיתופי שסומנו.
 *
 * מה שלא מצטרף לעולם: `n_branch_income` (מעקב פר-סניף בחדרי מחשבים) - זה אינדיקציה,
 * לא כסף אמיתי, כפי שכתוב בטיפוס עצמו.
 */
import { getAdminFirestore } from "./firebase-admin";
import type {
  AccountingExpense,
  AccountingIncome,
  Branch,
  CoworkingClient,
  FixedExpense,
  MultiBranchExpense,
  RecurringVariableExpense,
  VariableExpense,
} from "@ultranet/shared-types";
import { countsToMain } from "./counts-to-main";
import { monthsBetween } from "./branch-accounting";
import { RECURRING_VAR_EXPENSES_COLLECTION } from "./recurring-expenses";
import { MULTI_BRANCH_EXPENSES_COLLECTION } from "./multi-branch-expense";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export type MainEntrySource =
  | "fixed"
  | "variable"
  | "multi-branch"
  | "recurring"
  | "extra"
  | "income"
  | "coworking";

export interface MainLedgerEntry {
  id: string;
  source: MainEntrySource;
  /** YYYY-MM-DD */
  date: string;
  month: string;
  desc: string;
  amount: number;
  /** שם הסניף/המודול שהשורה הגיעה ממנו, לתצוגה בלבד */
  origin: string;
  category?: string;
}

export interface MainLedgerTotals {
  expense: number;
  income: number;
  balance: number;
}

export interface MainLedger {
  expenses: MainLedgerEntry[];
  income: MainLedgerEntry[];
  totals: MainLedgerTotals;
  /** אותם סכומים אבל רק לחודש הנוכחי */
  thisMonth: MainLedgerTotals;
  branchNameById: Map<string, string>;
  /** הרשומה הגולמית של כל שורת `n_ah_income`, לפי המזהה שלה. המסך צריך אותה בשביל
   *  מצב הקבלה ו"למי מכרתי" - שדות שלא שייכים ל-`MainLedgerEntry`, שהוא סכום בלבד. */
  incomeRows: Map<string, AccountingIncome>;
}

const INCOME_TYPE_LABEL: Record<string, string> = {
  credit: "אשראי",
  cash: "מזומן",
  laptops: "ניידים",
  sale: "מכירת מחשבים",
  other: "אחר",
  fixed: "ישן",
  variable: "ישן",
};

export function incomeTypeLabel(type: string | undefined): string {
  return INCOME_TYPE_LABEL[type ?? ""] ?? "אחר";
}

/**
 * הוצאה קבועה נצברת חודש-חודש מהחודש של `startDate`, לפי בקשת הבעלים: "הוצאה קבועה
 * מתחילה להיספר מאותו היום שהוספתי אותה". החודש הראשון נספר במלואו - זו הוצאה חודשית,
 * לא יומית, ופרורציה חלקית הייתה יוצרת שקלים שאף חשבונית לא מכירה.
 */
export function fixedExpenseAccrued(e: FixedExpense, upto: string): number {
  if (!e.startDate) return 0;
  const start = e.startDate.slice(0, 7);
  if (start > upto) return 0;
  const end = e.endDate && e.endDate.slice(0, 7) < upto ? e.endDate.slice(0, 7) : upto;
  if (end < start) return 0;
  const monthly = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
  return monthly * monthsBetween(start, end).length;
}

export async function loadMainLedger(upto = currentMonth()): Promise<MainLedger> {
  const db = getAdminFirestore();
  const [
    branchesSnap,
    fixedSnap,
    variableSnap,
    multiSnap,
    recurringSnap,
    ahExpenseSnap,
    ahIncomeSnap,
    cwClientsSnap,
  ] = await Promise.all([
    db.collection("n_branches").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection(MULTI_BRANCH_EXPENSES_COLLECTION).get(),
    db.collection(RECURRING_VAR_EXPENSES_COLLECTION).get(),
    db.collection("n_ah_expenses").get(),
    db.collection("n_ah_income").get(),
    db.collection("n_cw_clients").get(),
  ]);

  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const originOf = (branchId?: string) =>
    !branchId ? "כללי" : branchNameById.get(branchId) ?? (branchId.startsWith("shared-") ? "כל הסניפים" : branchId);

  const expenses: MainLedgerEntry[] = [];

  for (const d of fixedSnap.docs) {
    const e = { ...(d.data() as Omit<FixedExpense, "id">), id: d.id } as FixedExpense;
    if (!countsToMain(e)) continue;
    const amount = fixedExpenseAccrued(e, upto);
    if (amount === 0) continue;
    expenses.push({
      id: e.id,
      source: "fixed",
      date: e.startDate,
      month: e.startDate.slice(0, 7),
      desc: `${e.name} (קבועה, נצבר עד היום)`,
      amount,
      origin: originOf(e.branchId),
      category: e.category,
    });
  }

  for (const d of variableSnap.docs) {
    const e = { ...(d.data() as Omit<VariableExpense, "id">), id: d.id } as VariableExpense;
    if (!countsToMain(e)) continue;
    if (e.month > upto) continue;
    expenses.push({
      id: e.id,
      source: "variable",
      date: e.date,
      month: e.month,
      desc: e.desc,
      amount: e.amount || 0,
      origin: originOf(e.branchId),
      category: e.category,
    });
  }

  for (const d of multiSnap.docs) {
    const e = { ...(d.data() as Omit<MultiBranchExpense, "id">), id: d.id } as MultiBranchExpense;
    if (!countsToMain(e)) continue;
    if (e.month > upto) continue;
    expenses.push({
      id: e.id,
      source: "multi-branch",
      date: e.date,
      month: e.month,
      desc: `${e.desc} (${e.branchIds?.length ?? 0} סניפים)`,
      amount: e.amount || 0,
      origin: "כמה סניפים",
      category: e.category,
    });
  }

  for (const d of recurringSnap.docs) {
    const e = { ...(d.data() as Omit<RecurringVariableExpense, "id">), id: d.id } as RecurringVariableExpense;
    if (!countsToMain(e)) continue;
    for (const a of e.amounts ?? []) {
      if (a.month > upto) continue;
      expenses.push({
        id: `${e.id}|${a.month}`,
        source: "recurring",
        date: `${a.month}-01`,
        month: a.month,
        desc: `${e.name} — ${a.month}`,
        amount: a.amount || 0,
        origin: originOf(e.branchId),
        category: e.category,
      });
    }
  }

  for (const d of ahExpenseSnap.docs) {
    const e = { ...(d.data() as Omit<AccountingExpense, "id">), id: d.id } as AccountingExpense;
    if (!countsToMain(e)) continue;
    if ((e.month ?? e.date.slice(0, 7)) > upto) continue;
    expenses.push({
      id: e.id,
      source: "extra",
      date: e.date,
      month: e.month ?? e.date.slice(0, 7),
      desc: e.desc,
      amount: e.amount || 0,
      origin: "הוצאות נוספות",
      category: e.category,
    });
  }

  const income: MainLedgerEntry[] = [];
  const incomeRows = new Map<string, AccountingIncome>();

  for (const d of ahIncomeSnap.docs) {
    const i = { ...(d.data() as Omit<AccountingIncome, "id">), id: d.id } as AccountingIncome;
    const month = i.month ?? i.date?.slice(0, 7) ?? "";
    if (!month || month > upto) continue;
    incomeRows.set(i.id, i);
    income.push({
      id: i.id,
      source: "income",
      date: i.date,
      month,
      desc: i.desc,
      amount: i.amount || 0,
      origin: i.branchId ? originOf(i.branchId) : incomeTypeLabel(i.type),
      category: incomeTypeLabel(i.type),
    });
  }

  for (const d of cwClientsSnap.docs) {
    const c = { ...(d.data() as Omit<CoworkingClient, "id">), id: d.id } as CoworkingClient;
    for (const p of c.payments ?? []) {
      if (!countsToMain(p)) continue;
      if (p.month > upto) continue;
      income.push({
        id: `${c.id}|${p.month}`,
        source: "coworking",
        date: p.date || `${p.month}-01`,
        month: p.month,
        desc: `משרד שיתופי — ${c.name} (${p.month})`,
        amount: p.amount || 0,
        origin: originOf(c.branchId),
        category: "משרד שיתופי",
      });
    }
  }

  expenses.sort((a, b) => b.date.localeCompare(a.date));
  income.sort((a, b) => b.date.localeCompare(a.date));

  const sum = (rows: MainLedgerEntry[], filter?: (r: MainLedgerEntry) => boolean) =>
    rows.filter((r) => !filter || filter(r)).reduce((s, r) => s + r.amount, 0);

  const totalExpense = sum(expenses);
  const totalIncome = sum(income);
  const inMonth = (r: MainLedgerEntry) => r.month === upto;
  const monthExpense = sum(expenses, inMonth);
  const monthIncome = sum(income, inMonth);

  return {
    expenses,
    income,
    totals: { expense: totalExpense, income: totalIncome, balance: totalIncome - totalExpense },
    thisMonth: { expense: monthExpense, income: monthIncome, balance: monthIncome - monthExpense },
    branchNameById,
    incomeRows,
  };
}
