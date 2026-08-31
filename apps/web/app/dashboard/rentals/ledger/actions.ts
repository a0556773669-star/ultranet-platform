"use server";

import { revalidatePath } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireOwner } from "@/lib/perms";
import type { BranchTransfer } from "@ultranet/shared-types";
import { syncBranchTransferIncome } from "@/lib/branch-income-ledger";

/**
 * Records (or corrects) the actual ₪ amount transferred for a branch/month, owner-only.
 * Same sign convention as netToOwner: positive = partner/branch paid the owner,
 * negative = the owner paid the branch/partner. Can be called on any past month, not just
 * the current one, so the owner can log a late or partial payment against old debt.
 * Also keeps a linked n_ah_income record in sync (see lib/branch-income-ledger.ts) so a recorded
 * transfer automatically shows up as income, both centrally and per-branch, without re-typing it.
 */
export async function recordBranchTransferAction(
  branchId: string,
  month: string,
  netToOwner: number,
  incomeShareToOwner: number,
  expenseNetToOwner: number,
  transferredAmount: number,
  note: string
) {
  await requireOwner();
  const db = getAdminFirestore();
  const id = `${branchId}_${month}`;

  const [existingDoc, branchDoc] = await Promise.all([
    db.collection("n_branch_transfers").doc(id).get(),
    db.collection("n_branches").doc(branchId).get(),
  ]);
  const existing = existingDoc.data() as Omit<BranchTransfer, "id"> | undefined;
  const branchName = (branchDoc.data() as { name?: string } | undefined)?.name ?? branchId;

  const linkedAhIncomeId = await syncBranchTransferIncome({
    branchId,
    branchName,
    month,
    transferredAmount,
    linkedAhIncomeId: existing?.linkedAhIncomeId,
  });

  const data = {
    branchId,
    month,
    netToOwner,
    incomeShareToOwner,
    expenseNetToOwner,
    transferred: transferredAmount !== 0,
    transferredAt: new Date().toISOString(),
    transferredAmount,
    note: note || "",
    linkedAhIncomeId: linkedAhIncomeId ?? FieldValue.delete(),
  };
  await db.collection("n_branch_transfers").doc(id).set(data, { merge: true });
  revalidatePath("/dashboard/rentals/ledger");
  revalidatePath("/dashboard/rentals/accounting");
  revalidatePath("/dashboard/accounting");
}

/** Toggles whether a receipt was issued for a branch/month's transfer. Owner-only; doesn't touch
 *  the transfer amount or its linked income record. */
export async function setBranchTransferReceiptAction(branchId: string, month: string, receiptIssued: boolean) {
  await requireOwner();
  const db = getAdminFirestore();
  const id = `${branchId}_${month}`;
  await db.collection("n_branch_transfers").doc(id).set({ branchId, month, receiptIssued }, { merge: true });
  revalidatePath("/dashboard/rentals/ledger");
  revalidatePath("/dashboard/rentals/accounting");
}
