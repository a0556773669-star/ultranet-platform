"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingExpense, VariableExpense } from "@ultranet/shared-types";

/** Same contract as the branch form: never throw, always answer with something to display. */
export interface SaveResult {
  ok: boolean;
  message: string;
}

/**
 * Editing and deleting a saved row live in ./entry-actions.ts, which handles income and
 * expenses in both books through one pair of actions. This file only creates.
 */

/**
 * Saves an expense from the entry screen.
 * With a branch picked it goes to that branch's own book (n_var_expenses); without one it goes
 * to the owner's personal ledger (n_ah_expenses). The two books are never summed together, so
 * it is deliberately one or the other and never both.
 */
export async function saveExpenseAction(formData: FormData): Promise<SaveResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return { ok: false, message: "נדרשת התחברות מחדש" };
    if (session.user?.role !== "owner") return { ok: false, message: "רק הבעלים יכול להוסיף כאן הוצאה" };

    const date = String(formData.get("date") ?? "").trim();
    const rawAmount = String(formData.get("amount") ?? "").replace(/[₪,\s]/g, "");
    const amount = Number(rawAmount);
    const desc = String(formData.get("desc") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const branchId = String(formData.get("branchId") ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "נא לבחור תאריך" };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "נא להזין סכום גדול מאפס" };
    if (!desc && !category) return { ok: false, message: "נא להזין תיאור או לבחור קטגוריה" };

    const db = getAdminFirestore();
    const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
    const label = desc || category;

    if (branchId) {
      const branchDoc = await db.collection("n_branches").doc(branchId).get();
      if (!branchDoc.exists) return { ok: false, message: "הסניף שנבחר לא נמצא" };
      const branchName = (branchDoc.data() as { name?: string }).name ?? "הסניף";

      const data: Omit<VariableExpense, "id"> = {
        branchId,
        amount,
        desc: label,
        date,
        month: date.slice(0, 7),
        paidBy: "owner",
        ...(category ? { category } : {}),
      };
      await db.collection("n_var_expenses").add(data);
      revalidatePath("/dashboard/accounting/entries");
      revalidatePath("/dashboard/accounting/overview");
      revalidatePath(`/dashboard/accounting/overview/${branchId}`);
      revalidatePath("/dashboard/expenses");
      revalidatePath("/dashboard/rentals/expenses");
      return { ok: true, message: `נשמר אצל ${branchName}: ${label} — ${nf.format(Math.round(amount))} ₪` };
    }

    const data: Omit<AccountingExpense, "id"> = {
      date,
      amount,
      desc: label,
      business: "general",
      month: date.slice(0, 7),
      ...(category ? { category } : {}),
    };
    await db.collection("n_ah_expenses").add(data);
    revalidatePath("/dashboard/accounting/entries");
    revalidatePath("/dashboard/accounting/overview");
    return { ok: true, message: `נשמר בהנה"ח האישית: ${label} — ${nf.format(Math.round(amount))} ₪` };
  } catch (err) {
    return {
      ok: false,
      message: `השמירה נכשלה: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`,
    };
  }
}
