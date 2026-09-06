import { getAdminFirestore } from "./firebase-admin";
import type {
  Branch,
  FixedExpense,
  VariableExpense,
  Rental,
  CollectionRoute,
  Laptop,
  BranchTransfer,
  BranchIncome,
  MultiBranchExpense,
} from "@ultranet/shared-types";
import {
  ownerExpenseBurden,
  expenseNetToOwnerFromShares,
  isCollectedByOwner,
  monthsBetween,
} from "./branch-accounting";
import { MULTI_BRANCH_EXPENSES_COLLECTION, splitOf } from "./multi-branch-expense";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

interface DatedExpenseLine {
  amount: number;
  paidBy?: string;
  owedBy?: string;
  month: string;
  /** Human-readable name of the expense, carried through so the monthly partner report can
   *  itemise the lines instead of only showing their total. */
  desc: string;
  /** true for a recurring fixed expense, false for a one-off variable one. */
  recurring: boolean;
  /**
   * The owner's economic share of this line, in ₪. For an ordinary branch expense that is just
   * ownerExpenseBurden(amount, owedBy) - all / half / none, per `owedBy`. Multi-branch expenses
   * need this field because their split is a free percentage that `owedBy` cannot express, so
   * every downstream calculation reads `ownerShare` rather than re-deriving from `owedBy`.
   */
  ownerShare: number;
  /** set only on a multi-branch expense line - the owner's percentage of it, for display. */
  ownerPct?: number;
}

/** Expands recurring fixed expenses into one line per active month, plus all variable expense
 *  lines, plus this branch's slice of every multi-branch expense it takes part in. */
function expandExpenseLines(
  fixed: FixedExpense[],
  variable: VariableExpense[],
  multiBranch: MultiBranchExpense[],
  uptoMonth: string
): DatedExpenseLine[] {
  const lines: DatedExpenseLine[] = [];
  for (const e of fixed) {
    if (!e.startDate) continue;
    const endMonth = e.endDate && e.endDate.slice(0, 7) < uptoMonth ? e.endDate.slice(0, 7) : uptoMonth;
    const amount = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
    for (const month of monthsBetween(e.startDate, endMonth)) {
      lines.push({
        amount,
        paidBy: e.paidBy,
        owedBy: e.owedBy,
        month,
        desc: e.name || "הוצאה קבועה",
        recurring: true,
        ownerShare: ownerExpenseBurden(amount, e.owedBy),
      });
    }
  }
  for (const e of variable) {
    const amount = e.amount || 0;
    lines.push({
      amount,
      paidBy: e.paidBy,
      owedBy: e.owedBy,
      month: e.month,
      desc: e.desc || "הוצאה חד פעמית",
      recurring: false,
      ownerShare: ownerExpenseBurden(amount, e.owedBy),
    });
  }
  // One line per multi-branch expense: this branch's slice of it, with the owner's percentage
  // of that same slice carried in ownerShare. See lib/multi-branch-expense.ts for the split.
  for (const e of multiBranch) {
    const split = splitOf(e);
    lines.push({
      amount: split.perBranchLineTotal,
      paidBy: e.paidBy,
      // owedBy stays undefined on purpose - the split is a percentage, not an owner/partner/50-50
      // bucket, so ownerShare below is the only correct source for it.
      month: e.month,
      desc: e.desc || "הוצאה משותפת",
      recurring: false,
      ownerShare: split.perBranchOwnerShare,
      ownerPct: split.ownerPct,
    });
  }
  return lines;
}

/** The owner's net for one expense line, from its resolved shares. Identical to
 *  expenseNetToOwner(amount, paidBy, owedBy) for every ordinary line - see the doc comment on
 *  expenseNetToOwnerFromShares - and the only correct form for a multi-branch line. */
function lineNetToOwner(line: DatedExpenseLine): number {
  return expenseNetToOwnerFromShares(line.amount, line.ownerShare, line.paidBy);
}

/** One expense line as it appears in the partner settlement: the full amount that was spent,
 *  plus how much of it nets to the owner (positive: the partner owes the owner for it). */
export interface SettlementExpenseLine {
  desc: string;
  amount: number;
  paidBy?: string;
  owedBy?: string;
  recurring: boolean;
  netToOwner: number;
  /** the owner's share of this line in ₪ - the authority on the split for every line type */
  ownerShare: number;
  /** set only on a multi-branch expense line, so the report can say "40% על הבעלים" instead of
   *  trying to phrase a free percentage as an owner/partner/50-50 bucket */
  ownerPct?: number;
}

