/**
 * The amount that should actually hit the owner's cash ledger (ownerLedgerExpenseAmount - only
 * counts when the owner physically paid, and even then only their true share) from
 * *fixed/recurring* branch expenses across both the rentals (ניידים) and computer-rooms
 * (נייחים) modules, including each module's "shared / all branches" pool.
 *
 * Computed live and added on top of the main ledger (n_ah_expenses) totals - never written as
 * dated n_ah_expenses rows, because a fixed expense recurs every month rather than being a
 * single dated transaction (mirrors how lib/branch-accounting-data.ts already expands fixed
 * expenses for the rentals per-branch dashboard). One-time (variable) expenses ARE written
 * directly to n_ah_expenses when created (see lib/branch-expense-ledger.ts) and therefore
 * already show up in the normal n_ah_expenses totals with no special handling needed here.
 */
import { getAdminFirestore } from "./firebase-admin";
import { ownerLedgerExpenseAmount, monthsBetween } from "./branch-accounting";
import { SHARED_RENTALS_BRANCH_ID, SHARED_COMPUTERS_BRANCH_ID } from "./expense-shared-scope";
import type { FixedExpense } from "@ultranet/shared-types";

export interface OwnerFixedExpenseBurden {
  thisMonth: number;
  toDate: number;
}

export async function loadOwnerFixedExpenseBurden(): Promise<OwnerFixedExpenseBurden> {
  const db = getAdminFirestore();
  const [branchesSnap, fixedSnap] = await Promise.all([
    db.collection("n_branches").where("branchType", "in", ["rentals", "computers"]).get(),
    db.collection("n_fixed_expenses").get(),
  ]);

  const validBranchIds = new Set(branchesSnap.docs.map((d) => d.id));
  validBranchIds.add(SHARED_RENTALS_BRANCH_ID);
  validBranchIds.add(SHARED_COMPUTERS_BRANCH_ID);

  const month = new Date().toISOString().slice(0, 7);
  let thisMonth = 0;
  let toDate = 0;

  for (const doc of fixedSnap.docs) {
    const e = { id: doc.id, ...(doc.data() as Omit<FixedExpense, "id">) } as FixedExpense;
    if (!validBranchIds.has(e.branchId) || !e.startDate) continue;
    const amount = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
    const ledgerAmount = ownerLedgerExpenseAmount(amount, e.paidBy, e.owedBy);
    if (ledgerAmount <= 0) continue;
    const endMonth = e.endDate && e.endDate.slice(0, 7) < month ? e.endDate.slice(0, 7) : month;
    const activeMonths = monthsBetween(e.startDate, endMonth);
    toDate += ledgerAmount * activeMonths.length;
    if (activeMonths.includes(month)) thisMonth += ledgerAmount;
  }

  return { thisMonth, toDate };
}
