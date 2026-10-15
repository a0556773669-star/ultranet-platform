import type { PersonalTaskPriority, PersonalTaskStatus, TaskActivityAction } from "@ultranet/shared-types";

/**
 * צורת המסמך של משימה חדשה ב-`n_personal_tasks` ("משימות ליוני") — מקור יחיד לשני המסלולים
 * שיוצרים משימה: הזנה רגילה (`duxus/personal/actions.ts`) והחלת תבנית פתיחת סניף
 * (`rentals/branches/templates/actions.ts`). כך משימה שנוצרה מתבנית זהה בכל שדה למשימה רגילה,
 * ונבדלת רק בשדות הרשות `branchId`/`templateId`.
 */
export type NewPersonalTaskFields = {
  title: string;
  description: string;
  contactName: string;
  contactPhone: string;
  priority: PersonalTaskPriority;
  dueDate: string;
  dueTime: string;
};

export function newPersonalTaskDoc(
  fields: NewPersonalTaskFields,
  user: string,
  now: number,
  extra: { branchId?: string; templateId?: string } = {}
) {
  return {
    ...fields,
    ...(extra.branchId ? { branchId: extra.branchId } : {}),
    ...(extra.templateId ? { templateId: extra.templateId } : {}),
    status: "new" as PersonalTaskStatus,
    pinned: false,
    lastNote: "",
    createdBy: user,
    createdAt: now,
    viewedAt: null,
    completedBy: "",
    completedAt: null,
    cancelledBy: "",
    cancelledAt: null,
    cancelReason: "",
    reopenCount: 0,
    deletedAt: null,
    updatedAt: now,
    updatedBy: user,
  };
}

/** רשומת יומן (`n_task_activity`) של משימה אישית — אותה צורה בכל מקום שכותב אליו. */
export function personalTaskActivityDoc(
  userName: string,
  entry: { taskId: string; action: TaskActivityAction; field?: string; oldValue?: string; newValue?: string; note?: string }
) {
  return {
    entityType: "personal_task" as const,
    entityId: entry.taskId,
    personalTaskId: entry.taskId,
    action: entry.action,
    field: entry.field ?? "",
    oldValue: entry.oldValue ?? "",
    newValue: entry.newValue ?? "",
    note: entry.note ?? "",
    userName,
    at: Date.now(),
  };
}
