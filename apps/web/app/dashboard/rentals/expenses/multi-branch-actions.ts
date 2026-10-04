"use server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { MultiBranchExpense } from "@ultranet/shared-types";
import { deleteLinkedOwnerLedgerExpense } from "@/lib/branch-expense-ledger";
import { MULTI_BRANCH_EXPENSES_COLLECTION } from "@/lib/multi-branch-expense";

/**
 * `n_multi_branch_expenses` — **סגור לכתיבה, פתוח למחיקה.**
 *
 * הקולקשן נולד בגלל דבר אחד שלא היה אפשר לבטא במקום אחר: איזה אחוז מההוצאה על הבעלים.
 * מאז `ownerPct` יושב על ההוצאה עצמה בספר המשותף (`lib/expense-shared-scope.ts`), שם הוא
 * עובד גם על הוצאה קבועה — מה שכאן מעולם לא היה אפשרי — ולכן טופס היצירה הוסר ואין דרך
 * לכתוב לכאן שורה חדשה. השורות הקיימות ממשיכות להתחשבן בדיוק כפי שהתחשבנו, ומוצגות
 * למחיקה בספר המשותף (`legacy-multi-branch.tsx`).
 */
async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  if (session.user?.role !== "owner") throw new Error("אין הרשאה");
  return session;
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

  const base = data.module === "computers" ? "/dashboard/expenses" : "/dashboard/rentals/expenses";
  for (const branchId of data.branchIds ?? []) revalidatePath(`${base}/${branchId}`);
  revalidatePath(base);
  revalidatePath("/dashboard/rentals/accounting");
  revalidatePath("/dashboard/computer-rooms-accounting");
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard");
}
