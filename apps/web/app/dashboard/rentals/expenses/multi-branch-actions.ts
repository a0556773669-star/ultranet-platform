"use server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, MultiBranchExpense } from "@ultranet/shared-types";
import { createLinkedOwnerLedgerExpense, deleteLinkedOwnerLedgerExpense } from "@/lib/branch-expense-ledger";
import { MULTI_BRANCH_EXPENSES_COLLECTION, splitMultiBranchExpense } from "@/lib/multi-branch-expense";
import { countsToMainFromForm } from "@/lib/counts-to-main";

/**
 * הוצאה חד-פעמית שמתחלקת בין כמה סניפי השכרות, עם אחוז שהבעלים לוקח על עצמו.
 * Owner-only: it charges branches the owner doesn't necessarily operate, so no partner may
 * create or remove one. The split itself lives in lib/multi-branch-expense.ts.
 */
async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  if (session.user?.role !== "owner") throw new Error("אין הרשאה");
  return session;
}

function revalidate(module: MultiBranchExpense["module"], branchIds: string[]) {
  const base = module === "computers" ? "/dashboard/expenses" : "/dashboard/rentals/expenses";
  for (const id of branchIds) revalidatePath(`${base}/${id}`);
  revalidatePath(base);
  revalidatePath("/dashboard/rentals/accounting");
  revalidatePath("/dashboard/computer-rooms-accounting");
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard");
}

export async function createMultiBranchExpenseAction(
  module: MultiBranchExpense["module"],
  formData: FormData,
) {
  await requireOwner();
  const desc = String(formData.get("desc") ?? "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const date = String(formData.get("date") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim() || undefined;
  const paidBy = String(formData.get("paidBy") ?? "owner").trim() === "partner" ? "partner" : "owner";
  const ownerPct = Math.min(100, Math.max(0, Number(formData.get("ownerPct")) || 0));
  const branchIds = formData.getAll("branchIds").map((v) => String(v)).filter(Boolean);

  if (!desc || !date || !amount) throw new Error("חובה למלא תיאור, סכום ותאריך");
  if (branchIds.length === 0) throw new Error("חובה לבחור לפחות סניף אחד");

  const db = getAdminFirestore();

  // Guard against a branch id that isn't a live rentals branch - a stale checkbox would otherwise
  // create an expense line nothing can ever show or settle.
  const expectedType = module === "computers" ? "computers" : module === "coworking" ? "coworking" : "rentals";
  const branchDocs = await db.getAll(...branchIds.map((id) => db.collection("n_branches").doc(id)));
  for (const doc of branchDocs) {
    const b = doc.data() as Omit<Branch, "id"> | undefined;
    if (!b || b.branchType !== expectedType || b.deleted) throw new Error("אחד הסניפים שנבחרו אינו סניף פעיל במודול הזה");
  }

  // Only the owner's own share reaches the main ledger, and only when the owner fronted the cash
  // (ownerLedgerExpenseAmount returns 0 for paidBy "partner"). owedBy is "owner" because the
  // amount handed in is already the owner's slice, not the whole expense.
  const { ownerTotal } = splitMultiBranchExpense(amount, ownerPct, branchIds.length);
  const linkedAhExpenseId = await createLinkedOwnerLedgerExpense({
    business: expectedType,
    desc: `${desc} — הוצאה משותפת ל-${branchIds.length} סניפים`,
    amount: ownerTotal,
    paidBy,
    owedBy: "owner",
    date,
  });

  const data: Omit<MultiBranchExpense, "id"> = {
    module,
    desc,
    amount,
    ownerPct,
    branchIds,
    paidBy,
    date,
    month: date.slice(0, 7),
    countsToMain: countsToMainFromForm(formData),
    ...(category ? { category } : {}),
    ...(linkedAhExpenseId ? { linkedAhExpenseId } : {}),
  };
  await db.collection(MULTI_BRANCH_EXPENSES_COLLECTION).add(data);
  revalidate(module, branchIds);
}

export async function deleteMultiBranchExpenseAction(id: string) {
  await requireOwner();
  const db = getAdminFirestore();
  const ref = db.collection(MULTI_BRANCH_EXPENSES_COLLECTION).doc(id);
  const doc = await ref.get();
  const data = doc.data() as Omit<MultiBranchExpense, "id"> | undefined;
  if (!data) throw new Error("ההוצאה לא נמצאה");
  await deleteLinkedOwnerLedgerExpense(data.linkedAhExpenseId);
  await ref.delete();
  revalidate(data.module ?? "rentals", data.branchIds ?? []);
}
