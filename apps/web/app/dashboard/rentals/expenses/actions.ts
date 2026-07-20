"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { FixedExpense, VariableExpense } from "@ultranet/shared-types";

async function requireBranchAccess(branchId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  if (session.user?.role === "owner") return session;
  if (session.user?.branchId === branchId) return session;
  throw new Error("אין הרשאה");
}

// בעלים יכול לנהל כל הוצאה; שותף יכול לנהל (לסיים/למחוק) רק הוצאה שהוא עצמו רשם.
async function requireOwnerOrCreator(collection: "n_fixed_expenses" | "n_var_expenses", id: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  if (session.user?.role === "owner") return session;
  const email = (session.user?.email ?? "").toLowerCase();
  const doc = await getAdminFirestore().collection(collection).doc(id).get();
  const data = doc.data() as { createdByEmail?: string } | undefined;
  if (email && data?.createdByEmail && data.createdByEmail === email) return session;
  throw new Error("אין הרשאה - ניתן לנהל רק הוצאות שרשמת בעצמך");
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export async function createFixedExpenseAction(branchId: string, formData: FormData) {
  const session = await requireBranchAccess(branchId);
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const startDate = String(formData.get("startDate") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || undefined;
  const paidBy = String(formData.get("paidBy") ?? "owner").trim() || "owner";
  const owedBy = String(formData.get("owedBy") ?? "owner").trim() || "owner";
  if (!name || !startDate) {
    throw new Error("חובה למלא שם ותאריך התחלה");
  }
  const createdByEmail = session.user?.email?.toLowerCase() || undefined;
  const data: Omit<FixedExpense, "id"> = { branchId, name, amount, startDate, category, paidBy, owedBy, createdByEmail };
  await getAdminFirestore().collection("n_fixed_expenses").add(stripUndefined(data));
  revalidatePath(`/dashboard/rentals/expenses/${branchId}`);
  redirect(`/dashboard/rentals/expenses/${branchId}`);
}

export async function endFixedExpenseAction(id: string, branchId: string, formData: FormData) {
  await requireOwnerOrCreator("n_fixed_expenses", id);
  const endDate = String(formData.get("endDate") ?? "").trim() || new Date().toISOString().slice(0, 10);
  await getAdminFirestore().collection("n_fixed_expenses").doc(id).set({ endDate }, { merge: true });
  revalidatePath(`/dashboard/rentals/expenses/${branchId}`);
  redirect(`/dashboard/rentals/expenses/${branchId}`);
}

export async function deleteFixedExpenseAction(id: string, branchId: string) {
  await requireOwnerOrCreator("n_fixed_expenses", id);
  await getAdminFirestore().collection("n_fixed_expenses").doc(id).delete();
  revalidatePath(`/dashboard/rentals/expenses/${branchId}`);
  redirect(`/dashboard/rentals/expenses/${branchId}`);
}

export async function createVariableExpenseAction(branchId: string, formData: FormData) {
  const session = await requireBranchAccess(branchId);
  const desc = String(formData.get("desc") ?? "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const date = String(formData.get("date") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || undefined;
  const paidBy = String(formData.get("paidBy") ?? "owner").trim() || "owner";
  const owedBy = String(formData.get("owedBy") ?? "owner").trim() || "owner";
  if (!desc || !date || !amount) {
    throw new Error("חובה למלא תיאור, סכום ותאריך");
  }
  const month = date.slice(0, 7);
  const createdByEmail = session.user?.email?.toLowerCase() || undefined;
  const data: Omit<VariableExpense, "id"> = { branchId, desc, amount, date, month, category, paidBy, owedBy, createdByEmail };
  await getAdminFirestore().collection("n_var_expenses").add(stripUndefined(data));
  revalidatePath(`/dashboard/rentals/expenses/${branchId}`);
  redirect(`/dashboard/rentals/expenses/${branchId}`);
}

export async function deleteVariableExpenseAction(id: string, branchId: string) {
  await requireOwnerOrCreator("n_var_expenses", id);
  await getAdminFirestore().collection("n_var_expenses").doc(id).delete();
  revalidatePath(`/dashboard/rentals/expenses/${branchId}`);
  redirect(`/dashboard/rentals/expenses/${branchId}`);
}
