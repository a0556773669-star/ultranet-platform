/**
 * The mirror mechanism — retired.
 *
 * WHAT IT USED TO DO
 * Every one-off branch expense wrote a SECOND document into n_ah_expenses holding the owner's
 * share of it, so the same cost could be seen from a second angle: once as the branch's expense,
 * once as the owner's cash outflow. Every edit had to delete and re-create that copy; every
 * screen had to know it was a copy and exclude it (`MovementEntry.mirror`) so it wasn't counted
 * twice. Fixed expenses could not be mirrored at all - they recur - so a whole parallel module
 * computed their owner burden live and added it on top, in each screen's own way.
 *
 * WHY IT IS GONE
 * A mirror is a copy of a row made so it can be looked at from another angle, and a query looks
 * at a row from any angle for free. The owner's cash book is now derived from the transaction
 * model (lib/business-ledger.ts: buildFlow / flowTotals - `paidBy === "owner"`, summing
 * `ownerShare`), which already sees branch expenses, recurring ones included. There is nothing
 * to keep in sync, nothing to re-create on edit, and nothing that can drift.
 *
 * WHY THE FUNCTION STAYS
 * Creating is now a no-op, kept so the eight call sites across the rentals, computer-rooms and
 * import screens keep working untouched and simply stop producing copies. Deleting stays real:
 * mirrors written before this change still exist in Firestore, and an expense being deleted must
 * still take its old copy with it. The leftovers are listed on the integrity screen and can be
 * removed in one action (lib/integrity.ts: deleteLeftoverMirrors).
 */
import { getAdminFirestore } from "./firebase-admin";

/**
 * No longer writes anything, and returns `undefined` so no `linkedAhExpenseId` is stored on the
 * new expense. Same signature as before on purpose: the callers do not need to change, and the
 * rule they were implementing is now enforced in one place instead of eight.
 */
export async function createLinkedOwnerLedgerExpense(_params: {
  business: string;
  desc: string;
  amount: number;
  paidBy?: string;
  owedBy?: string;
  date: string;
}): Promise<string | undefined> {
  return undefined;
}

/** Still real: an expense written before this change may carry an old mirror that must go with it. */
export async function deleteLinkedOwnerLedgerExpense(id: string | undefined): Promise<void> {
  if (!id) return;
  await getAdminFirestore().collection("n_ah_expenses").doc(id).delete();
}