/**
 * The month's expense lines that actually take part in the owner/partner settlement - i.e. the
 * ones either side owes the other something for: shared expenses, and expenses one side paid on
 * the other's behalf. An expense the owner both paid AND fully owes (owedBy "owner", paidBy
 * "owner") is *not* a settlement matter at all - it's the owner's own P&L - so it's left out.
 */
export function settlementExpenseLinesForMonth(
  branch: Branch,
  raw: BranchAccountingRawData,
  month: string
): SettlementExpenseLine[] {
  const fixed = raw.fixedByBranch.get(branch.id) ?? [];
  const variable = raw.variableByBranch.get(branch.id) ?? [];
  const multiBranch = raw.multiBranchByBranch.get(branch.id) ?? [];
  return expandExpenseLines(fixed, variable, multiBranch, month)
    .filter((e) => e.month === month)
    .map((e) => ({
      desc: e.desc,
      amount: e.amount,
      paidBy: e.paidBy,
      owedBy: e.owedBy,
      recurring: e.recurring,
      netToOwner: lineNetToOwner(e),
      ownerShare: e.ownerShare,
      ownerPct: e.ownerPct,
    }))
    .filter((e) => Math.abs(e.netToOwner) > 0.005);
}

interface DatedIncomeLine {
  amount: number;
  collectedByOwner: boolean;
  month: string;
}

function buildIncomeLines(rentals: Rental[], routesById: Map<string, CollectionRoute>): DatedIncomeLine[] {
  return rentals
    // Only rentals actually collected from the client count as cash the branch/partner is
    // holding for the owner. A rental can be `status: "returned"` yet `paid: false` (client
    // still owes - see the "לא שולם" list on /dashboard/rentals/manage); counting those here
    // would show the owner a balance owed for money nobody has collected yet.
    .filter((r) => r.status === "returned" && !!r.returnDate && r.paid)
    .map((r) => {
      const amount = r.finalPrice ?? r.calcPrice ?? 0;
      const route = r.collectionRouteId ? routesById.get(r.collectionRouteId) ?? null : null;
      return {
        amount,
        collectedByOwner: isCollectedByOwner(r.paymentMethod, route),
        month: (r.returnDate as string).slice(0, 7),
      };
    });
}

/** Owner's manual income log (n_branch_income) treated exactly like real rental income - merged
 *  into the same income lines so it counts in "הכנסות החודש"/"הכנסות עד היום" and the
 *  partner-settlement calc, without ever touching n_ah_income (the main ledger). */
function buildManualIncomeLines(entries: BranchIncome[]): DatedIncomeLine[] {
  return entries.map((i) => ({
    amount: i.amount || 0,
    collectedByOwner: i.collectedByOwner ?? false,
    month: i.date.slice(0, 7),
  }));
}

