"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerSession } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  OPS_STOCK_CHECKS,
  OPS_STOCK_ITEMS,
  OPS_TASKS,
  OPS_TASK_CHECKS,
  appliesToBranch,
  assertBranchAllowed,
  checkDocId,
  getMonthKey,
  getOpsAccess,
  periodKeyForFreq,
  type OpsBranch,
} from "@/lib/operations";
import type {
  OpsScope,
  OpsStockCheck,
  OpsStockItem,
  OpsStockMark,
  OpsTask,
  OpsTaskCheck,
  OpsTaskFreq,
} from "@ultranet/shared-types";

export type ActionResult = { ok: true } | { ok: false; message: string };

const OPS_PATH = "/dashboard/operations";

async function requireOwnerSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("יש להתחבר למערכת");
  if (!isOwnerSession(session)) throw new Error("רק מנהל יכול לשנות הגדרות תפעול");
  return session;
}

function fail(err: unknown): { ok: false; message: string } {
  return { ok: false, message: err instanceof Error ? err.message : "אירעה שגיאה" };
}

/** ממיר `scope`/`branchIds` שהגיעו מהטופס לזוג עקבי: "לכולם" תמיד עם רשימה ריקה. */
function normalizeScope(scope: OpsScope, branchIds: string[]): { scope: OpsScope; branchIds: string[] } {
  if (scope === "all") return { scope: "all", branchIds: [] };
  return { scope: "branches", branchIds: Array.from(new Set(branchIds.filter(Boolean))) };
}

/* ── מלאי ─────────────────────────────────────────────────────────────────── */

async function loadStockItems(): Promise<OpsStockItem[]> {
  const snap = await getAdminFirestore().collection(OPS_STOCK_ITEMS).get();
  return snap.docs
    .map((d) => {
      const data = d.data() as Partial<OpsStockItem>;
      return {
        id: d.id,
        name: data.name ?? "",
        targetQty: Number(data.targetQty) || 0,
        unit: data.unit ?? "",
        scope: (data.scope as OpsScope) ?? "all",
        branchIds: data.branchIds ?? [],
        order: Number(data.order) || 0,
        active: data.active !== false,
        createdAt: data.createdAt,
      } satisfies OpsStockItem;
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "he"));
}

async function loadStockCheck(branchId: string, periodKey: string): Promise<OpsStockCheck["marks"]> {
  const snap = await getAdminFirestore().collection(OPS_STOCK_CHECKS).doc(checkDocId(branchId, periodKey)).get();
  if (!snap.exists) return {};
  return ((snap.data() as Partial<OpsStockCheck>).marks ?? {}) as OpsStockCheck["marks"];
}

export type StockRow = {
  itemId: string;
  name: string;
  targetQty: number;
  unit: string;
  status: OpsStockMark | null;
  note: string;
};

export type BranchAlert = {
  branchId: string;
  branchName: string;
  /** פריטים שהסניף סימן עליהם X */
  missing: string[];
  /** כמה פריטים עוד לא סומנו כלל החודש */
  pending: number;
};

export type StockSnapshot = {
  isOwner: boolean;
  branches: OpsBranch[];
  branchId: string | null;
  periodKey: string;
  rows: StockRow[];
  /** סיכום לכל הסניפים — מוצג למנהל בלבד */
  alerts: BranchAlert[] | null;
};

export async function getStockSnapshotAction(branchIdInput?: string): Promise<StockSnapshot> {
  const access = await getOpsAccess();
  const periodKey = getMonthKey();
  const items = (await loadStockItems()).filter((i) => i.active);

  const branchId =
    branchIdInput && access.branches.some((b) => b.id === branchIdInput)
      ? branchIdInput
      : access.branches[0]?.id ?? null;

  let rows: StockRow[] = [];
  if (branchId) {
    const marks = await loadStockCheck(branchId, periodKey);
    rows = items
      .filter((i) => appliesToBranch(i, branchId))
      .map((i) => {
        const mark = marks[i.id];
        return {
          itemId: i.id,
          name: i.name,
          targetQty: i.targetQty,
          unit: i.unit ?? "",
          status: mark?.status ?? null,
          note: mark?.note ?? "",
        };
      });
  }

  let alerts: BranchAlert[] | null = null;
  if (access.isOwner) {
    const checks = await Promise.all(access.branches.map((b) => loadStockCheck(b.id, periodKey)));
    alerts = access.branches.map((b, i) => {
      const marks = checks[i] ?? {};
      const relevant = items.filter((item) => appliesToBranch(item, b.id));
      return {
        branchId: b.id,
        branchName: b.name,
        missing: relevant.filter((item) => marks[item.id]?.status === "missing").map((item) => item.name),
        pending: relevant.filter((item) => !marks[item.id]).length,
      };
    });
  }

  return { isOwner: access.isOwner, branches: access.branches, branchId, periodKey, rows, alerts };
}

