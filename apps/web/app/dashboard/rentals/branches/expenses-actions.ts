"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { FixedExpense, VariableExpense } from "@ultranet/shared-types";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("הפעולה זו מוגבלת לבעלים בלבד");
  }
  return session;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export async function createFixedExpenseAction(branchId: string, formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const startDate = String(formData.get("startDate") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || undefined;
  const payer = String(formData.get("payer") ?? "owner").trim() || "owner";
  if (!name || !startDate) {
    throw new Error("חובה שם ותאריך התחלה");
  }
  const data: Omit<FixedExpense, "id"> = { branchId, name, amount, startDate, category, payer };
  await getAdminFirestore().collection("n_fixed_expenses").add(stripUndefined(data));
  revalidatePath(`/dashboard/rentals/branches/${branchId}`);
  redirect(`/dashboard/rentals/branches/${branchId}`);
}

export async function endFixedExpenseAction(id: string, branchId: string, formData: FormData) {
  await requireOwner();
  const endDate = String(formData.get("endDate") ?? "").trim() || new Date().toISOString().slice(0, 10);
  await getAdminFirestore().collection("n_fixed_expenses").doc(id).set({ endDate }, { merge: true });
  revalidatePath(`/dashboard/rentals/branches/${branchId}`);
  redirect(`/dashboard/rentals/branches/${branchId}`);
}

export async function deleteFixedExpenseAction(id: string, branchId: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_fixed_expenses").doc(id).delete();
  revalidatePath(`/dashboard/rentals/branches/${branchId}`);
  redirect(`/dashboard/rentals/branches/${branchId}`);
}

export async function createVariableExpenseAction(branchId: string, formData: FormData) {
  await requireOwner();
  const desc = String(formData.get("desc") ?? "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const date = String(formData.get("date") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || undefined;
  const payer = String(formData.get("payer") ?? "owner").trim() || "owner";
  if (!desc || !date || !amount) {
    throw new Error("חובה תיאור, תאריך וסכום");
  }
  const month = date.slice(0, 7);
  const data: Omit<VariableExpense, "id"> = { branchId, desc, amount, date, month, category, payer };
  await getAdminFirestore().collection("n_var_expenses").add(stripUndefined(data));
  revalidatePath(`/dashboard/rentals/branches/${branchId}`);
  redirect(`/dashboard/rentals/branches/${branchId}`);
}

export async function deleteVariableExpenseAction(id: string, branchId: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_var_expenses").doc(id).delete();
  revalidatePath(`/dashboard/rentals/branches/${branchId}`);
  redirect(`/dashboard/rentals/branches/${branchId}`);
}