export interface BranchFinancials {
  branch: Branch;
  incomeThisMonth: number; // partner's P&L share
  expenseThisMonth: number; // partner's P&L share
  balanceThisMonth: number;
  incomeToDate: number;
  expenseToDate: number;
  balanceToDate: number;
  settlementNetToOwner: number; // positive: partner should transfer to owner; negative: owner owes partner
  ownerNetProfitThisMonth: number; // true owner profit, including outlays the branch has no part in
  /**
   * הרווח התפעולי של הבעלים מהסניף — כמו `ownerNetProfitThisMonth`, אבל **בלי שורות שהסניף
   * לא לוקח בהן חלק בכלל** (הבעלים שילם, והחוב כולו עליו).
   *
   * שורה כזו היא רכש: קניתי מחשב, קניתי ציוד. היא לא עלות תפעול של החודש אלא השקעה בסניף,
   * ולכן היא מעוותת את המדד שהיא נכנסת אליו — חודש שנקנו בו שני מחשבים היה נראה כמו חודש
   * הפסד, בזמן שהסניף עצמו תפקד בדיוק כרגיל. זה המספר שמזין את הרווח-פר-מחשב
   * (`lib/laptop-branch-tracking.ts`); `ownerNetProfitThisMonth` נשאר מה שהוא, כי לשאלה
   * "כמה באמת יצא לי מהכיס" הוא התשובה הנכונה.
   */
  ownerOperatingProfitThisMonth: number;
  ownerInvestedToDate: number;
  ownerEarnedToDate: number;
  ownerBalanceToDate: number;
  /** מה שיצא לי מהכיס בפועל בסניף הזה עד היום - כל שורת הוצאה שאני שילמתי, במלוא הסכום,
   *  בלי קשר לשאלה על מי החוב. `ownerInvestedToDate` היא השאלה השנייה (החלק שלי בעלות);
   *  שתיהן נחוצות, כי "כמה הוצאתי" ו"כמה מזה באמת שלי" הם שני מספרים שונים. */
  ownerPaidCashToDate: number;
  /** This month's expense lines the owner paid, valued at the partner's share of them (what the partner owes back). */
  myExpenseThisMonth: number;
  /** This month's expense lines the partner paid, valued at the owner's share of them (what the owner owes back). */
  hisExpenseThisMonth: number;
  /** This month's total collected income for the branch, before any owner/partner split. */
  grossIncomeThisMonth: number;
  /** This month's total spend on the expense lines that take part in the settlement (shared ones,
   *  and ones one side paid on the other's behalf) - the full amount spent, not either side's
   *  share of it. Expenses the owner both paid and fully owes are excluded: they're the owner's
   *  own P&L, not a partner matter. See settlementExpenseLinesForMonth. */
  settlementExpenseThisMonth: number;
  /** Number of income events counted this month (paid+returned rentals plus manual income rows). */
  rentalCountThisMonth: number;
}

export interface BranchAccountingRawData {
  branches: Branch[];
  fixedByBranch: Map<string, FixedExpense[]>;
  variableByBranch: Map<string, VariableExpense[]>;
  rentalsByBranch: Map<string, Rental[]>;
  laptopsByBranch: Map<string, Laptop[]>;
  routesById: Map<string, CollectionRoute>;
  transfersByBranchMonth: Map<string, BranchTransfer>; // key: `${branchId}|${month}`
  branchIncomeByBranch: Map<string, BranchIncome[]>;
  /** A multi-branch expense is indexed under EVERY branch it applies to - each of them gets its
   *  own slice of it as an expense line. See expandExpenseLines. */
  multiBranchByBranch: Map<string, MultiBranchExpense[]>;
  /** Every multi-branch expense, once, for the management list on /rentals/expenses. */
  multiBranchExpenses: MultiBranchExpense[];
}

