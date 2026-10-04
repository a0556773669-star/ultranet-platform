/**
 * שורת התחשבנות אחת, לסניף אחד, בחודש אחד.
 *
 * אותו חודש מוצג בשתי טבלאות ב-`/dashboard/accounting/mobile`: המצומצמת שיושבת במסך
 * (יתרה וכמה צריך להעביר) והרחבה שנפתחת בחלון. שתיהן חייבות להראות את אותם מספרים,
 * ולכן הן קוראות אותם מכאן במקום שכל אחת תחשב לעצמה — שני חישובים לאותה שאלה הם הדרך
 * הבטוחה ביותר לקבל שתי תשובות.
 */
import type { Branch } from "@ultranet/shared-types";
import { computeBranchFinancials, type BranchAccountingRawData } from "./branch-accounting-data";
import { buildBranchLedger } from "./branch-ledger";

export interface BranchTransferRow {
  branch: Branch;
  /** כל ההוצאות שיש עליהן התחשבנות בין הצדדים באותו חודש */
  expenses: number;
  /** ברוטו ההכנסות של הסניף באותו חודש */
  income: number;
  /** מה שנשאר לא מועבר מחודשים קודמים */
  opening: number;
  /** ההתחשבנות של החודש עצמו: חיובי = הסניף חייב לי, שלילי = אני חייב לו */
  netToOwner: number;
  /** השורה התחתונה: החודש הזה יחד עם היתרה שנגררה */
  totalDue: number;
  transferredAmount: number;
  receiptIssued: boolean;
}

/** סניף-אב ומיד אחריו הסניפים שתלויים בו, כדי שהיררכיה תיקרא כהיררכיה. */
function byParentThenName(a: Branch, b: Branch): number {
  if (!a.parentBranchId && b.parentBranchId === a.id) return -1;
  if (!b.parentBranchId && a.parentBranchId === b.id) return 1;
  const aKey = a.parentBranchId ? `${a.parentBranchId}~${a.name}` : `${a.id}~`;
  const bKey = b.parentBranchId ? `${b.parentBranchId}~${b.name}` : `${b.id}~`;
  return aKey.localeCompare(bKey, "he");
}

export function buildBranchTransferRows(
  branches: Branch[],
  raw: BranchAccountingRawData,
  month: string,
): BranchTransferRow[] {
  return [...branches].sort(byParentThenName).map((branch) => {
    const f = computeBranchFinancials(branch, raw, month);
    const ledger = buildBranchLedger(branch, raw);
    // אין שורה בספר = החודש שנבחר מוקדם מהפעילות הראשונה של הסניף. לא נגרר לתוכו כלום ולא
    // הסתדר בו כלום, ולכן כל מספר בהתחשבנות הוא פשוט אפס.
    const monthRow = ledger.rows.find((r) => r.month === month);
    return {
      branch,
      expenses: f.settlementExpenseThisMonth,
      income: f.grossIncomeThisMonth,
      opening: monthRow?.openingBalance ?? 0,
      netToOwner: monthRow?.netToOwner ?? 0,
      totalDue: monthRow?.totalDue ?? 0,
      transferredAmount: monthRow?.transferredAmount ?? 0,
      receiptIssued: monthRow?.receiptIssued ?? false,
    };
  });
}

export interface BranchTransferTotals {
  expenses: number;
  income: number;
  opening: number;
  netToOwner: number;
  totalDue: number;
}

export function sumBranchTransferRows(rows: BranchTransferRow[]): BranchTransferTotals {
  return rows.reduce<BranchTransferTotals>(
    (acc, r) => ({
      expenses: acc.expenses + r.expenses,
      income: acc.income + r.income,
      opening: acc.opening + r.opening,
      netToOwner: acc.netToOwner + r.netToOwner,
      totalDue: acc.totalDue + r.totalDue,
    }),
    { expenses: 0, income: 0, opening: 0, netToOwner: 0, totalDue: 0 },
  );
}
