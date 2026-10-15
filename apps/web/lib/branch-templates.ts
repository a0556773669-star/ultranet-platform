import type { Firestore } from "firebase-admin/firestore";
import type { BranchTemplate, BranchTemplateStep, PersonalTask } from "@ultranet/shared-types";

/**
 * תבניות פתיחת סניף (מסמך המשך סעיף 50). קריאה בלבד — הכתיבה ב-
 * `app/dashboard/rentals/branches/templates/actions.ts`.
 */
export const BRANCH_TEMPLATES = "n_branch_templates";

function cleanSteps(value: unknown): BranchTemplateStep[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((s) => {
      const step = (s ?? {}) as Partial<BranchTemplateStep>;
      const title = String(step.title ?? "").trim();
      const note = String(step.note ?? "").trim();
      return note ? { title, note } : { title };
    })
    .filter((s) => s.title);
}

export function toBranchTemplate(id: string, data: Partial<BranchTemplate> | undefined): BranchTemplate {
  return {
    id,
    name: data?.name ?? "",
    steps: cleanSteps(data?.steps),
    approvedBy: data?.approvedBy ?? "",
    approvedAt: data?.approvedAt ?? 0,
    createdBy: data?.createdBy ?? "",
    createdAt: data?.createdAt ?? 0,
    updatedAt: data?.updatedAt ?? data?.createdAt ?? 0,
    updatedBy: data?.updatedBy ?? "",
    archivedAt: data?.archivedAt ?? null,
  };
}

export async function loadBranchTemplates(db: Firestore): Promise<BranchTemplate[]> {
  const snap = await db.collection(BRANCH_TEMPLATES).get();
  return snap.docs
    .map((d) => toBranchTemplate(d.id, d.data() as Partial<BranchTemplate>))
    .sort((a, b) => Number(!!a.archivedAt) - Number(!!b.archivedAt) || a.name.localeCompare(b.name, "he"));
}

/** משימה שנוצרה מתבנית בסניף — מה שמוצג בכרטיס הסניף. */
export type BranchTemplateTask = Pick<PersonalTask, "id" | "title" | "status" | "createdAt" | "createdBy"> & {
  templateId: string;
  deleted: boolean;
};

/**
 * המשימות שנוצרו מתבניות עבור סניף אחד. שאילתת שוויון יחידה על `branchId` (אינדקס אוטומטי),
 * ומשימות רגילות — שאין להן `branchId` כלל — לא חוזרות ממנה.
 */
export async function loadBranchTemplateTasks(db: Firestore, branchId: string): Promise<BranchTemplateTask[]> {
  const snap = await db.collection("n_personal_tasks").where("branchId", "==", branchId).get();
  return snap.docs
    .map((d) => {
      const t = d.data() as Partial<PersonalTask>;
      return {
        id: d.id,
        title: t.title ?? "",
        status: t.status ?? "new",
        createdAt: t.createdAt ?? 0,
        createdBy: t.createdBy ?? "",
        templateId: t.templateId ?? "",
        deleted: Boolean(t.deletedAt),
      };
    })
    .filter((t) => t.templateId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** סניף "חדש" לעניין החלת תבנית: אין בו אף השכרה (פעילה או היסטורית). */
export async function branchHasRentals(db: Firestore, branchId: string): Promise<boolean> {
  const snap = await db.collection("n_rentals").where("branchId", "==", branchId).limit(1).select().get();
  return !snap.empty;
}
