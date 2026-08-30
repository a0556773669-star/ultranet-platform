"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/perms";
import { deleteLeftoverMirrors } from "@/lib/integrity";

/**
 * Removes the mirror rows the old model left behind in n_ah_expenses.
 *
 * Safe by construction rather than by care: the flow book is derived from the transactions
 * themselves, so a mirror already contributes nothing to any total. Deleting it changes no
 * number on any screen - it only stops the row from sitting there looking like money.
 */
export async function cleanupMirrorsAction() {
  await requireOwner();
  await deleteLeftoverMirrors();
  revalidatePath("/dashboard/accounting/integrity");
  revalidatePath("/dashboard/accounting/entries");
  revalidatePath("/dashboard/accounting/overview");
}
