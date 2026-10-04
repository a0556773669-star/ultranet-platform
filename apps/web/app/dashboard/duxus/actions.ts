"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireModuleAccess } from "@/lib/perms";
import type { Procedure, ProcedureStatus } from "@ultranet/shared-types";

const COLLECTION = "n_procedures";
const LIST_PATH = "/dashboard/duxus/procedures";

const STATUSES: ProcedureStatus[] = ["draft", "active", "superseded", "archived"];

function toProcedure(id: string, data: Partial<Procedure> | undefined): Procedure {
  return {
    id,
    title: data?.title ?? "",
    content: data?.content ?? "",
    category: data?.category ?? "",
    summary: data?.summary ?? "",
    version: data?.version ?? "1",
    // דאטה שנוצר לפני מודל הסטטוסים נחשב נוהל בתוקף, לא טיוטה.
    status: data?.status ?? "active",
    ownerName: data?.ownerName ?? "",
    supersedesId: data?.supersedesId ?? null,
    attachmentName: data?.attachmentName ?? "",
    attachmentDataUrl: data?.attachmentDataUrl ?? "",
    order: data?.order ?? 0,
    createdAt: data?.createdAt ?? 0,
    updatedAt: data?.updatedAt ?? 0,
    createdBy: data?.createdBy ?? "",
    updatedBy: data?.updatedBy ?? "",
  };
}

function readStatus(formData: FormData): ProcedureStatus {
  const value = String(formData.get("status") ?? "");
  return STATUSES.includes(value as ProcedureStatus) ? (value as ProcedureStatus) : "draft";
}

/** השדות המשותפים ליצירה ולעדכון, כדי ששני המסלולים יקראו את אותו טופס בדיוק. */
function readFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim(),
    version: String(formData.get("version") ?? "").trim() || "1",
    ownerName: String(formData.get("ownerName") ?? "").trim(),
    status: readStatus(formData),
    attachmentName: String(formData.get("attachmentName") ?? "").trim(),
    attachmentDataUrl: String(formData.get("attachmentDataUrl") ?? "").trim(),
    removeAttachment: formData.get("removeAttachment") === "1",
  };
}

export async function listProcedures(): Promise<Procedure[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(COLLECTION).get();
  return snap.docs.map((d) => toProcedure(d.id, d.data() as Partial<Procedure>)).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProcedure(id: string): Promise<Procedure | null> {
  await requireModuleAccess("duxus");
  const doc = await getAdminFirestore().collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return toProcedure(doc.id, doc.data() as Partial<Procedure>);
}

export async function createProcedureAction(formData: FormData) {
  const session = await requireModuleAccess("duxus");
  const fields = readFields(formData);
  if (!fields.title) redirect("/dashboard/duxus/procedures/new");

  const user = session.user?.name ?? session.user?.email ?? "";
  const now = Date.now();
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTION).doc();
  // "העלאת גרסה חדשה" = נוהל חדש שמצביע על הקודם. הקודם **אינו נמחק** - הוא רק
  // מסומן "הוחלף", כך ששרשרת הגרסאות נשמרת במלואה (סעיף 12).
  const supersedesId = String(formData.get("supersedesId") ?? "").trim() || null;

  await ref.set({
    title: fields.title,
    content: fields.content,
    category: fields.category,
    summary: fields.summary,
    version: fields.version,
    status: fields.status,
    ownerName: fields.ownerName,
    supersedesId,
    attachmentName: fields.attachmentName,
    attachmentDataUrl: fields.attachmentDataUrl,
    createdAt: now,
    updatedAt: now,
    createdBy: user,
    updatedBy: user,
  });

  if (supersedesId) {
    await db.collection(COLLECTION).doc(supersedesId).set({ status: "superseded", updatedAt: now, updatedBy: user }, { merge: true });
  }

  revalidatePath(LIST_PATH);
  redirect(`/dashboard/duxus/procedures/${ref.id}`);
}

export async function updateProcedureAction(id: string, formData: FormData) {
  const session = await requireModuleAccess("duxus");
  const fields = readFields(formData);
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const existing = toProcedure(id, (await ref.get()).data() as Partial<Procedure> | undefined);

  const attachment = fields.removeAttachment
    ? { attachmentName: "", attachmentDataUrl: "" }
    : fields.attachmentDataUrl
      ? { attachmentName: fields.attachmentName, attachmentDataUrl: fields.attachmentDataUrl }
      : {};

  await ref.set(
    {
      title: fields.title || existing.title,
      content: fields.content,
      category: fields.category,
      summary: fields.summary,
      version: fields.version,
      status: fields.status,
      ownerName: fields.ownerName,
      ...attachment,
      updatedAt: Date.now(),
      updatedBy: session.user?.name ?? session.user?.email ?? "",
    },
    { merge: true }
  );

  revalidatePath(LIST_PATH);
  revalidatePath(`${LIST_PATH}/${id}`);
  redirect(`${LIST_PATH}/${id}`);
}

/** ארכוב במקום מחיקה - נוהל שהיה בתוקף הוא היסטוריה, לא זבל. */
export async function archiveProcedureAction(id: string) {
  const session = await requireModuleAccess("duxus");
  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(id)
    .set({ status: "archived", updatedAt: Date.now(), updatedBy: session.user?.name ?? session.user?.email ?? "" }, { merge: true });
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}

export async function deleteProcedureAction(id: string) {
  await requireModuleAccess("duxus");
  await getAdminFirestore().collection(COLLECTION).doc(id).delete();
  revalidatePath(LIST_PATH);
  redirect(LIST_PATH);
}
