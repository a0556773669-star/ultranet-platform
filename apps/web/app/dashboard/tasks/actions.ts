"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { revalidatePath } from "next/cache";
import { getWeekKey, type LegacyTask, type TaskAssign, type TaskFreq } from "@/lib/legacy-tasks";
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

export type TaskView = {
  id: string;
  name: string;
  freq: TaskFreq;
  assign: TaskAssign;
  branches: string[];
  branchLabel: string;
  isDone: boolean;
};

export type TasksSnapshot = {
  tasks: TaskView[];
  canManage: boolean;
  branches: { key: BranchKey; label: string }[];
};

export async function getTasksSnapshotAction(): Promise<TasksSnapshot> {
  const session = await requireSession();
  const db = getAdminFirestore();
  const snap = await db.collection("tasks").get();
  const week = getWeekKey();

  const tasks: TaskView[] = snap.docs.map((doc) => {
    const data = doc.data() as Partial<LegacyTask>;
    const branches = data.branches ?? [];
    const branchLabel =
      data.assign === "admin"
        ? "👤 מנהל"
        : branches.includes("all")
        ? "כולם"
        : branches.map((b) => BRANCH_LABELS[b as BranchKey] ?? b).join(", ");
    const done = data.done ?? {};
    return {
      id: doc.id,
      name: data.name ?? "",
      freq: (data.freq as TaskFreq) ?? "weekly",
      assign: (data.assign as TaskAssign) ?? "admin",
      branches,
      branchLabel,
      isDone: !!done[week],
    };
  });

  return {
    tasks,
    canManage: isOwner(session),
    branches: BRANCH_KEYS.map((key) => ({ key, label: BRANCH_LABELS[key] })),
  };
}

export type ActionResult = { ok: true } | { ok: false; message: string };

export async function toggleTaskDoneAction(id: string): Promise<ActionResult> {
  await requireSession();
  const db = getAdminFirestore();
  const ref = db.collection("tasks").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "המשימה לא נמצאה" };
  const data = snap.data() as Partial<LegacyTask>;
  const week = getWeekKey();
  const done: Record<string, boolean> = { ...(data.done ?? {}) };
  done[week] = !done[week];
  await ref.update({ done });
  revalidatePath("/dashboard/tasks");
  return { ok: true };
}

export async function addTaskAction(
  name: string,
  freq: TaskFreq,
  assign: TaskAssign,
  branches: string[]
): Promise<ActionResult> {
  const session = await requireSession();
  if (!isOwner(session)) return { ok: false, message: "רק מנהל יכול להוסיף משימות" };
  if (!name.trim()) return { ok: false, message: "יש להזין שם משימה" };
  const db = getAdminFirestore();
  await db.collection("tasks").add({
    name: name.trim(),
    freq,
    assign,
    branches: assign === "branches" ? branches : [],
    done: {},
  });
  revalidatePath("/dashboard/tasks");
  return { ok: true };
}

export async function deleteTaskAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  if (!isOwner(session)) return { ok: false, message: "רק מנהל יכול למחוק משימות" };
  const db = getAdminFirestore();
  await db.collection("tasks").doc(id).delete();
  revalidatePath("/dashboard/tasks");
  return { ok: true };
}
