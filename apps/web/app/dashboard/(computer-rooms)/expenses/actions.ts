"use server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { Branch, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { SHARED_EXPENSE_BRANCH_ID } from "@/lib/computer-room-accounting";
import { createLinkedOwnerLedgerExpense, deleteLinkedOwnerLedgerExpense } from "@/lib/branch-expense-ledger";

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

/**
 * requireBranchAccess only proves the caller may act on `branchId` - it says nothing about
 * whether `id` actually belongs to that branch. Without this check a partner could pass their
 * own (permitted) branchId alongside another branch's expense id and mutate/delete it.
 */
async function loadOwnedFixedExpense(id: string, branchId: string) {
  const ref = getAdminFirestore().collection("n_fixed_expenses").doc(id);
  const doc = await ref.get();
  const data = doc.data() as Omit<FixedExpense, "id"> | undefined;
  if (!data || data.branchId !== branchId) throw new Error("ההוצאה לא נמצאה בסניף הזה");
  return { ref, data };
}

async function loadOwnedVariableExpense(id: string, branchId: string) {
  const ref = getAdminFirestore().collection("n_var_expenses").doc(id);
  const doc = await ref.get();
  const data = doc.data() as Omit<VariableExpense, "id"> | undefined;
  if (!data || data.branchId !== branchId) throw new Error("ההוצאה לא נמצאה בסניף הזה");
  return { ref, data };
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
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/computer-rooms-accounting");
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard");
}

export async function endFixedExpenseAction(id: string, branchId: string, formData: FormData) {
  await requireBranchAccess(branchId);
  const { ref } = await loadOwnedFixedExpense(id, branchId);
  const endDate = String(formData.get("endDate") ?? "").trim() || new Date().toISOString().slice(0, 10);
  await ref.set({ endDate }, { merge: true });
  revalidatePath(`/dashboard/expenses/${branchId}`);
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/computer-rooms-accounting");
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard");
}

export async function deleteFixedExpenseAction(id: string, branchId: string) {
  await requireBranchAccess(branchId);
  const { ref } = await loadOwnedFixedExpense(id, branchId);
  await ref.delete();
  revalidatePath(`/dashboard/expenses/${branchId}`);
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/computer-rooms-accounting");
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard");
}

export async function updateFixedExpenseAction(id: string, branchId: string, formData: FormData) {
  await requireBranchAccess(branchId);
  const { ref } = await loadOwnedFixedExpense(id, branchId);
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const startDate = String(formData.get("startDate") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || undefined;
  const paidBy = String(formData.get("paidBy") ?? "owner").trim() || "owner";
  const owedBy = String(formData.get("owedBy") ?? "owner").trim() || "owner";
  if (!name || !startDate) {
    throw new Error("חובה למלא שם ותאריך התחלה");
  }
  const data = { name, amount, startDate, category: category ?? FieldValue.delete(), paidBy, owedBy };
  await ref.set(data, { merge: true });
  revalidatePath(`/dashboard/expenses/${branchId}`);
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/computer-rooms-accounting");
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard");
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
    paidBy,
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
  revalidatePath("/dashboard/computer-rooms-accounting");
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard");
}

export async function updateVariableExpenseAction(id: string, branchId: string, formData: FormData) {
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
  const { ref, data: existing } = await loadOwnedVariableExpense(id, branchId);
  await deleteLinkedOwnerLedgerExpense(existing.linkedAhExpenseId);

  let branchLabel = "כל סניפי חדרי המחשבים";
  if (branchId !== SHARED_EXPENSE_BRANCH_ID) {
    const branchDoc = await db.collection("n_branches").doc(branchId).get();
    branchLabel = (branchDoc.data() as Omit<Branch, "id"> | undefined)?.name ?? branchLabel;
  }
  const linkedAhExpenseId = await createLinkedOwnerLedgerExpense({
    business: "computers",
    desc: `${desc} — ${branchLabel}`,
    amount,
    paidBy,
    owedBy,
    date,
  });

  const data = {
    desc,
    amount,
    date,
    month,
    category: category ?? FieldValue.delete(),
    paidBy,
    owedBy,
    linkedAhExpenseId: linkedAhExpenseId ?? FieldValue.delete(),
  };
  await ref.set(data, { merge: true });
  revalidatePath(`/dashboard/expenses/${branchId}`);
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/computer-rooms-accounting");
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard");
}

export async function deleteVariableExpenseAction(id: string, branchId: string) {
  await requireBranchAccess(branchId);
  const { ref, data: existing } = await loadOwnedVariableExpense(id, branchId);
  await deleteLinkedOwnerLedgerExpense(existing.linkedAhExpenseId);
  await ref.delete();
  revalidatePath(`/dashboard/expenses/${branchId}`);
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/computer-rooms-accounting");
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard");
}
