import { getAdminFirestore } from "./firebase-admin";
import type {
  Branch,
  FixedExpense,
  VariableExpense,
  Rental,
  CollectionRoute,
  Laptop,
  BranchTransfer,
} from "@ultranet/shared-types";
import {
  ownerExpenseBurden,
  partnerExpenseBurden,
  expenseNetToOwner,
  isCollectedByOwner,
  monthsBetween,
  buildComputerProfitTrend,
  type ComputerProfitMonth,
} from "./branch-accounting";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

interface DatedExpenseLine {
  amount: number;
  paidBy?: string;
  owedBy?: string;
  month: string;
}

/** Expands recurring fixed expenses into one line per active month, plus all variable expense lines. */
function expandExpenseLines(fixed: FixedExpense[], variable: VariableExpense[], uptoMonth: string): DatedExpenseLine[] {
  const lines: DatedExpenseLine[] = [];
  for (const e of fixed) {
    if (!e.startDate) continue;
    const endMonth = e.endDate && e.endDate.slice(0, 7) < uptoMonth ? e.endDate.slice(0, 7) : uptoMonth;
    const amount = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
    for (const month of monthsBetween(e.startDate, endMonth)) {
      lines.push({ amount, paidBy: e.paidBy, owedBy: e.owedBy, month });
    }
  }
  for (const e of variable) {
    lines.push({ amount: e.amount || 0, paidBy: e.paidBy, owedBy: e.owedBy, month: e.month });
  }
  return lines;
}

interface DatedIncomeLine {
  amount: number;
  collectedByOwner: boolean;
  month: string;
}

function buildIncomeLines(rentals: Rental[], routesById: Map<string, CollectionRoute>): DatedIncomeLine[] {
  return rentals
    .filter((r) => r.status === "returned" && !!r.returnDate)
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

export interface BranchFinancials {
  branch: Branch;
  incomeThisMonth: number; // partner's P&L share
  expenseThisMonth: number; // partner's P&L share
  balanceThisMonth: number;
  incomeToDate: number;
  expenseToDate: number;
  balanceToDate: number;
  settlementNetToOwner: number; // positive: partner should transfer to owner; negative: owner owes partner
  ownerNetProfitThisMonth: number; // true owner profit, used for per-computer metric
  ownerInvestedToDate: number;
  ownerEarnedToDate: number;
  ownerBalanceToDate: number;
  computerProfitTrend: ComputerProfitMonth[];
}

export interface BranchAccountingRawData {
  branches: Branch[];
  fixedByBranch: Map<string, FixedExpense[]>;
  variableByBranch: Map<string, VariableExpense[]>;
  rentalsByBranch: Map<string, Rental[]>;
  laptopsByBranch: Map<string, Laptop[]>;
  routesById: Map<string, CollectionRoute>;
  transfersByBranchMonth: Map<string, BranchTransfer>; // key: `${branchId}|${month}`
}

export async function loadBranchAccountingRawData(): Promise<BranchAccountingRawData> {
  const db = getAdminFirestore();
  const [branchesSnap, fixedSnap, variableSnap, rentalsSnap, laptopsSnap, routesSnap, transfersSnap] = await Promise.all([
    db.collection("n_branches").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection("n_rentals").get(),
    db.collection("n_laptops").get(),
    db.collection("n_collection_routes").get(),
    db.collection("n_branch_transfers").get(),
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

  return { branches, fixedByBranch, variableByBranch, rentalsByBranch, laptopsByBranch, routesById, transfersByBranchMonth };
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
  const laptops = raw.laptopsByBranch.get(branch.id) ?? [];

  const expenseLines = expandExpenseLines(fixed, variable, month);
  const incomeLines = buildIncomeLines(rentals, raw.routesById);

  const ownerPct = branchOwnerPct(branch);
  const partnerPct = 100 - ownerPct;

  const thisMonthExpenses = expenseLines.filter((e) => e.month === month);
  const thisMonthIncome = incomeLines.filter((i) => i.month === month);

  const incomeThisMonth = thisMonthIncome.reduce((sum, i) => sum + (i.amount * partnerPct) / 100, 0);
  const expenseThisMonth = thisMonthExpenses.reduce((sum, e) => sum + partnerExpenseBurden(e.amount, e.owedBy), 0);

  const incomeToDate = incomeLines.reduce((sum, i) => sum + (i.amount * partnerPct) / 100, 0);
  const expenseToDate = expenseLines.reduce((sum, e) => sum + partnerExpenseBurden(e.amount, e.owedBy), 0);

  const settlementIncome = thisMonthIncome.reduce((sum, i) => {
    if (i.collectedByOwner) return sum - (i.amount * partnerPct) / 100;
    return sum + (i.amount * ownerPct) / 100;
  }, 0);
  const settlementExpense = thisMonthExpenses.reduce((sum, e) => sum + expenseNetToOwner(e.amount, e.paidBy, e.owedBy), 0);

  const ownerNetProfitThisMonth =
    thisMonthIncome.reduce((sum, i) => sum + (i.amount * ownerPct) / 100, 0) -
    thisMonthExpenses.reduce((sum, e) => sum + ownerExpenseBurden(e.amount, e.owedBy), 0);

  // Build a trend of the last 12 months of owner net profit for the per-computer graph.
  const trendMonths: string[] = [];
  {
    const [cy, cm] = month.split("-").map(Number);
    let y: number = cy || new Date().getFullYear();
    let m: number = cm || 1;
    for (let i = 0; i < 12; i++) {
      trendMonths.unshift(`${y}-${String(m).padStart(2, "0")}`);
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    }
  }
  const monthlyNetProfits = trendMonths.map((mo) => {
    const incLines = incomeLines.filter((i) => i.month === mo);
    const expLines = expenseLines.filter((e) => e.month === mo);
    const netProfit =
      incLines.reduce((sum, i) => sum + (i.amount * ownerPct) / 100, 0) -
      expLines.reduce((sum, e) => sum + ownerExpenseBurden(e.amount, e.owedBy), 0);
    return { month: mo, netProfit };
  });
  const addedDates = laptops.map((l) => l.addedDate);
  const computerProfitTrend = buildComputerProfitTrend(monthlyNetProfits, addedDates);

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
    ownerInvestedToDate: expenseLines.reduce((sum, e) => sum + ownerExpenseBurden(e.amount, e.owedBy), 0),
    ownerEarnedToDate: incomeLines.reduce((sum, i) => sum + (i.amount * ownerPct) / 100, 0),
    ownerBalanceToDate:
      incomeLines.reduce((sum, i) => sum + (i.amount * ownerPct) / 100, 0) -
      expenseLines.reduce((sum, e) => sum + ownerExpenseBurden(e.amount, e.owedBy), 0),
    computerProfitTrend,
  };
}
