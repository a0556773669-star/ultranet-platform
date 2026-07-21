/**
 * Investment-vs-profit tracking for חדרי מחשבים (computer-room) branches.
 * Deliberately separate from n_ah_income/n_ah_expenses (the main ledger): this is a
 * per-branch view of setup cost, money spent, and money in, for owner/partner visibility only.
 * It never reconciles into the main accounting totals or the home dashboard.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { Branch, FixedExpense, VariableExpense, BranchIncome } from "@ultranet/shared-types";
import { monthsBetween } from "./branch-accounting";
import { SHARED_COMPUTERS_BRANCH_ID } from "./expense-shared-scope";

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
  setupCost: number;
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
  const [branchesSnap, fixedSnap, variableSnap, incomeSnap] = await Promise.all([
    db.collection("n_branches").where("branchType", "==", "computers").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection("n_branch_income").get(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const allFixed = fixedSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FixedExpense, "id">) }) as FixedExpense);
  const allVariable = variableSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<VariableExpense, "id">) }) as VariableExpense,
  );
  const allIncome = incomeSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BranchIncome, "id">) }) as BranchIncome);

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
    const setupCost = b.setupCost ?? 0;
    const spentToDate = setupCost + ownExpensesToDate + sharedExpenseShare;
    const incomeToDate = (incomesByBranch.get(b.id) ?? []).reduce((sum, i) => sum + (i.amount || 0), 0);
    statsByBranch.set(b.id, {
      branch: b,
      setupCost,
      ownExpensesToDate,
      sharedExpenseShare,
      spentToDate,
      incomeToDate,
      profitHeld: incomeToDate - spentToDate,
    });
  }

  return { branches, statsByBranch, sharedFixed, sharedVariable, sharedExpenseTotal, incomesByBranch };
}
