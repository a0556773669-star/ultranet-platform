"use server";

import { revalidatePath } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireModuleAccess } from "@/lib/perms";
import type { BranchTransfer } from "@ultranet/shared-types";
import { syncBranchTransferIncome } from "@/lib/branch-income-ledger";

/** Also keeps a linked n_ah_income record in sync (lib/branch-income-ledger.ts) so a recorded
 *  transfer automatically shows up as income, both centrally and per-branch. */
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
    transferredAmount: netToOwner,
    linkedAhIncomeId: existing?.linkedAhIncomeId,
  });

  const data = {
    branchId,
    month,
    netToOwner,
    incomeShareToOwner,
    expenseNetToOwner,
    transferred: true,
    transferredAt: new Date().toISOString(),
    transferredAmount: netToOwner,
    linkedAhIncomeId: linkedAhIncomeId ?? FieldValue.delete(),
  };
  await db.collection("n_branch_transfers").doc(id).set(data, { merge: true });
  revalidatePath("/dashboard/settlement");
  revalidatePath("/dashboard/settlement");
  revalidatePath("/dashboard/accounting");
}
