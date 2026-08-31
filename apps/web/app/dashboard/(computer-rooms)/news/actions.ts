"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import type { LegacyNews } from "@/lib/legacy-news";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("יש להתחבר למערכת");
  }
  return session;
}

function isOwner(session: { user?: { role?: string } } | null): boolean {
  return session?.user?.role === "owner";
}

export type NewsView = LegacyNews & { id: string };

export type NewsSnapshot = { news: NewsView[]; canManage: boolean };

export async function getNewsSnapshotAction(): Promise<NewsSnapshot> {
  const session = await requireSession();
  const db = getAdminFirestore();
  const snap = await db.collection("news").orderBy("ts", "desc").get();
  const news: NewsView[] = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as LegacyNews) }));

  return { news, canManage: isOwner(session) };
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function createNewsAction(title: string, body: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!isOwner(session)) return { ok: false, message: "רק מנהל יכול לפרסם עדכון" };
  if (!title.trim()) return { ok: false, message: "יש להזין כותרת" };
  const db = getAdminFirestore();
  const now = new Date();
  await db.collection("news").add({
    title: title.trim(),
    body: body.trim(),
    date: now.toLocaleDateString("he-IL"),
    ts: Timestamp.now(),
    by: session.user?.name ?? session.user?.email ?? "",
  });
  revalidatePath("/dashboard/news");
  return { ok: true };
}

export async function deleteNewsAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!isOwner(session)) return { ok: false, message: "רק מנהל יכול למחוק עדכון" };
  const db = getAdminFirestore();
  await db.collection("news").doc(id).delete();
  revalidatePath("/dashboard/news");
  return { ok: true };
}
