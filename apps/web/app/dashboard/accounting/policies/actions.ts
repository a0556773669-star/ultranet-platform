"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { ExpensePolicyKey } from "@ultranet/shared-types";
import { EXPENSE_POLICY_KEYS } from "@/lib/expense-policy";

/**
 * Saving one branch's payment agreement (פרק יד׳).
 *
 * Changing an agreement is ONE field here - not a retroactive edit of dozens of expense rows.
 * That is deliberate and it follows the same rule as everything else in the model: the past is
 * not rewritten. Rows already entered keep the split they were entered under; the new policy
 * applies to what comes next.
 */
export async function saveBranchPolicyAction(branchId: string, formData: FormData) {
  await requireOwner();
  if (!branchId) throw new Error("לא זוהה סניף");

  const policy: Partial<Record<ExpensePolicyKey, "owner" | "partner">> = {};
  for (const key of EXPENSE_POLICY_KEYS) {
    policy[key] = formData.get(`policy_${key}`) === "owner" ? "owner" : "partner";
  }

  await getAdminFirestore().collection("n_branches").doc(branchId).set({ expensePolicy: policy }, { merge: true });

  revalidatePath("/dashboard/accounting/policies");
  revalidatePath("/dashboard/my-expenses");
  revalidatePath(`/dashboard/accounting/overview/${branchId}`);
}
