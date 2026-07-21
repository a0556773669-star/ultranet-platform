/**
 * Reconciles one-time (variable) branch expenses - from both the rentals (ניידים) and
 * computer-rooms (נייחים) expense modules - into the main ledger (n_ah_expenses).
 * Only counts as a real owner expense when the owner actually paid it (paidBy === "owner"),
 * and even then only the owner's true share (ownerExpenseBurden, driven by `owedBy`).
 * An expense the partner paid is NOT written here even if the owner owes part/all of it - the
 * owner never had a real cash outflow for it, so it nets out of the partner's month-end
 * settlement transfer instead (see lib/branch-accounting.ts: ownerLedgerExpenseAmount).
 * Fixed/recurring expenses are handled separately (see lib/owner-expense-burden.ts) since they
 * recur every month rather than being a single dated transaction.
 */
import { getAdminFirestore } from "./firebase-admin";
import { ownerLedgerExpenseAmount } from "./branch-accounting";
import type { AccountingExpense } from "@ultranet/shared-types";

export async function createLinkedOwnerLedgerExpense(params: {
  business: AccountingExpense["business"];
  desc: string;
  amount: number;
  paidBy?: string;
  owedBy?: string;
  date: string;
}): Promise<string | undefined> {
  const ledgerAmount = ownerLedgerExpenseAmount(params.amount, params.paidBy, params.owedBy);
  if (ledgerAmount <= 0) return undefined;
  const data: Omit<AccountingExpense, "id"> = {
    amount: ledgerAmount,
    desc: params.desc,
    business: params.business,
    date: params.date,
    month: params.date.slice(0, 7),
  };
  const ref = await getAdminFirestore().collection("n_ah_expenses").add(data);
  return ref.id;
}

export async function deleteLinkedOwnerLedgerExpense(id: string | undefined): Promise<void> {
  if (!id) return;
  await getAdminFirestore().collection("n_ah_expenses").doc(id).delete();
}
