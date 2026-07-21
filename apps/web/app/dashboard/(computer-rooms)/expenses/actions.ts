"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { SHARED_EXPENSE_BRANCH_ID } from "@/lib/computer-room-accounting";
import { createLinkedOwnerLedgerExpense, deleteLinkedOwnerLedgerExpense } from "@/lib/branch-expense-ledger";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  if (session.user?.role !== "owner") throw new Error("אין הרשאה");
  return session;
}

async function requireBranchAccess(branchId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  if (session.user?.role === "owner") return session;
  if (branchId === SHARED_EXPENSE_BRANCH_ID) throw new Error("אין הרשאה");
  if (session.user?.branchId === branchId) return session;
  throw new Error("אין הרשאה");
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export async function createFixedExpenseAction(branchId: string, formData: FormData) {
  await requireBranchAccess(branchId);
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const startDate = String(formData.get("startDate") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || undefined;
  const paidBy = String(formData.get("paidBy") ?? "owner").trim() || "owner";
  const owedBy = String(formData.get("owedBy") ?? "owner").trim() || "owner";
  if (!name || !startDate) {
    throw new Error("חובה למלא שם ותאריך התחלה");
  }
  const data: Omit<FixedExpense, "id"> = { branchId, name, amount, startDate, category, paidBy, owedBy };
  await getAdminFirestore().collection("n_fixed_expenses").add(stripUndefined(data));
  revalidatePath(`/dashboard/expenses/${branchId}`);
  redirect(`/dashboard/expenses/${branchId}`);
}

export async function endFixedExpenseAction(id: string, branchId: string, formData: FormData) {
  await requireOwner();
  const endDate = String(formData.get("endDate") ?? "").trim() || new Date().toISOString().slice(0, 10);
  await getAdminFirestore().collection("n_fixed_expenses").doc(id).set({ endDate }, { merge: true });
  revalidatePath(`/dashboard/expenses/${branchId}`);
  redirect(`/dashboard/expenses/${branchId}`);
}

export async function deleteFixedExpenseAction(id: string, branchId: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_fixed_expenses").doc(id).delete();
  revalidatePath(`/dashboard/expenses/${branchId}`);
  redirect(`/dashboard/expenses/${branchId}`);
}

export async function createVariableExpenseAction(branchId: string, formData: FormData) {
  await requireBranchAccess(branchId);
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

  const db = getAdminFirestore();
  let branchLabel = "כל סניפי חדרי המחשבים";
  if (branchId !== SHARED_EXPENSE_BRANCH_ID) {
    const branchDoc = await db.collection("n_branches").doc(branchId).get();
    branchLabel = (branchDoc.data() as Omit<Branch, "id"> | undefined)?.name ?? branchLabel;
  }
  const linkedAhExpenseId = await createLinkedOwnerLedgerExpense({
    business: "computers",
    desc: `${desc} — ${branchLabel}`,
    amount,
    owedBy,
    date,
  });

  const data: Omit<VariableExpense, "id"> = {
    branchId,
    desc,
    amount,
    date,
    month,
    category,
    paidBy,
    owedBy,
    linkedAhExpenseId,
  };
  await db.collection("n_var_expenses").add(stripUndefined(data));
  revalidatePath(`/dashboard/expenses/${branchId}`);
  revalidatePath("/dashboard/accounting");
  redirect(`/dashboard/expenses/${branchId}`);
}

export async function deleteVariableExpenseAction(id: string, branchId: string) {
  await requireOwner();
  const db = getAdminFirestore();
  const doc = await db.collection("n_var_expenses").doc(id).get();
  const linkedAhExpenseId = (doc.data() as Omit<VariableExpense, "id"> | undefined)?.linkedAhExpenseId;
  await deleteLinkedOwnerLedgerExpense(linkedAhExpenseId);
  await db.collection("n_var_expenses").doc(id).delete();
  revalidatePath(`/dashboard/expenses/${branchId}`);
  revalidatePath("/dashboard/accounting");
  redirect(`/dashboard/expenses/${branchId}`);
}
