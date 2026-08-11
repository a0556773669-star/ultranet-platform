"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import type { Firestore } from "firebase-admin/firestore";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireModuleAccess } from "@/lib/perms";
import type { Rock, RockStatus, Milestone, MilestoneStage, RockReview, RockReviewPeriod } from "@ultranet/shared-types";

const ROCKS = "n_rocks";
const MILESTONES = "n_milestones";
const REVIEWS = "n_rock_reviews";
const ROCKS_PATH = "/dashboard/duxus/rocks";

export type ActionResult = { ok: true } | { ok: false; message: string };

async function currentUserLabel(): Promise<string> {
  const session = await getServerSession(authOptions);
  return session?.user?.name ?? session?.user?.email ?? "";
}

function toRock(id: string, data: Partial<Rock> | undefined): Rock {
  return {
    id,
    title: data?.title ?? "",
    description: data?.description ?? "",
    quarterKey: data?.quarterKey ?? "",
    parentRockId: data?.parentRockId ?? null,
    ownerUserId: data?.ownerUserId ?? "",
    ownerName: data?.ownerName ?? "",
    status: data?.status ?? "active",
    order: data?.order ?? 0,
    createdAt: data?.createdAt ?? 0,
    createdBy: data?.createdBy ?? "",
  };
}

function toMilestone(id: string, data: Partial<Milestone> | undefined): Milestone {
  return {
    id,
    rockId: data?.rockId ?? "",
    quarterKey: data?.quarterKey ?? "",
    title: data?.title ?? "",
    ownerUserId: data?.ownerUserId ?? "",
    ownerName: data?.ownerName ?? "",
    stage: data?.stage ?? "backlog",
    monthKey: data?.monthKey,
    weekKey: data?.weekKey,
    done: data?.done ?? false,
    doneAt: data?.doneAt,
    carryOverCount: data?.carryOverCount ?? 0,
    order: data?.order ?? 0,
    createdAt: data?.createdAt ?? 0,
    createdBy: data?.createdBy ?? "",
  };
}

function toReview(id: string, data: Partial<RockReview> | undefined): RockReview {
  return {
    id,
    period: data?.period ?? "quarterly",
    periodKey: data?.periodKey ?? "",
    notes: data?.notes ?? "",
    createdAt: data?.createdAt ?? 0,
    updatedAt: data?.updatedAt ?? 0,
    createdBy: data?.createdBy ?? "",
  };
}

export type AssignableUser = { id: string; name: string };

export async function listAssignableUsers(): Promise<AssignableUser[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection("n_users").get();
  return snap.docs
    .map((d) => ({ id: d.id, name: String((d.data() as { name?: string }).name ?? "") }))
    .filter((u) => u.name)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

// --- קריאה ---

export async function getRocksForQuarter(quarterKey: string): Promise<Rock[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(ROCKS).where("quarterKey", "==", quarterKey).get();
  return snap.docs
    .map((d) => toRock(d.id, d.data() as Partial<Rock>))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
}

export async function getMilestonesForQuarter(quarterKey: string): Promise<Milestone[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(MILESTONES).where("quarterKey", "==", quarterKey).get();
  return snap.docs
    .map((d) => toMilestone(d.id, d.data() as Partial<Milestone>))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
}

export async function getMilestonesByMonthKey(monthKey: string): Promise<Milestone[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(MILESTONES).where("monthKey", "==", monthKey).get();
  return snap.docs
    .map((d) => toMilestone(d.id, d.data() as Partial<Milestone>))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
}

export async function getMilestonesByWeekKey(weekKey: string): Promise<Milestone[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(MILESTONES).where("weekKey", "==", weekKey).get();
  return snap.docs
    .map((d) => toMilestone(d.id, d.data() as Partial<Milestone>))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
}

export async function getMilestonesByStage(stage: MilestoneStage): Promise<Milestone[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(MILESTONES).where("stage", "==", stage).get();
  return snap.docs.map((d) => toMilestone(d.id, d.data() as Partial<Milestone>));
}

export async function getDoneMilestones(): Promise<Milestone[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(MILESTONES).where("done", "==", true).get();
  return snap.docs
    .map((d) => toMilestone(d.id, d.data() as Partial<Milestone>))
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
}

export async function getAllRocks(): Promise<Rock[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(ROCKS).get();
  return snap.docs.map((d) => toRock(d.id, d.data() as Partial<Rock>));
}

export async function getReview(period: RockReviewPeriod, periodKey: string): Promise<RockReview | null> {
  await requireModuleAccess("duxus");
  const doc = await getAdminFirestore()
    .collection(REVIEWS)
    .doc(`${period}_${periodKey}`)
    .get();
  if (!doc.exists) return null;
  return toReview(doc.id, doc.data() as Partial<RockReview>);
}

export async function listReviews(period: RockReviewPeriod): Promise<RockReview[]> {
  await requireModuleAccess("duxus");
  const snap = await getAdminFirestore().collection(REVIEWS).where("period", "==", period).get();
  return snap.docs
    .map((d) => toReview(d.id, d.data() as Partial<RockReview>))
    .filter((r) => r.notes.trim().length > 0)
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
}

// --- כתיבה: סלעים ---

export async function createRockAction(input: {
  title: string;
  description?: string;
  quarterKey: string;
  parentRockId?: string | null;
  ownerUserId?: string;
  ownerName?: string;
}): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const title = input.title.trim();
  if (!title) return { ok: false, message: "יש להזין כותרת לסלע" };
  if (!input.quarterKey) return { ok: false, message: "חסר רבעון" };
  const createdBy = await currentUserLabel();
  await getAdminFirestore()
    .collection(ROCKS)
    .add({
      title,
      description: input.description?.trim() ?? "",
      quarterKey: input.quarterKey,
      parentRockId: input.parentRockId ?? null,
      ownerUserId: input.ownerUserId ?? "",
      ownerName: input.ownerName ?? "",
      status: "active" satisfies RockStatus,
      order: Date.now(),
      createdAt: Date.now(),
      createdBy,
    });
  revalidatePath(ROCKS_PATH);
  return { ok: true };
}

