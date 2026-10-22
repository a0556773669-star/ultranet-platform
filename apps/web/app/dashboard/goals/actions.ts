"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { Branch, Goal, GoalLinkKind } from "@ultranet/shared-types";
import { authOptions } from "@/lib/auth";
import { isOwnerSession } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { GOALS_COLLECTION, parseGoalsWorkbook, suggestLink } from "@/lib/goals";

const LINK_KINDS: GoalLinkKind[] = ["branch", "coworking_all", "laptop_sales", "none"];

async function requireOwnerAction() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) throw new Error("הפעולה מוגבלת לבעלים בלבד");
}

/**
 * ייבוא קובץ היעדים. מחליף את כל השורות בשורות שבקובץ — הקובץ הוא מקור האמת ליעדים — אבל שורה
 * שהשם שלה כבר היה קיים שומרת את החיבור שהבעלים בחר לה בדף. שורה חדשה מקבלת הצעת חיבור.
 */
export async function importGoalsAction(formData: FormData) {
  await requireOwnerAction();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect("/dashboard/goals?importError=missing");

  const { lines, error } = parseGoalsWorkbook(Buffer.from(await (file as File).arrayBuffer()));
  if (error || !lines.length) redirect("/dashboard/goals?importError=format");

  const db = getAdminFirestore();
  const [existingSnap, branchesSnap] = await Promise.all([
    db.collection(GOALS_COLLECTION).get(),
    db.collection("n_branches").get(),
  ]);
  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted);
  const existingByLabel = new Map(
    existingSnap.docs.map((d) => {
      const g = d.data() as Goal;
      return [g.label, g] as const;
    }),
  );

  const now = new Date().toISOString();
  const batch = db.batch();
  for (const d of existingSnap.docs) batch.delete(d.ref);
  lines.forEach((line, i) => {
    const prev = existingByLabel.get(line.label);
    const link = prev ? { linkKind: prev.linkKind, branchId: prev.branchId } : suggestLink(line.label, branches);
    const goal: Omit<Goal, "id"> = {
      label: line.label,
      order: i,
      turnover: line.turnover,
      linkKind: link.linkKind,
      updatedAt: now,
      ...(link.branchId ? { branchId: link.branchId } : {}),
      ...(line.profit != null ? { profit: line.profit } : {}),
      ...(line.computersNow != null ? { computersNow: line.computersNow } : {}),
      ...(line.computersTarget != null ? { computersTarget: line.computersTarget } : {}),
    };
    batch.set(db.collection(GOALS_COLLECTION).doc(), goal);
  });
  await batch.commit();

  revalidatePath("/dashboard/goals");
  redirect(`/dashboard/goals?imported=${lines.length}`);
}

/** שינוי החיבור של שורה (מאיפה נלקח הביצוע) או של יעד המחזור שלה. */
export async function updateGoalAction(
  id: string,
  patch: { linkKind?: GoalLinkKind; branchId?: string; turnover?: number },
) {
  await requireOwnerAction();
  if (!id) throw new Error("חסר מזהה");
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.linkKind !== undefined) {
    if (!LINK_KINDS.includes(patch.linkKind)) throw new Error("חיבור לא תקין");
    if (patch.linkKind === "branch" && !patch.branchId) throw new Error("לא נבחר סניף");
    update.linkKind = patch.linkKind;
    update.branchId = patch.linkKind === "branch" ? patch.branchId : null;
  }
  if (patch.turnover !== undefined) {
    if (!Number.isFinite(patch.turnover) || patch.turnover < 0) throw new Error("סכום לא תקין");
    update.turnover = patch.turnover;
  }
  await getAdminFirestore().collection(GOALS_COLLECTION).doc(id).update(update);
  revalidatePath("/dashboard/goals");
}
