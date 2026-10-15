"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { isOwnerSession } from "@/lib/perms";
import { BRANCH_TEMPLATES, branchHasRentals, loadBranchTemplateTasks, toBranchTemplate } from "@/lib/branch-templates";
import { newPersonalTaskDoc, personalTaskActivityDoc } from "@/lib/personal-task-doc";
import type { Branch, BranchTemplate, BranchTemplateStep } from "@ultranet/shared-types";

/**
 * תבניות פתיחת סניף (מסמך המשך סעיף 50). הכול לבעלים בלבד, נבדק בשרת בכל פעולה.
 *
 * - התבנית נשמרת ב-`n_branch_templates`. השמירה בידי הבעלים היא האישור (`approvedBy`/`approvedAt`).
 * - "החלה" **מעתיקה** את הצעדים כמשימות חדשות ב-`n_personal_tasks` ("משימות ליוני"), באותה צורה
 *   בדיוק של משימה רגילה + `branchId`/`templateId`. התבנית עצמה לא משתנה בהחלה, ועריכתה אחר כך
 *   לא נוגעת במשימות שכבר נוצרו.
 * - החלה רק על סניף השכרות פעיל שאין בו אף השכרה. סניפים ותיקים לא מקבלים משימות.
 * - החלה חוזרת של אותה תבנית על אותו סניף רק באישור מפורש נוסף (`confirmReapply`).
 */

export type TemplateActionResult = { ok: true; id?: string; created?: number } | { ok: false; message: string; needsConfirm?: boolean };

const DENIED = "הפעולה מוגבלת לבעלים בלבד";
const MAX_STEPS = 60;

async function ownerContext() {
  const session = await getServerSession(authOptions);
  if (!session || !isOwnerSession(session)) return null;
  return { db: getAdminFirestore(), user: session.user?.name ?? session.user?.email ?? "" };
}

export type BranchTemplateInput = { name: string; steps: BranchTemplateStep[] };

function cleanInput(input: BranchTemplateInput): { name: string; steps: BranchTemplateStep[] } {
  const steps = (Array.isArray(input.steps) ? input.steps : [])
    .map((s) => ({ title: String(s?.title ?? "").trim().slice(0, 200), note: String(s?.note ?? "").trim().slice(0, 2000) }))
    .filter((s) => s.title)
    .slice(0, MAX_STEPS)
    .map((s) => (s.note ? s : { title: s.title }));
  return { name: String(input.name ?? "").trim().slice(0, 120), steps };
}

export async function saveBranchTemplateAction(id: string | null, input: BranchTemplateInput): Promise<TemplateActionResult> {
  const ctx = await ownerContext();
  if (!ctx) return { ok: false, message: DENIED };
  const fields = cleanInput(input);
  if (!fields.name) return { ok: false, message: "יש להזין שם לתבנית" };
  if (fields.steps.length === 0) return { ok: false, message: "יש להזין לפחות צעד אחד" };

  const now = Date.now();
  const col = ctx.db.collection(BRANCH_TEMPLATES);
  if (id) {
    const snap = await col.doc(id).get();
    if (!snap.exists) return { ok: false, message: "התבנית לא נמצאה" };
    await col.doc(id).set(
      { ...fields, approvedBy: ctx.user, approvedAt: now, updatedAt: now, updatedBy: ctx.user },
      { merge: true }
    );
    revalidatePath("/dashboard/rentals/branches", "layout");
    return { ok: true, id };
  }
  const ref = col.doc();
  await ref.set({
    ...fields,
    approvedBy: ctx.user,
    approvedAt: now,
    createdBy: ctx.user,
    createdAt: now,
    updatedAt: now,
    updatedBy: ctx.user,
    archivedAt: null,
  });
  revalidatePath("/dashboard/rentals/branches", "layout");
  return { ok: true, id: ref.id };
}

/** הוצאה משימוש / החזרה לשימוש. אין מחיקה — משימות שנוצרו מצביעות על התבנית. */
export async function setBranchTemplateArchivedAction(id: string, archived: boolean): Promise<TemplateActionResult> {
  const ctx = await ownerContext();
  if (!ctx) return { ok: false, message: DENIED };
  const ref = ctx.db.collection(BRANCH_TEMPLATES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "התבנית לא נמצאה" };
  await ref.set({ archivedAt: archived ? Date.now() : null, updatedAt: Date.now(), updatedBy: ctx.user }, { merge: true });
  revalidatePath("/dashboard/rentals/branches", "layout");
  return { ok: true, id };
}

export async function applyBranchTemplateAction(
  branchId: string,
  templateId: string,
  confirmReapply = false
): Promise<TemplateActionResult> {
  const ctx = await ownerContext();
  if (!ctx) return { ok: false, message: DENIED };
  const { db } = ctx;

  const [branchSnap, templateSnap] = await Promise.all([
    db.collection("n_branches").doc(branchId).get(),
    db.collection(BRANCH_TEMPLATES).doc(templateId).get(),
  ]);
  if (!branchSnap.exists) return { ok: false, message: "הסניף לא נמצא" };
  if (!templateSnap.exists) return { ok: false, message: "התבנית לא נמצאה" };
  const branch = branchSnap.data() as Partial<Branch>;
  const template: BranchTemplate = toBranchTemplate(templateSnap.id, templateSnap.data() as Partial<BranchTemplate>);

  if (branch.branchType !== "rentals" || branch.deleted) return { ok: false, message: "אפשר להחיל תבנית רק על סניף השכרות" };
  if (branch.closedAt) return { ok: false, message: "הסניף סגור — לא מחילים עליו תבנית פתיחה" };
  if (await branchHasRentals(db, branchId)) {
    return { ok: false, message: "בסניף כבר יש השכרות — תבנית פתיחה מוחלת רק על סניף חדש" };
  }
  if (template.archivedAt) return { ok: false, message: "התבנית הוצאה משימוש" };
  if (!template.approvedAt) return { ok: false, message: "התבנית עוד לא אושרה" };
  if (template.steps.length === 0) return { ok: false, message: "אין צעדים בתבנית" };

  const existing = (await loadBranchTemplateTasks(db, branchId)).filter((t) => t.templateId === templateId && !t.deleted);
  if (existing.length > 0 && !confirmReapply) {
    return {
      ok: false,
      needsConfirm: true,
      message: `התבנית "${template.name}" כבר הוחלה בסניף הזה (${existing.length} משימות). להחיל אותה שוב וליצור משימות נוספות?`,
    };
  }

  const branchName = branch.name ?? "";
  const now = Date.now();
  const batch = db.batch();
  for (const step of template.steps) {
    const ref = db.collection("n_personal_tasks").doc();
    const fields = {
      title: `${branchName}: ${step.title}`.slice(0, 300),
      description: [step.note ?? "", `נוצר מתבנית פתיחת סניף "${template.name}".`].filter(Boolean).join("\n\n"),
      contactName: "",
      contactPhone: "",
      priority: "normal" as const,
      dueDate: "",
      dueTime: "",
    };
    batch.set(ref, newPersonalTaskDoc(fields, ctx.user, now, { branchId, templateId }));
    batch.set(
      db.collection("n_task_activity").doc(),
      personalTaskActivityDoc(ctx.user, { taskId: ref.id, action: "create", newValue: fields.title, note: `תבנית פתיחת סניף: ${template.name}` })
    );
  }
  await batch.commit();

  revalidatePath(`/dashboard/rentals/branches/${branchId}`);
  revalidatePath("/dashboard/duxus", "layout");
  return { ok: true, created: template.steps.length };
}
