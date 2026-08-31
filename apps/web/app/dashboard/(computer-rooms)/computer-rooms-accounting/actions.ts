"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { BranchIncome } from "@ultranet/shared-types";

async function requireBranchAccess(branchId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  if (session.user?.role === "owner") return session;
  if (session.user?.role === "partner" && session.user?.branchId === branchId) return session;
  throw new Error("אין הרשאה");
}

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
  return session;
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k in obj) if (obj[k] !== undefined && obj[k] !== "") out[k] = obj[k];
  return out;
}

/** Adds one manual monthly income row for a computer-room branch. View-only tracking -
 *  intentionally does NOT touch n_ah_income, so it never reconciles into the main ledger. */
export async function addBranchIncomeAction(branchId: string, formData: FormData) {
  await requireBranchAccess(branchId);
  const date = String(formData.get("date") ?? "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const desc = String(formData.get("desc") ?? "").trim();
  if (!date || !amount) {
    throw new Error("חובה למלא תאריך וסכום");
  }
  const data: Omit<BranchIncome, "id"> = stripUndefined({
    branchId,
    amount,
    desc: desc || "הכנסת חודש",
    date,
    month: date.slice(0, 7),
  });
  await getAdminFirestore().collection("n_branch_income").add(data);
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard/computer-rooms-accounting");
  redirect(`/dashboard/computer-rooms-accounting/${branchId}`);
}

export async function deleteBranchIncomeAction(id: string, branchId: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_branch_income").doc(id).delete();
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard/computer-rooms-accounting");
  redirect(`/dashboard/computer-rooms-accounting/${branchId}`);
}
