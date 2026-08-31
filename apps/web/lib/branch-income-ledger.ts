/**
 * Keeps a n_ah_income record ("laptops" type) in sync with a branch/month's recorded transfer
 * (n_branch_transfers.transferredAmount), so marking a transfer as done automatically shows up
 * as income in both the main ledger (/dashboard/accounting) and per-branch (/dashboard/settlement)
 * without the owner re-typing it there by hand. Mirrors the branch-expense-ledger.ts pattern used
 * for one-time expenses (createLinkedOwnerLedgerExpense/deleteLinkedOwnerLedgerExpense).
 * Only a positive transferredAmount (partner/branch paid the owner) counts as owner income - a
 * negative amount (the owner paid the branch/partner) is not income and clears any existing link.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { AccountingIncome } from "@ultranet/shared-types";

export async function syncBranchTransferIncome(params: {
  branchId: string;
  branchName: string;
  month: string; // YYYY-MM
  transferredAmount: number;
  linkedAhIncomeId?: string;
}): Promise<string | undefined> {
  const db = getAdminFirestore();
  const amount = Math.round(params.transferredAmount);

  if (amount <= 0) {
    if (params.linkedAhIncomeId) {
      await db.collection("n_ah_income").doc(params.linkedAhIncomeId).delete().catch(() => undefined);
    }
    return undefined;
  }

  const data: Omit<AccountingIncome, "id"> = {
    amount,
    desc: `העברה מ${params.branchName} (${params.month})`,
    business: "rentals",
    type: "laptops",
    // Dated to the transfer's own month (not "today") so a late/backdated transfer for an old
    // month lands in that month's totals, not this month's - pages filter by date.slice(0,7).
    date: `${params.month}-01`,
    month: params.month,
    branchId: params.branchId,
  };

  if (params.linkedAhIncomeId) {
    await db.collection("n_ah_income").doc(params.linkedAhIncomeId).set(data, { merge: true });
    return params.linkedAhIncomeId;
  }
  const ref = await db.collection("n_ah_income").add(data);
  return ref.id;
}
