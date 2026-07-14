"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";

const COLLECTION = "n_tutorials";

export type Tutorial = {
  id: string;
  title: string;
  instructions: string;
  imageDataUrl: string;
  createdAt: number;
  updatedAt: number;
};

async function requireLogin() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session;
}

function toTutorial(id: string, data: Partial<Tutorial> | undefined): Tutorial {
  return {
    id,
    title: data?.title ?? "",
    instructions: data?.instructions ?? "",
    imageDataUrl: data?.imageDataUrl ?? "",
    createdAt: data?.createdAt ?? 0,
    updatedAt: data?.updatedAt ?? 0,
  };
}

export async function listTutorials(): Promise<Tutorial[]> {
  await requireLogin();
  const snap = await getAdminFirestore().collection(COLLECTION).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => toTutorial(d.id, d.data() as Partial<Tutorial>));
}

export async function getTutorial(id: string): Promise<Tutorial | null> {
  await requireLogin();
  const doc = await getAdminFirestore().collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return toTutorial(doc.id, doc.data() as Partial<Tutorial>);
}

export async function createTutorialAction(formData: FormData) {
  await requireOwner();
  const title = String(formData.get("title") ?? "").trim();
  const instructions = String(formData.get("instructions") ?? "").trim();
  const imageDataUrl = String(formData.get("imageDataUrl") ?? "");
  if (!title) {
    redirect("/dashboard/tutorials/new");
  }
  const now = Date.now();
  const ref = getAdminFirestore().collection(COLLECTION).doc();
  await ref.set({ title, instructions, imageDataUrl, createdAt: now, updatedAt: now });
  revalidatePath("/dashboard/tutorials");
  redirect("/dashboard/tutorials");
}

export async function updateTutorialAction(id: string, formData: FormData) {
  await requireOwner();
  const ref = getAdminFirestore().collection(COLLECTION).doc(id);
  const existingSnap = await ref.get();
  const existing = (existingSnap.data() as Partial<Tutorial>) ?? {};
  const title = String(formData.get("title") ?? "").trim() || existing.title || "";
  const instructions = String(formData.get("instructions") ?? "").trim() || existing.instructions || "";
  const imageDataUrl = String(formData.get("imageDataUrl") ?? "");
  const removeImage = String(formData.get("removeImage") ?? "") === "1";
  const finalImage = removeImage ? "" : imageDataUrl || existing.imageDataUrl || "";
  await ref.set(
    { title, instructions, imageDataUrl: finalImage, updatedAt: Date.now() },
    { merge: true }
  );
  revalidatePath("/dashboard/tutorials");
  revalidatePath(`/dashboard/tutorials/${id}`);
  redirect(`/dashboard/tutorials/${id}`);
}

export async function deleteTutorialAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection(COLLECTION).doc(id).delete();
  revalidatePath("/dashboard/tutorials");
  redirect("/dashboard/tutorials");
}
