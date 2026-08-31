"use server";

/**
 * Ticking a branch-entered row off the review list.
 *
 * Reviewing changes NO number: the row already counted from the moment it was entered. All this
 * records is that the owner looked at it, which is what keeps the list a list and not a gate.
 */
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { TX_COLLECTION } from "@/lib/tx";
import type { Transaction } from "@ultranet/shared-types";

function revalidate() {
  revalidatePath("/dashboard/accounting/review");
}

export async function markReviewedAction(id: string) {
  await requireOwner();
  if (!id) throw new Error("לא זוהתה שורה");
  await getAdminFirestore()
    .collection(TX_COLLECTION)
    .doc(id)
    .set({ reviewedAt: new Date().toISOString() }, { merge: true });
  revalidate();
}

export async function markAllReviewedAction() {
  await requireOwner();
  const db = getAdminFirestore();
  const snap = await db.collection(TX_COLLECTION).get();
  const pending = snap.docs.filter((d) => {
    const tx = d.data() as Partial<Transaction>;
    return !!tx.enteredBy && !tx.reviewedAt;
  });
  if (pending.length === 0) return;

  const reviewedAt = new Date().toISOString();
  // Chunked: a Firestore batch holds 500 writes, and a month of thirty branches can exceed that.
  const PER_BATCH = 400;
  for (let i = 0; i < pending.length; i += PER_BATCH) {
    const batch = db.batch();
    for (const d of pending.slice(i, i + PER_BATCH)) batch.set(d.ref, { reviewedAt }, { merge: true });
    await batch.commit();
  }
  revalidate();
}