export async function loadBranchAccountingRawData(): Promise<BranchAccountingRawData> {
  const db = getAdminFirestore();
  const [
    branchesSnap,
    fixedSnap,
    variableSnap,
    rentalsSnap,
    laptopsSnap,
    routesSnap,
    transfersSnap,
    branchIncomeSnap,
    multiBranchSnap,
  ] = await Promise.all([
    db.collection("n_branches").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection("n_rentals").get(),
    db.collection("n_laptops").get(),
    db.collection("n_collection_routes").get(),
    db.collection("n_branch_transfers").get(),
    db.collection("n_branch_income").get(),
    db.collection(MULTI_BRANCH_EXPENSES_COLLECTION).get(),
  ]);

  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);

  const fixedByBranch = new Map<string, FixedExpense[]>();
  for (const d of fixedSnap.docs) {
    const e = { ...(d.data() as Omit<FixedExpense, "id">), id: d.id } as FixedExpense;
    const arr = fixedByBranch.get(e.branchId) ?? [];
    arr.push(e);
    fixedByBranch.set(e.branchId, arr);
  }

  const variableByBranch = new Map<string, VariableExpense[]>();
  for (const d of variableSnap.docs) {
    const e = { ...(d.data() as Omit<VariableExpense, "id">), id: d.id } as VariableExpense;
    const arr = variableByBranch.get(e.branchId) ?? [];
    arr.push(e);
    variableByBranch.set(e.branchId, arr);
  }

  const rentalsByBranch = new Map<string, Rental[]>();
  for (const d of rentalsSnap.docs) {
    const r = { ...(d.data() as Omit<Rental, "id">), id: d.id } as Rental;
    const arr = rentalsByBranch.get(r.branchId) ?? [];
    arr.push(r);
    rentalsByBranch.set(r.branchId, arr);
  }

  const laptopsByBranch = new Map<string, Laptop[]>();
  for (const d of laptopsSnap.docs) {
    const l = { ...(d.data() as Omit<Laptop, "id">), id: d.id } as Laptop;
    const arr = laptopsByBranch.get(l.branchId) ?? [];
    arr.push(l);
    laptopsByBranch.set(l.branchId, arr);
  }

  const routesById = new Map<string, CollectionRoute>();
  for (const d of routesSnap.docs) {
    routesById.set(d.id, { ...(d.data() as Omit<CollectionRoute, "id">), id: d.id } as CollectionRoute);
  }

  const transfersByBranchMonth = new Map<string, BranchTransfer>();
  for (const d of transfersSnap.docs) {
    const t = { ...(d.data() as Omit<BranchTransfer, "id">), id: d.id } as BranchTransfer;
    transfersByBranchMonth.set(`${t.branchId}|${t.month}`, t);
  }

  const branchIncomeByBranch = new Map<string, BranchIncome[]>();
  for (const d of branchIncomeSnap.docs) {
    const i = { ...(d.data() as Omit<BranchIncome, "id">), id: d.id } as BranchIncome;
    const arr = branchIncomeByBranch.get(i.branchId) ?? [];
    arr.push(i);
    branchIncomeByBranch.set(i.branchId, arr);
  }

  const multiBranchExpenses = multiBranchSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<MultiBranchExpense, "id">), id: d.id }) as MultiBranchExpense
  );
  const multiBranchByBranch = new Map<string, MultiBranchExpense[]>();
  for (const e of multiBranchExpenses) {
    for (const branchId of e.branchIds ?? []) {
      const arr = multiBranchByBranch.get(branchId) ?? [];
      arr.push(e);
      multiBranchByBranch.set(branchId, arr);
    }
  }

  return {
    branches,
    fixedByBranch,
    variableByBranch,
    rentalsByBranch,
    laptopsByBranch,
    routesById,
    transfersByBranchMonth,
    branchIncomeByBranch,
    multiBranchByBranch,
    multiBranchExpenses,
  };
}

/** ownerPct for a branch's own split (not counting parent-branch cuts). */
function branchOwnerPct(branch: Branch): number {
  if (!branch.branchType) return 100;
  if (branch.isMine) return 100;
  return branch.myPct ?? 100 - (branch.partnerPct ?? 0);
}

