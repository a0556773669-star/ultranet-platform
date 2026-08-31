"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireModuleAccess } from "@/lib/perms";
import type { Procedure } from "@ultranet/shared-types";

const COLLECTION = "n_procedures";

function toProcedure(id: string, data: Partial<Procedure> | undefined): Procedure {
  return {
    id,
    title: data?.title ?? "",
    content: data?.content ?? "",
    category: data?.category ?? "",
    order: data?.order ?? 0,
    createdAt: data?.createdAt ?? 0,
    updatedAt: data?.updatedAt ?? 0,
    createdBy: data?.createdBy ?? "",
  };
}

export async function listProcedures(): Promise<Procedure[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(COLLECTION).get();
  return snap.docs
    .map((d) => toProcedure(d.id, d.data() as Partial<Procedure>))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getProcedure(id: string): Promise<Procedure | null> {
  await requireModuleAccess("duxus");
  const doc = await getAdminFirestore().collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return toProcedure(doc.id, doc.data() as Partial<Procedure>);
}

export async function createProcedureAction(formData: FormData) {
  const session = await requireModuleAccess("duxus");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!title) {
    redirect("/dashboard/duxus/procedures/new");
  }
  const now = Date.now();
  const ref = getAdminFirestore().collection(COLLECTION).doc();
  await ref.set({
    title,
    content,
    category,
    createdAt: now,
    updatedAt: now,
    createdBy: session.user?.name ?? session.user?.email ?? "",
  });
  revalidatePath("/dashboard/duxus/procedures");
  redirect("/dashboard/duxus/procedures");
}

export async function updateProcedureAction(id: string, formData: FormData) {
  await requireModuleAccess("duxus");
  const ref = getAdminFirestore().collection(COLLECTION).doc(id);
  const existingSnap = await ref.get();
  const existing = (existingSnap.data() as Partial<Procedure>) ?? {};
  const title = String(formData.get("title") ?? "").trim() || existing.title || "";
  const content = String(formData.get("content") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  await ref.set(
    {
      title,
      content,
      category,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
  revalidatePath("/dashboard/duxus/procedures");
  revalidatePath(`/dashboard/duxus/procedures/${id}`);
  redirect(`/dashboard/duxus/procedures/${id}`);
}

export async function deleteProcedureAction(id: string) {
  await requireModuleAccess("duxus");
  await getAdminFirestore().collection(COLLECTION).doc(id).delete();
  revalidatePath("/dashboard/duxus/procedures");
  redirect("/dashboard/duxus/procedures");
}