/**
 * סימון V/X על פריט אחד. מסמך הבדיקה נוצר בעצלתיים לפי חודש, ולכן הסימון של
 * חודש קודם לא נדרס ולא נמחק — הוא פשוט לא נקרא יותר.
 */
export async function setStockMarkAction(
  branchId: string,
  itemId: string,
  status: OpsStockMark | null,
  note?: string,
): Promise<ActionResult> {
  try {
    const access = await getOpsAccess();
    assertBranchAllowed(access, branchId);
    const periodKey = getMonthKey();
    const db = getAdminFirestore();
    const ref = db.collection(OPS_STOCK_CHECKS).doc(checkDocId(branchId, periodKey));
    const now = new Date().toISOString();

    const payload: Record<string, unknown> = {
      branchId,
      periodKey,
      updatedAt: now,
      updatedBy: access.userLabel,
    };
    // ניקוי סימון = מחיקת השדה, לא כתיבת `null`. אחרת "לא סומן" ו"סומן ונוקה"
    // היו נראים שונה בקריאה ו-`pending` היה מפספס פריטים.
    payload[`marks.${itemId}`] =
      status === null
        ? FieldValue.delete()
        : { status, note: (note ?? "").trim(), at: now, by: access.userLabel };

    await ref.set({ branchId, periodKey }, { merge: true });
    await ref.update(payload);
    revalidatePath(`${OPS_PATH}/stock`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function upsertStockItemAction(input: {
  id?: string;
  name: string;
  targetQty: number;
  unit?: string;
  scope: OpsScope;
  branchIds: string[];
}): Promise<ActionResult> {
  try {
    await requireOwnerSession();
    const name = input.name.trim();
    if (!name) return { ok: false, message: "יש להזין שם פריט" };
    const db = getAdminFirestore();
    const { scope, branchIds } = normalizeScope(input.scope, input.branchIds);
    if (scope === "branches" && branchIds.length === 0) {
      return { ok: false, message: "יש לבחור לפחות סניף אחד" };
    }
    const data = {
      name,
      targetQty: Number(input.targetQty) || 0,
      unit: (input.unit ?? "").trim(),
      scope,
      branchIds,
      active: true,
    };
    if (input.id) {
      await db.collection(OPS_STOCK_ITEMS).doc(input.id).set(data, { merge: true });
    } else {
      const existing = await loadStockItems();
      const order = existing.length ? Math.max(...existing.map((i) => i.order)) + 1 : 0;
      await db.collection(OPS_STOCK_ITEMS).add({ ...data, order, createdAt: new Date().toISOString() });
    }
    revalidatePath(`${OPS_PATH}/settings`);
    revalidatePath(`${OPS_PATH}/stock`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteStockItemAction(id: string): Promise<ActionResult> {
  try {
    await requireOwnerSession();
    await getAdminFirestore().collection(OPS_STOCK_ITEMS).doc(id).delete();
    revalidatePath(`${OPS_PATH}/settings`);
    revalidatePath(`${OPS_PATH}/stock`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/* ── משימות ───────────────────────────────────────────────────────────────── */

async function loadTasks(): Promise<OpsTask[]> {
  const snap = await getAdminFirestore().collection(OPS_TASKS).get();
  return snap.docs
    .map((d) => {
      const data = d.data() as Partial<OpsTask>;
      return {
        id: d.id,
        name: data.name ?? "",
        details: data.details ?? "",
        freq: (data.freq as OpsTaskFreq) ?? "weekly",
        scope: (data.scope as OpsScope) ?? "all",
        branchIds: data.branchIds ?? [],
        order: Number(data.order) || 0,
        active: data.active !== false,
        createdAt: data.createdAt,
      } satisfies OpsTask;
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "he"));
}

async function loadTaskCheck(branchId: string, periodKey: string): Promise<OpsTaskCheck["done"]> {
  const snap = await getAdminFirestore().collection(OPS_TASK_CHECKS).doc(checkDocId(branchId, periodKey)).get();
  if (!snap.exists) return {};
  return ((snap.data() as Partial<OpsTaskCheck>).done ?? {}) as OpsTaskCheck["done"];
}

export type TaskRow = {
  taskId: string;
  name: string;
  details: string;
  freq: OpsTaskFreq;
  periodKey: string;
  isDone: boolean;
  doneBy: string;
};

export type TasksSnapshot = {
  isOwner: boolean;
  branches: OpsBranch[];
  branchId: string | null;
  weekKey: string;
  monthKey: string;
  rows: TaskRow[];
  /** סיכום לכל הסניפים — מוצג למנהל בלבד */
  progress: { branchId: string; branchName: string; done: number; total: number }[] | null;
};

export async function getOpsTasksSnapshotAction(branchIdInput?: string): Promise<TasksSnapshot> {
  const access = await getOpsAccess();
  const tasks = (await loadTasks()).filter((t) => t.active);
  const weekKey = periodKeyForFreq("weekly");
  const monthKey = periodKeyForFreq("monthly");

  const branchId =
    branchIdInput && access.branches.some((b) => b.id === branchIdInput)
      ? branchIdInput
      : access.branches[0]?.id ?? null;

  let rows: TaskRow[] = [];
  if (branchId) {
    const [weekDone, monthDone] = await Promise.all([
      loadTaskCheck(branchId, weekKey),
      loadTaskCheck(branchId, monthKey),
    ]);
    rows = tasks
      .filter((t) => appliesToBranch(t, branchId))
      .map((t) => {
        const periodKey = t.freq === "weekly" ? weekKey : monthKey;
        const entry = (t.freq === "weekly" ? weekDone : monthDone)[t.id];
        return {
          taskId: t.id,
          name: t.name,
          details: t.details ?? "",
          freq: t.freq,
          periodKey,
          isDone: Boolean(entry),
          doneBy: entry?.by ?? "",
        };
      });
  }

  let progress: TasksSnapshot["progress"] = null;
  if (access.isOwner) {
    const checks = await Promise.all(
      access.branches.map(async (b) => ({
        week: await loadTaskCheck(b.id, weekKey),
        month: await loadTaskCheck(b.id, monthKey),
      })),
    );
    progress = access.branches.map((b, i) => {
      const relevant = tasks.filter((t) => appliesToBranch(t, b.id));
      const done = relevant.filter((t) =>
        t.freq === "weekly" ? checks[i]?.week[t.id] : checks[i]?.month[t.id],
      ).length;
      return { branchId: b.id, branchName: b.name, done, total: relevant.length };
    });
  }

  return { isOwner: access.isOwner, branches: access.branches, branchId, weekKey, monthKey, rows, progress };
}

export async function setTaskDoneAction(
  branchId: string,
  taskId: string,
  freq: OpsTaskFreq,
  done: boolean,
): Promise<ActionResult> {
  try {
    const access = await getOpsAccess();
    assertBranchAllowed(access, branchId);
    const periodKey = periodKeyForFreq(freq);
    const db = getAdminFirestore();
    const ref = db.collection(OPS_TASK_CHECKS).doc(checkDocId(branchId, periodKey));
    const now = new Date().toISOString();

    await ref.set({ branchId, periodKey }, { merge: true });
    await ref.update({
      updatedAt: now,
      updatedBy: access.userLabel,
      [`done.${taskId}`]: done ? { at: now, by: access.userLabel } : FieldValue.delete(),
    });
    revalidatePath(`${OPS_PATH}/tasks`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function upsertOpsTaskAction(input: {
  id?: string;
  name: string;
  details?: string;
  freq: OpsTaskFreq;
  scope: OpsScope;
  branchIds: string[];
}): Promise<ActionResult> {
  try {
    await requireOwnerSession();
    const name = input.name.trim();
    if (!name) return { ok: false, message: "יש להזין שם משימה" };
    const { scope, branchIds } = normalizeScope(input.scope, input.branchIds);
    if (scope === "branches" && branchIds.length === 0) {
      return { ok: false, message: "יש לבחור לפחות סניף אחד" };
    }
    const db = getAdminFirestore();
    const data = {
      name,
      details: (input.details ?? "").trim(),
      freq: input.freq,
      scope,
      branchIds,
      active: true,
    };
    if (input.id) {
      await db.collection(OPS_TASKS).doc(input.id).set(data, { merge: true });
    } else {
      const existing = await loadTasks();
      const order = existing.length ? Math.max(...existing.map((t) => t.order)) + 1 : 0;
      await db.collection(OPS_TASKS).add({ ...data, order, createdAt: new Date().toISOString() });
    }
    revalidatePath(`${OPS_PATH}/settings`);
    revalidatePath(`${OPS_PATH}/tasks`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteOpsTaskAction(id: string): Promise<ActionResult> {
  try {
    await requireOwnerSession();
    await getAdminFirestore().collection(OPS_TASKS).doc(id).delete();
    revalidatePath(`${OPS_PATH}/settings`);
    revalidatePath(`${OPS_PATH}/tasks`);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/* ── הגדרות (מנהל) ────────────────────────────────────────────────────────── */

export type SettingsSnapshot = {
  branches: OpsBranch[];
  items: OpsStockItem[];
  tasks: OpsTask[];
};

export async function getOpsSettingsSnapshotAction(): Promise<SettingsSnapshot> {
  await requireOwnerSession();
  const access = await getOpsAccess();
  const [items, tasks] = await Promise.all([loadStockItems(), loadTasks()]);
  return { branches: access.branches, items, tasks };
}
