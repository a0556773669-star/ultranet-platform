"use server";

import { revalidatePath } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";
import type { BranchTransfer } from "@ultranet/shared-types";

/**
 * Records (or corrects) the actual ₪ amount transferred for a branch/month, owner-only.
 * Same sign convention as netToOwner: positive = partner/branch paid the owner,
 * negative = the owner paid the branch/partner. Can be called on any past month, not just
 * the current one, so the owner can log a late or partial payment against old debt.
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
  const data: Omit<BranchTransfer, "id"> = {
    branchId,
    month,
    netToOwner,
    incomeShareToOwner,
    expenseNetToOwner,
    transferred: transferredAmount !== 0,
    transferredAt: new Date().toISOString(),
    transferredAmount,
    note: note || "",
  };
  await db.collection("n_branch_transfers").doc(id).set(data, { merge: true });
  revalidatePath("/dashboard/rentals/ledger");
  revalidatePath("/dashboard/rentals/accounting");
}