export function computeBranchFinancials(branch: Branch, raw: BranchAccountingRawData, month: string): BranchFinancials {
  const fixed = raw.fixedByBranch.get(branch.id) ?? [];
  const variable = raw.variableByBranch.get(branch.id) ?? [];
  const rentals = raw.rentalsByBranch.get(branch.id) ?? [];
  const branchIncome = raw.branchIncomeByBranch.get(branch.id) ?? [];
  const multiBranch = raw.multiBranchByBranch.get(branch.id) ?? [];

  const expenseLines = expandExpenseLines(fixed, variable, multiBranch, month);
  const incomeLines = [...buildIncomeLines(rentals, raw.routesById), ...buildManualIncomeLines(branchIncome)];

  const ownerPct = branchOwnerPct(branch);
  const partnerPct = 100 - ownerPct;

  const thisMonthExpenses = expenseLines.filter((e) => e.month === month);
  const thisMonthIncome = incomeLines.filter((i) => i.month === month);

  // Every expense figure below reads the line's resolved shares (`ownerShare`, and `amount -
  // ownerShare` for the partner) rather than re-deriving them from `owedBy`, so that a
  // multi-branch expense's free percentage split flows through identically to an ordinary
  // owner/partner/50-50 one. For ordinary lines the two forms are equal by construction.
  const incomeThisMonth = thisMonthIncome.reduce((sum, i) => sum + (i.amount * partnerPct) / 100, 0);
  const expenseThisMonth = thisMonthExpenses.reduce((sum, e) => sum + (e.amount - e.ownerShare), 0);

  const incomeToDate = incomeLines.reduce((sum, i) => sum + (i.amount * partnerPct) / 100, 0);
  const expenseToDate = expenseLines.reduce((sum, e) => sum + (e.amount - e.ownerShare), 0);

  const settlementIncome = thisMonthIncome.reduce((sum, i) => {
    if (i.collectedByOwner) return sum - (i.amount * partnerPct) / 100;
    return sum + (i.amount * ownerPct) / 100;
  }, 0);
  const settlementExpense = thisMonthExpenses.reduce((sum, e) => sum + lineNetToOwner(e), 0);

  const ownerIncomeThisMonth = thisMonthIncome.reduce((sum, i) => sum + (i.amount * ownerPct) / 100, 0);
  const ownerNetProfitThisMonth =
    ownerIncomeThisMonth - thisMonthExpenses.reduce((sum, e) => sum + e.ownerShare, 0);

  /**
   * שורה שהבעלים שילם והחוב כולה עליו היא שורה שהסניף לא לוקח בה חלק - `ownerShare === amount`
   * ו-`paidBy` אינו השותף. אלה הרכישות, והן יוצאות מהמדד התפעולי. ההשוואה מול `amount` נעשית
   * בסבילות של אגורה, כי `ownerShare` יכול להגיע מחלוקת אחוזים ולא מהעתקה.
   */
  const isOwnerOnlyOutlay = (e: (typeof thisMonthExpenses)[number]) =>
    e.paidBy !== "partner" && Math.abs(e.ownerShare - e.amount) < 0.01;
  const ownerOperatingProfitThisMonth =
    ownerIncomeThisMonth -
    thisMonthExpenses.filter((e) => !isOwnerOnlyOutlay(e)).reduce((sum, e) => sum + e.ownerShare, 0);

  /*
   * כאן חושבה `computerProfitTrend` - רצועת רווח-פר-מחשב של 12 חודשים לכל סניף. היא נמחקה
   * יחד עם `ComputerProfitTable`: השאלה "כמה מרוויח כל מחשב" נשאלת על פני כל הסניפים יחד
   * ולכן עברה למסך אחד (`lib/laptop-branch-tracking.ts`). להשאיר כאן חישוב מקביל, שגם ספר
   * את הרכש בתוך הרווח, היה מייצר מספר שני לאותה שאלה - וזה בדיוק מה שהפרויקט הזה ניקה.
   */

  // "My expenses" this month: lines the owner paid, valued at what the partner owes back for them
  // (0 if owedBy is the owner alone). "His expenses": lines the partner paid, valued at what the
  // owner owes back for them. Mirrors expenseNetToOwner but split by who fronted the cash, so the
  // owner's overview table can show both sides instead of just the net.
  const myExpenseThisMonth = thisMonthExpenses
    .filter((e) => e.paidBy !== "partner")
    .reduce((sum, e) => sum + (e.amount - e.ownerShare), 0);
  const hisExpenseThisMonth = thisMonthExpenses
    .filter((e) => e.paidBy === "partner")
    .reduce((sum, e) => sum + e.ownerShare, 0);
  const grossIncomeThisMonth = thisMonthIncome.reduce((sum, i) => sum + i.amount, 0);
  const settlementExpenseThisMonth = thisMonthExpenses
    .filter((e) => Math.abs(lineNetToOwner(e)) > 0.005)
    .reduce((sum, e) => sum + e.amount, 0);
  const rentalCountThisMonth = thisMonthIncome.length;

  return {
    branch,
    incomeThisMonth,
    expenseThisMonth,
    balanceThisMonth: incomeThisMonth - expenseThisMonth,
    incomeToDate,
    expenseToDate,
    balanceToDate: incomeToDate - expenseToDate,
    settlementNetToOwner: settlementIncome + settlementExpense,
    ownerNetProfitThisMonth,
    ownerOperatingProfitThisMonth,
    ownerInvestedToDate: expenseLines.reduce((sum, e) => sum + e.ownerShare, 0),
    ownerEarnedToDate: incomeLines.reduce((sum, i) => sum + (i.amount * ownerPct) / 100, 0),
    ownerBalanceToDate:
      incomeLines.reduce((sum, i) => sum + (i.amount * ownerPct) / 100, 0) -
      expenseLines.reduce((sum, e) => sum + e.ownerShare, 0),
    ownerPaidCashToDate: expenseLines
      .filter((e) => e.paidBy !== "partner")
      .reduce((sum, e) => sum + e.amount, 0),
    myExpenseThisMonth,
    hisExpenseThisMonth,
    grossIncomeThisMonth,
    settlementExpenseThisMonth,
    rentalCountThisMonth,
  };
}
