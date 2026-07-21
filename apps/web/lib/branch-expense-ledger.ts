/**
 * Reconciles one-time (variable) branch expenses - from both the rentals (ניידים) and
 * computer-rooms (נייחים) expense modules - into the main ledger (n_ah_expenses).
 * Only the OWNER's actual economic burden counts (ownerExpenseBurden, driven by `owedBy`):
 * an expense someone else (the partner) owes is not the owner's cost and is never written here.
 * Fixed/recurring expenses are handled separately (see lib/owner-expense-burden.ts) since they
 * recur every month rather than being a single dated transaction.
 */
import { getAdminFirestore } from "./firebase-admin";
import { ownerExpenseBurden } from "./branch-accounting";
import type { AccountingExpense } from "@ultranet/shared-types";

export async function createLinkedOwnerLedgerExpense(params: {
  business: AccountingExpense["business"];
  desc: string;
  amount: number;
  owedBy?: string;
  date: string;
}): Promise<string | undefined> {
  const burden = ownerExpenseBurden(params.amount, params.owedBy);
  if (burden <= 0) return undefined;
  const data: Omit<AccountingExpense, "id"> = {
    amount: burden,
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
