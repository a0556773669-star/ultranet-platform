/**
 * Investment-vs-profit tracking for חדרי מחשבים (computer-room) branches.
 * Deliberately separate from n_ah_income/n_ah_expenses (the main ledger): this is a
 * per-branch view of money spent (beyond setup) and money in, for owner/partner visibility only.
 * It never reconciles into the main accounting totals or the home dashboard.
 *
 * Setup cost is read from the asset layer when a real purchase exists for the branch, and only
 * falls back to the branch's `setupCost` field when it doesn't (פרק י״ב): setting up a room is
 * buying equipment, so it is a purchase with items like any other, and this screen becomes the
 * branch card of פרק ז׳ for free. The field stays readable so a room whose invoice was never
 * entered still shows its number.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { Branch, FixedExpense, VariableExpense, BranchIncome } from "@ultranet/shared-types";
import { monthsBetween } from "./branch-accounting";
import { SHARED_COMPUTERS_BRANCH_ID } from "./expense-shared-scope";
import { loadAssets } from "./assets-data";
import { paybackStatus, type PaybackStatus } from "./assets";

/** Sentinel branchId for fixed/variable expenses that apply to all computer-room branches together
 *  (e.g. shared advertising, shared software) rather than to one specific branch. */
export const SHARED_EXPENSE_BRANCH_ID = SHARED_COMPUTERS_BRANCH_ID;

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function expenseTotalToDate(fixed: FixedExpense[], variable: VariableExpense[], uptoMonth: string): number {
  let total = 0;
  for (const e of fixed) {
    if (!e.startDate) continue;
    const endMonth = e.endDate && e.endDate.slice(0, 7) < uptoMonth ? e.endDate.slice(0, 7) : uptoMonth;
    const amount = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
    total += amount * monthsBetween(e.startDate, endMonth).length;
  }
  for (const e of variable) {
    total += e.amount || 0;
  }
  return total;
}

export interface ComputerRoomBranchStats {
  branch: Branch;
  /** real investment from the asset layer when it exists, else the legacy `setupCost` field */
  setupCost: number;
  /** true when the number above came from real purchases rather than the legacy estimate */
  setupFromAssets: boolean;
  /** how much of the investment the room has already earned back (פרק ז׳) */
  payback: PaybackStatus;
  ownExpensesToDate: number;
  sharedExpenseShare: number;
  /** total spent to date, including setup cost and this branch's share of shared expenses */
  spentToDate: number;
  incomeToDate: number;
  profitHeld: number;
}

export interface ComputerRoomAccountingData {
  branches: Branch[];
  statsByBranch: Map<string, ComputerRoomBranchStats>;
  sharedFixed: FixedExpense[];
  sharedVariable: VariableExpense[];
  sharedExpenseTotal: number;
  incomesByBranch: Map<string, BranchIncome[]>;
}

export async function loadComputerRoomAccounting(): Promise<ComputerRoomAccountingData> {
  const db = getAdminFirestore();
  const [branchesSnap, fixedSnap, variableSnap, incomeSnap, assets] = await Promise.all([
    db.collection("n_branches").where("branchType", "==", "computers").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection("n_branch_income").get(),
    loadAssets(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const allFixed = fixedSnap.docs.map((d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense);
  const allVariable = variableSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense,
  );
  const allIncome = incomeSnap.docs.map((d) => ({ ...(d.data() as Omit<BranchIncome, "id">), id: d.id }) as BranchIncome);

  const branchIds = new Set(branches.map((b) => b.id));
  const month = currentMonth();

  const sharedFixed = allFixed.filter((e) => e.branchId === SHARED_EXPENSE_BRANCH_ID);
  const sharedVariable = allVariable.filter((e) => e.branchId === SHARED_EXPENSE_BRANCH_ID);
  const sharedExpenseTotal = expenseTotalToDate(sharedFixed, sharedVariable, month);
  const sharedExpenseShare = branches.length > 0 ? sharedExpenseTotal / branches.length : 0;

  const incomesByBranch = new Map<string, BranchIncome[]>();
  for (const inc of allIncome) {
    if (!branchIds.has(inc.branchId)) continue;
    const arr = incomesByBranch.get(inc.branchId) ?? [];
    arr.push(inc);
    incomesByBranch.set(inc.branchId, arr);
  }

  const statsByBranch = new Map<string, ComputerRoomBranchStats>();
  for (const b of branches) {
    const fixed = allFixed.filter((e) => e.branchId === b.id);
    const variable = allVariable.filter((e) => e.branchId === b.id);
    const ownExpensesToDate = expenseTotalToDate(fixed, variable, month);
    // Real investment wins over the estimate whenever the asset layer knows about this branch.
    const assetInvestment = assets.investmentByLocation.get(b.id)?.total ?? 0;
    const setupFromAssets = assetInvestment > 0;
    const setupCost = setupFromAssets ? assetInvestment : b.setupCost ?? 0;
    const spentToDate = setupCost + ownExpensesToDate + sharedExpenseShare;
    const incomeToDate = (incomesByBranch.get(b.id) ?? []).reduce((sum, i) => sum + (i.amount || 0), 0);
    // Operating profit is what pays the investment back - the equipment cost itself is NOT
    // subtracted from it (כלל 7), only compared against it.
    const operatingProfit = incomeToDate - ownExpensesToDate - sharedExpenseShare;
    const monthsRun = b.openedAt ? monthsBetween(b.openedAt, month).length : 0;
    statsByBranch.set(b.id, {
      branch: b,
      setupCost,
      setupFromAssets,
      payback: paybackStatus(setupCost, operatingProfit, monthsRun > 0 ? operatingProfit / monthsRun : 0),
      ownExpensesToDate,
      sharedExpenseShare,
      spentToDate,
      incomeToDate,
      profitHeld: incomeToDate - spentToDate,
    });
  }

  return { branches, statsByBranch, sharedFixed, sharedVariable, sharedExpenseTotal, incomesByBranch };
}

/*
 * loadComputerRoomSetupCostTotal() used to live here and was added on top of the main ledger's
 * expense total by hand, because setup cost is not a dated transaction. It is one now: a room's
 * setup is projected as a CAPITAL transaction (lib/tx-data.ts), so it reaches the model with a
 * date, appears in the capital memo below the bottom line, and stays out of operating profit
 * where it never belonged. Nothing is added on top anywhere any more.
 */
