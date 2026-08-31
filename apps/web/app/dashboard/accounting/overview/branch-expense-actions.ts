"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { BranchIncome, VariableExpense } from "@ultranet/shared-types";

/**
 * Result of a save, returned rather than thrown.
 *
 * A server action that throws gives the browser nothing to show: the form just sits there and
 * the button looks broken. Every failure here comes back as a message the form renders, so a
 * save either visibly succeeds or visibly says why it didn't.
 */
export interface SaveResult {
  ok: boolean;
  message: string;
}

async function branchAccessError(branchId: string): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session) return "נדרשת התחברות מחדש";
  if (session.user?.role === "owner") return null;
  if (session.user?.branchId === branchId) return null;
  return "אין לך הרשאה להוסיף הוצאה לסניף הזה";
}

export async function addBranchExpenseAction(branchId: string, formData: FormData): Promise<SaveResult> {
  try {
    if (!branchId) return { ok: false, message: "לא זוהה סניף" };

    const denied = await branchAccessError(branchId);
    if (denied) return { ok: false, message: denied };

    const date = String(formData.get("date") ?? "").trim();
    const rawAmount = String(formData.get("amount") ?? "").replace(/[₪,\s]/g, "");
    const amount = Number(rawAmount);
    const desc = String(formData.get("desc") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const owedBy = String(formData.get("owedBy") ?? "").trim();
    const paidBy = String(formData.get("paidBy") ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "נא לבחור תאריך" };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "נא להזין סכום גדול מאפס" };
    if (!desc && !category) return { ok: false, message: "נא להזין תיאור או לבחור קטגוריה" };

    const db = getAdminFirestore();
    const branchDoc = await db.collection("n_branches").doc(branchId).get();
    if (!branchDoc.exists) return { ok: false, message: "הסניף לא נמצא במערכת" };

    const data: Omit<VariableExpense, "id"> = {
      branchId,
      amount,
      desc: desc || category,
      date,
      month: date.slice(0, 7),
      paidBy: paidBy === "partner" ? "partner" : "owner",
      ...(category ? { category } : {}),
      ...(owedBy ? { owedBy } : {}),
    };

    await db.collection("n_var_expenses").add(data);

    revalidatePath(`/dashboard/accounting/overview/${branchId}`);
    revalidatePath("/dashboard/accounting/overview");
    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/rentals/expenses");

    const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
    return { ok: true, message: `נשמר: ${data.desc} — ${nf.format(Math.round(amount))} ₪` };
  } catch (err) {
    return {
      ok: false,
      message: `השמירה נכשלה: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`,
    };
  }
}

/**
 * Income recorded straight onto a branch (n_branch_income).
 *
 * This is also what takes a branch out of "לא התחיל" - a branch's book opens on its first
 * income, never on an expense - so a branch manager entering their first takings is what
 * starts the whole calculation for that branch.
 */
export async function addBranchIncomeAction(branchId: string, formData: FormData): Promise<SaveResult> {
  try {
    if (!branchId) return { ok: false, message: "לא זוהה סניף" };

    const denied = await branchAccessError(branchId);
    if (denied) return { ok: false, message: denied };

    const date = String(formData.get("date") ?? "").trim();
    const rawAmount = String(formData.get("amount") ?? "").replace(/[₪,\s]/g, "");
    const amount = Number(rawAmount);
    const desc = String(formData.get("desc") ?? "").trim();
    const heldBy = String(formData.get("collectedBy") ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "נא לבחור תאריך" };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "נא להזין סכום גדול מאפס" };

    const db = getAdminFirestore();
    const branchDoc = await db.collection("n_branches").doc(branchId).get();
    if (!branchDoc.exists) return { ok: false, message: "הסניף לא נמצא במערכת" };

    const data: Omit<BranchIncome, "id"> = {
      branchId,
      amount,
      desc: desc || "הכנסה",
      date,
      month: date.slice(0, 7),
      collectedByOwner: heldBy === "owner",
    };
    await db.collection("n_branch_income").add(data);

    revalidatePath(`/dashboard/accounting/overview/${branchId}`);
    revalidatePath("/dashboard/accounting/overview");
    revalidatePath("/dashboard/rentals/accounting");
    revalidatePath("/dashboard/rentals/expenses");

    const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
    return { ok: true, message: `נשמר: ${data.desc} — ${nf.format(Math.round(amount))} ₪` };
  } catch (err) {
    return {
      ok: false,
      message: `השמירה נכשלה: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`,
    };
  }
}
