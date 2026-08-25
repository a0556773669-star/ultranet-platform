"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One branch's two "when does this branch count" fields, saved from the branch-status screen:
 *
 *  - `openedAt`   - the opening date every income/expense calculation starts from. Written as ""
 *                   when the field is cleared, so clearing really clears it (a merge would keep
 *                   the old value if we wrote undefined).
 *  - `notStarted` - the manual "hasn't started operating yet" mark. Always written explicitly,
 *                   including `false`, so unchecking the box actually reactivates the branch.
 */
export async function saveBranchStatusAction(branchId: string, formData: FormData) {
  await requireOwner();
  if (!branchId) throw new Error("חסר מזהה סניף");

  const openedAt = String(formData.get("openedAt") ?? "").trim();
  if (openedAt && !DATE_RE.test(openedAt)) {
    throw new Error("תאריך פתיחה לא תקין");
  }
  const notStarted = formData.get("notStarted") === "on";

  await getAdminFirestore().collection("n_branches").doc(branchId).set({ openedAt, notStarted }, { merge: true });

  revalidatePath("/dashboard/accounting/branches");
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath(`/dashboard/accounting/overview/${branchId}`);
  revalidatePath("/dashboard/rentals/branches");
  revalidatePath("/dashboard/branches");
}
