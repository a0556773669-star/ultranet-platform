"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import type { LegacyTicket, TicketDirection, TicketStatus } from "@/lib/legacy-tickets";
import { BRANCH_KEYS, BRANCH_LABELS, type BranchKey } from "@/lib/legacy-inventory";

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

export type TicketView = LegacyTicket & { id: string };

export type TicketsSnapshot = {
  tickets: TicketView[];
  canManage: boolean;
  branches: { key: BranchKey; label: string }[];
};

export async function getTicketsSnapshotAction(): Promise<TicketsSnapshot> {
  const session = await requireSession();
  const db = getAdminFirestore();
  const snap = await db.collection("tickets").get();
  const tickets: TicketView[] = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as LegacyTicket) }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    tickets,
    canManage: isOwner(session),
    branches: BRANCH_KEYS.map((key) => ({ key, label: BRANCH_LABELS[key] })),
  };
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function createTicketAction(
  title: string,
  desc: string,
  direction: TicketDirection,
  branchKey: BranchKey
): Promise<ActionResult> {
  const session = await requireSession();
  if (!title.trim()) return { ok: false, message: "יש להזין כותרת" };
  const db = getAdminFirestore();
  const now = new Date();
  await db.collection("tickets").add({
    branch: BRANCH_LABELS[branchKey] ?? branchKey,
    branchKey,
    title: title.trim(),
    desc: desc.trim(),
    status: "open",
    direction,
    date: now.toLocaleDateString("he-IL"),
    by: session.user?.name ?? session.user?.email ?? "",
    byBranch: (session.user as { branchId?: string } | undefined)?.branchId ?? "",
    byEmail: session.user?.email ?? "",
    ts: Timestamp.now(),
  });
  revalidatePath("/dashboard/tickets");
  return { ok: true };
}

export async function updateTicketStatusAction(id: string, status: TicketStatus): Promise<ActionResult> {
  await requireSession();
  const db = getAdminFirestore();
  await db.collection("tickets").doc(id).update({ status });
  revalidatePath("/dashboard/tickets");
  return { ok: true };
}

export async function deleteTicketAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!isOwner(session)) return { ok: false, message: "רק מנהל יכול למחוק פנייה" };
  const db = getAdminFirestore();
  await db.collection("tickets").doc(id).delete();
  revalidatePath("/dashboard/tickets");
  return { ok: true };
}
