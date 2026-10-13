"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerSession } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { BRANCH_PROGRESS_COLLECTION, MANUAL_STAGES } from "@/lib/branch-progress";
import type { BranchProgressManualStage } from "@ultranet/shared-types";

/** מסמן / מבטל שלב ידני (2/3/5/6) של סניף במדד הסניפים. בעלים בלבד. */
export async function setBranchStage(branchId: string, stage: string, done: boolean) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    throw new Error("הפעולה זו מוגבלת לבעלים בלבד");
  }
  if (!branchId || !MANUAL_STAGES.includes(stage as BranchProgressManualStage)) {
    throw new Error("שלב לא תקין");
  }

  const db = getAdminFirestore();
  const branch = await db.collection("n_branches").doc(branchId).get();
  if (!branch.exists || branch.data()?.branchType !== "rentals") {
    throw new Error("הסניף לא נמצא");
  }

  const now = new Date().toISOString();
  await db
    .collection(BRANCH_PROGRESS_COLLECTION)
    .doc(branchId)
    .set(
      {
        marks: { [stage]: { done, at: now, by: session?.user?.email ?? session?.user?.name ?? "" } },
        updatedAt: now,
      },
      { merge: true },
    );

  revalidatePath("/dashboard/rentals/progress");
}
