"use server";

import { revalidatePath } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireModuleAccess } from "@/lib/perms";
import type { BranchTransfer } from "@ultranet/shared-types";

export async function markTransferredAction(
  branchId: string,
  month: string,
  netToOwner: number,
  incomeShareToOwner: number,
  expenseNetToOwner: number
) {
  await requireModuleAccess("rentals");
  const db = getAdminFirestore();
  const id = `${branchId}_${month}`;
  const data: Omit<BranchTransfer, "id"> = {
    branchId,
    month,
    netToOwner,
    incomeShareToOwner,
    expenseNetToOwner,
    transferred: true,
    transferredAt: new Date().toISOString(),
    transferredAmount: netToOwner,
  };
  await db.collection("n_branch_transfers").doc(id).set(data, { merge: true });
  revalidatePath("/dashboard/rentals/accounting");
  revalidatePath("/dashboard/rentals/ledger");
}