export async function updateRockStatusAction(id: string, status: RockStatus): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  await getAdminFirestore().collection(ROCKS).doc(id).set({ status }, { merge: true });
  revalidatePath(ROCKS_PATH);
  return { ok: true };
}

async function cascadeDeleteRock(db: Firestore, rockId: string): Promise<void> {
  const subRocksSnap = await db.collection(ROCKS).where("parentRockId", "==", rockId).get();
  for (const sub of subRocksSnap.docs) {
    await cascadeDeleteRock(db, sub.id);
  }
  const milestonesSnap = await db.collection(MILESTONES).where("rockId", "==", rockId).get();
  const batch = db.batch();
  milestonesSnap.docs.forEach((m) => batch.delete(m.ref));
  batch.delete(db.collection(ROCKS).doc(rockId));
  await batch.commit();
}

export async function deleteRockAction(id: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  await cascadeDeleteRock(getAdminFirestore(), id);
  revalidatePath(ROCKS_PATH);
  return { ok: true };
}

// --- כתיבה: אבני דרך ---

export async function createMilestoneAction(input: {
  rockId: string;
  quarterKey: string;
  title: string;
  ownerUserId?: string;
  ownerName?: string;
}): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const title = input.title.trim();
  if (!title) return { ok: false, message: "יש להזין כותרת לאבן דרך" };
  const createdBy = await currentUserLabel();
  await getAdminFirestore()
    .collection(MILESTONES)
    .add({
      rockId: input.rockId,
      quarterKey: input.quarterKey,
      title,
      ownerUserId: input.ownerUserId ?? "",
      ownerName: input.ownerName ?? "",
      stage: "backlog" satisfies MilestoneStage,
      done: false,
      carryOverCount: 0,
      order: Date.now(),
      createdAt: Date.now(),
      createdBy,
    });
  revalidatePath(ROCKS_PATH);
  return { ok: true };
}

export async function deleteMilestoneAction(id: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  await getAdminFirestore().collection(MILESTONES).doc(id).delete();
  revalidatePath(ROCKS_PATH);
  return { ok: true };
}

export async function promoteMilestonesToMonthAction(ids: string[], monthKey: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  if (!ids.length) return { ok: false, message: "לא נבחרו אבני דרך" };
  const db = getAdminFirestore();
  const batch = db.batch();
  ids.forEach((id) => {
    batch.set(db.collection(MILESTONES).doc(id), { stage: "month", monthKey }, { merge: true });
  });
  await batch.commit();
  revalidatePath(ROCKS_PATH);
  return { ok: true };
}

export async function promoteMilestonesToWeekAction(ids: string[], weekKey: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  if (!ids.length) return { ok: false, message: "לא נבחרו אבני דרך" };
  const db = getAdminFirestore();
  const batch = db.batch();
  ids.forEach((id) => {
    batch.set(db.collection(MILESTONES).doc(id), { stage: "week", weekKey }, { merge: true });
  });
  await batch.commit();
  revalidatePath(ROCKS_PATH);
  return { ok: true };
}

/** "משהו לא הושלם - להעביר קדימה?" - שינוי דלי + הגדלת מונה ההעברות. */
export async function carryOverMilestoneToMonthAction(id: string, monthKey: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const ref = getAdminFirestore().collection(MILESTONES).doc(id);
  const snap = await ref.get();
  const current = (snap.data() as Partial<Milestone> | undefined)?.carryOverCount ?? 0;
  await ref.set({ stage: "month", monthKey, carryOverCount: current + 1 }, { merge: true });
  revalidatePath(ROCKS_PATH);
  return { ok: true };
}

export async function carryOverMilestoneToWeekAction(id: string, weekKey: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const ref = getAdminFirestore().collection(MILESTONES).doc(id);
  const snap = await ref.get();
  const current = (snap.data() as Partial<Milestone> | undefined)?.carryOverCount ?? 0;
  await ref.set({ stage: "week", weekKey, carryOverCount: current + 1 }, { merge: true });
  revalidatePath(ROCKS_PATH);
  return { ok: true };
}

export async function toggleMilestoneDoneAction(id: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const ref = getAdminFirestore().collection(MILESTONES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "אבן הדרך לא נמצאה" };
  const done = Boolean((snap.data() as Partial<Milestone>).done);
  await ref.set({ done: !done, doneAt: !done ? Date.now() : null }, { merge: true });
  revalidatePath(ROCKS_PATH);
  return { ok: true };
}

// --- כתיבה: סיכומי פגישות ---

export async function saveReviewAction(period: RockReviewPeriod, periodKey: string, notes: string): Promise<ActionResult> {
  await requireModuleAccess("duxus");
  const createdBy = await currentUserLabel();
  const ref = getAdminFirestore().collection(REVIEWS).doc(`${period}_${periodKey}`);
  const existing = await ref.get();
  const existingData = existing.data() as Partial<RockReview> | undefined;
  await ref.set(
    {
      period,
      periodKey,
      notes,
      createdAt: existingData?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      createdBy: existingData?.createdBy ?? createdBy,
    },
    { merge: true }
  );
  revalidatePath(ROCKS_PATH);
  return { ok: true };
}
