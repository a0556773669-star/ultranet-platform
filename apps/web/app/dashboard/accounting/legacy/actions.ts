"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { RECURRING_VAR_EXPENSES_COLLECTION } from "@/lib/recurring-expenses";
import { MULTI_BRANCH_EXPENSES_COLLECTION } from "@/lib/multi-branch-expense";

export type LegacyCollection = "fixed" | "variable" | "multi" | "extra" | "recurring";

const COLLECTION_OF: Record<LegacyCollection, string> = {
  fixed: "n_fixed_expenses",
  variable: "n_var_expenses",
  multi: MULTI_BRANCH_EXPENSES_COLLECTION,
  extra: "n_ah_expenses",
  recurring: RECURRING_VAR_EXPENSES_COLLECTION,
};

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") throw new Error("גישה זו מוגבלת לבעלים בלבד");
  return session;
}

function revalidateEverywhere() {
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/accounting/legacy");
  revalidatePath("/dashboard/accounting/extra-expenses");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/rentals/expenses");
  revalidatePath("/dashboard");
}

/** משנה את הדגל על שורה אחת. */
export async function setCountsToMainAction(collection: LegacyCollection, id: string, value: boolean) {
  await requireOwner();
  await getAdminFirestore().collection(COLLECTION_OF[collection]).doc(id).set({ countsToMain: value }, { merge: true });
  revalidateEverywhere();
}

/**
 * מחיל את אותה החלטה על קבוצה שלמה בבת אחת.
 *
 * זו הפעולה שהמסך קיים בשבילה: אחרי הוספת הדגל כל הדאטה ההיסטורי נמצא במצב "לא מתחשבן",
 * ולעבור על מאות שורות אחת-אחת זה לא עדכון אלא עונש. עדיין אין כאן "סמן הכל בעסק" -
 * הבחירה היא פר קבוצה (סניף/קולקשן), כי זו ההחלטה שבאמת מתקבלת: "כל ההוצאות של הסניף
 * הזה כן/לא נכנסות לספר".
 */
export async function bulkSetCountsToMainAction(collection: LegacyCollection, ids: string[], value: boolean) {
  await requireOwner();
  if (ids.length === 0) return;
  const db = getAdminFirestore();
  const col = db.collection(COLLECTION_OF[collection]);
  // Firestore caps a batch at 500 writes; chunking keeps a large branch from failing silently.
  for (let i = 0; i < ids.length; i += 400) {
    const batch = db.batch();
    for (const id of ids.slice(i, i + 400)) batch.set(col.doc(id), { countsToMain: value }, { merge: true });
    await batch.commit();
  }
  revalidateEverywhere();
}
