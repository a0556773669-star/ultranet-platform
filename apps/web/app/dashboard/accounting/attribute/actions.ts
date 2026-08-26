"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingExpense, VariableExpense } from "@ultranet/shared-types";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
}

/** One decision the owner made on the attribution screen. */
export interface Attribution {
  /** the n_ah_expenses doc being attributed */
  id: string;
  /** the branches the amount is charged to; more than one = split evenly between them */
  branchIds: string[];
}

export interface AttributeResult {
  moved: number;
  created: number;
  notes: string[];
  error?: string;
}

/**
 * Moves expenses out of the owner's personal ledger (n_ah_expenses) into the branch books
 * (n_var_expenses), one row per branch. An expense that covers several branches ("כל סניפי
 * חדרי המחשבים") is split evenly between them, so the total charged stays exactly the original
 * amount and nothing is counted twice.
 *
 * This is a MOVE, not a copy: the personal-ledger row is deleted in the same batch. The two
 * books are never summed together, so leaving the row in both would double the expense.
 */
export async function attributeExpensesAction(payload: string): Promise<AttributeResult> {
  await requireOwner();

  let items: Attribution[];
  try {
    items = JSON.parse(payload) as Attribution[];
  } catch {
    return { moved: 0, created: 0, notes: [], error: "לא הצלחתי לקרוא את הנתונים שנשלחו" };
  }

  const valid = items.filter((i) => i.id && i.branchIds.length > 0);
  if (valid.length === 0) {
    return { moved: 0, created: 0, notes: [], error: "לא נבחר אף סניף" };
  }

  const db = getAdminFirestore();
  const notes: string[] = [];
  let moved = 0;
  let created = 0;

  const branchesSnap = await db.collection("n_branches").get();
  const branchName = new Map(branchesSnap.docs.map((d) => [d.id, (d.data() as { name?: string }).name ?? d.id]));

  for (const item of valid) {
    const ref = db.collection("n_ah_expenses").doc(item.id);
    const doc = await ref.get();
    if (!doc.exists) {
      notes.push("שורה אחת כבר לא קיימת — דילגתי");
      continue;
    }
    const e = doc.data() as Omit<AccountingExpense, "id">;
    const amount = e.amount ?? 0;
    const targets = item.branchIds.filter((id) => branchName.has(id));
    if (targets.length === 0) {
      notes.push(`"${e.desc ?? ""}" — אף אחד מהסניפים שנבחרו לא נמצא, דילגתי`);
      continue;
    }

    // split evenly, then give the rounding remainder to the first branch so the parts always
    // add back up to the original amount to the shekel
    const per = Math.floor((amount / targets.length) * 100) / 100;
    const parts = targets.map((_, i) =>
      i === 0 ? Math.round((amount - per * (targets.length - 1)) * 100) / 100 : per,
    );

    const batch = db.batch();
    targets.forEach((branchId, i) => {
      const data: Omit<VariableExpense, "id"> = {
        branchId,
        amount: parts[i]!,
        desc: e.desc || e.category || "הוצאה",
        date: e.date,
        month: e.month || (e.date ?? "").slice(0, 7),
        paidBy: "owner",
        ...(e.category ? { category: e.category } : {}),
      };
      batch.set(db.collection("n_var_expenses").doc(), data);
      created += 1;
    });
    batch.delete(ref);
    await batch.commit();
    moved += 1;

    if (targets.length > 1) {
      notes.push(
        `"${e.desc ?? ""}" ${Math.round(amount)} ₪ פוצל בין ${targets.length} סניפים (${targets
          .map((id) => branchName.get(id))
          .join(", ")})`,
      );
    }
  }

  revalidatePath("/dashboard/accounting/attribute");
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath("/dashboard/accounting/entries");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/rentals/expenses");

  return { moved, created, notes };
}
