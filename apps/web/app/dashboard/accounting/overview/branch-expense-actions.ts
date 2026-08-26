"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { VariableExpense } from "@ultranet/shared-types";

/**
 * The owner may add an expense to any branch; a branch manager only to their own.
 * Anyone else is refused - this is the same rule the branch screen itself enforces.
 */
async function requireBranchAccess(branchId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("נדרשת התחברות");
  const role = session.user?.role;
  if (role === "owner") return;
  if (session.user?.branchId === branchId) return;
  throw new Error("אין לך הרשאה להוסיף הוצאה לסניף הזה");
}

export async function addBranchExpenseAction(branchId: string, formData: FormData) {
  await requireBranchAccess(branchId);

  const date = String(formData.get("date") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const desc = String(formData.get("desc") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const owedBy = String(formData.get("owedBy") ?? "").trim();
  const paidBy = String(formData.get("paidBy") ?? "").trim();

  if (!date) throw new Error("תאריך הוא שדה חובה");
  if (!amount || amount <= 0) throw new Error("נא להזין סכום גדול מאפס");
  if (!desc && !category) throw new Error("נא להזין תיאור או לבחור קטגוריה");

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

  await getAdminFirestore().collection("n_var_expenses").add(data);

  revalidatePath(`/dashboard/accounting/overview/${branchId}`);
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/rentals/expenses");
}
