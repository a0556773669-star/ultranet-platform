"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";
import type { Milestone, PeriodAssignment, Rock } from "@ultranet/shared-types";
import { assignmentId } from "../rocks/task-status";
import { buildImportPlan, IMPORT_BATCH, QUARTER_KEY, QUARTER_LABEL, type ImportPlan } from "./import-plan";

const QUARTERS = "n_quarters";
const ROCKS = "n_rocks";
const MILESTONES = "n_milestones";
const ASSIGNMENTS = "n_period_assignments";
const ACTIVITY = "n_task_activity";
const REVIEWS = "n_rock_reviews";
const PERSONAL_TASKS = "n_personal_tasks";
const PERSONAL_COMMENTS = "n_personal_task_comments";

const BATCH_LIMIT = 400;

/**
 * הכלי כבוי בברירת מחדל כשמסמנים `off` - אותו דפוס כמו `BRANCH_INCOME_IMPORT`:
 * כשמילוי ההיסטוריה יסתיים, שמים `QUARTER1_IMPORT=off` והכלי מסרב לפעול גם
 * בשרת, לא רק במסך.
 */
function importEnabled(): boolean {
  return (process.env.QUARTER1_IMPORT ?? "on").toLowerCase() !== "off";
}

export type ImportResult =
  | { ok: true; committed: boolean; report: ImportReport }
  | { ok: false; message: string };

export type ImportReport = {
  quarterKey: string;
  quarterLabel: string;
  activeMonthKey: string;
  activeWeekKey: string;
  plan: ImportPlan["stats"];
  review: ImportPlan["review"];
  warnings: string[];
  /** מה באמת ייכתב מול מה שכבר קיים - זה ההבדל בין הרצה ראשונה לחוזרת */
  rocksCreated: number;
  rocksUpdated: number;
  milestonesCreated: number;
  milestonesUpdated: number;
  assignmentsWritten: number;
  /** רשומות קיימות שאינן חלק מהייבוא ולא נגענו בהן */
  untouchedRocks: number;
  untouchedMilestones: number;
};

async function currentUserLabel(): Promise<string> {
  const session = await getServerSession(authOptions);
  return session?.user?.name ?? session?.user?.email ?? "";
}

/** קריאת כל הרשומות של האצווה - הבסיס לאידמפוטנטיות. */
async function loadExisting(db: Firestore) {
  const [rocksSnap, milestonesSnap] = await Promise.all([
    db.collection(ROCKS).where("importBatch", "==", IMPORT_BATCH).get(),
    db.collection(MILESTONES).where("importBatch", "==", IMPORT_BATCH).get(),
  ]);
  const rockIds = new Map<string, string>();
  rocksSnap.docs.forEach((d) => {
    const key = (d.data() as Partial<Rock>).importKey ?? "";
    if (key) rockIds.set(key, d.id);
  });
  const milestoneIds = new Map<string, string>();
  milestonesSnap.docs.forEach((d) => {
    const key = (d.data() as Partial<Milestone>).importKey ?? "";
    if (key) milestoneIds.set(key, d.id);
  });
  return { rockIds, milestoneIds };
}

type Write = { ref: DocumentReference; data: Record<string, unknown>; merge: boolean };

async function commitWrites(db: Firestore, writes: Write[]): Promise<void> {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    writes.slice(i, i + BATCH_LIMIT).forEach((w) => {
      if (w.merge) batch.set(w.ref, w.data, { merge: true });
      else batch.set(w.ref, w.data);
    });
    await batch.commit();
  }
}

/**
 * גיבוי מלא של מודול המשימות לפני כתיבה - JSON אחד שאפשר להוריד ולשמור.
 * זו רשת הביטחון: גם אם משהו ישתבש, המצב הקודם קיים מחוץ למסד.
 *
 * מכסה את שמונת הקולקשנים של המודול, כולל הטאב האישי "משימות ליוני".
 */
export async function exportModuleBackupAction(): Promise<{ ok: true; json: string; counts: Record<string, number> } | { ok: false; message: string }> {
  await requireOwner();
  const db = getAdminFirestore();
  // הגיבוי מכסה גם את הטאב האישי, כדי ששתי אצוות הייבוא יהיו מכוסות באותו קובץ.
  const names = [QUARTERS, ROCKS, MILESTONES, ASSIGNMENTS, REVIEWS, ACTIVITY, PERSONAL_TASKS, PERSONAL_COMMENTS];
  const snaps = await Promise.all(names.map((n) => db.collection(n).get()));
  const dump: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  names.forEach((n, i) => {
    const docs = snaps[i]!.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }));
    dump[n] = docs;
    counts[n] = docs.length;
  });
  return {
    ok: true,
    counts,
    json: JSON.stringify({ exportedAt: new Date().toISOString(), batch: IMPORT_BATCH, collections: dump }, null, 2),
  };
}

/**
 * מריץ את הייבוא. `commit: false` הוא dry-run אמיתי מול הדאטה החי: הוא קורא את
 * המצב הקיים ומדווח בדיוק מה ייווצר ומה יעודכן - בלי לכתוב כלום.
 *
 * הרצה חוזרת אינה יוצרת כפילויות: כל סלע ואבן דרך נמצאים לפי `importKey`, ומזהי
 * שיוכי התקופה דטרמיניסטיים ממילא. רשומות שאינן חלק מהאצווה לא נמחקות ולא נדרסות.
 */
export async function runImportAction(commit: boolean): Promise<ImportResult> {
  await requireOwner();
  if (!importEnabled()) return { ok: false, message: "כלי הייבוא כבוי (QUARTER1_IMPORT=off)." };

  const db = getAdminFirestore();
  const plan = buildImportPlan(new Date());
  if (plan.warnings.length) return { ok: false, message: `נתוני המקור אינם תקינים: ${plan.warnings[0]}` };

  const { rockIds, milestoneIds } = await loadExisting(db);
  const user = await currentUserLabel();
  const now = Date.now();

  const [allRocks, allMilestones] = await Promise.all([
    db.collection(ROCKS).get(),
    db.collection(MILESTONES).get(),
  ]);

  const report: ImportReport = {
    quarterKey: plan.quarterKey,
    quarterLabel: plan.quarterLabel,
    activeMonthKey: plan.activeMonthKey,
    activeWeekKey: plan.activeWeekKey,
    plan: plan.stats,
    review: plan.review,
    warnings: plan.warnings,
    rocksCreated: 0,
    rocksUpdated: 0,
    milestonesCreated: 0,
    milestonesUpdated: 0,
    assignmentsWritten: plan.assignments.length,
    untouchedRocks: allRocks.docs.filter((d) => (d.data() as Partial<Rock>).importBatch !== IMPORT_BATCH).length,
    untouchedMilestones: allMilestones.docs.filter((d) => (d.data() as Partial<Milestone>).importBatch !== IMPORT_BATCH).length,
  };

  // --- הקצאת מזהים: קיים = עדכון, חדש = מסמך חדש ---
  const resolvedRock = new Map<string, string>();
  plan.rocks.forEach((r) => {
    const existing = rockIds.get(r.importKey);
    if (existing) {
      resolvedRock.set(r.importKey, existing);
      report.rocksUpdated += 1;
    } else {
      resolvedRock.set(r.importKey, db.collection(ROCKS).doc().id);
      report.rocksCreated += 1;
    }
  });

  const resolvedMilestone = new Map<string, string>();
  plan.milestones.forEach((ms) => {
    const existing = milestoneIds.get(ms.importKey);
    if (existing) {
      resolvedMilestone.set(ms.importKey, existing);
      report.milestonesUpdated += 1;
    } else {
      resolvedMilestone.set(ms.importKey, db.collection(MILESTONES).doc().id);
      report.milestonesCreated += 1;
    }
  });

  if (!commit) return { ok: true, committed: false, report };

  // --- כתיבה ---
  const writes: Write[] = [];

  writes.push({
    ref: db.collection(QUARTERS).doc(plan.quarterKey),
    merge: true,
    data: {
      label: QUARTER_LABEL,
      status: "active",
      startDate: "",
      endDate: "",
      order: plan.periods.M1.endsAt,
      activeMonthKey: plan.activeMonthKey,
      activeWeekKey: plan.activeWeekKey,
      rolledFromKey: null,
      createdAt: plan.periods.M1.endsAt,
      createdBy: user,
    },
  });

  plan.rocks.forEach((r) => {
    writes.push({
      ref: db.collection(ROCKS).doc(resolvedRock.get(r.importKey)!),
      merge: true,
      data: {
        title: r.title,
        description: r.description,
        quarterKey: plan.quarterKey,
        parentRockId: r.parentImportKey ? (resolvedRock.get(r.parentImportKey) ?? null) : null,
        ownerUserId: "",
        ownerName: r.ownerName,
        status: r.status,
        dueDate: "",
        order: r.order,
        rolledFromId: null,
        deletedAt: null,
        createdAt: r.order,
        createdBy: user,
        updatedAt: now,
        importBatch: IMPORT_BATCH,
        importKey: r.importKey,
      },
    });
  });

  plan.milestones.forEach((ms) => {
    writes.push({
      ref: db.collection(MILESTONES).doc(resolvedMilestone.get(ms.importKey)!),
      merge: true,
      data: {
        rockId: resolvedRock.get(ms.rockImportKey) ?? "",
        quarterKey: plan.quarterKey,
        title: ms.title,
        description: ms.description,
        ownerUserId: "",
        ownerName: ms.ownerName,
        status: ms.status,
        done: ms.status === "done",
        priority: "normal",
        dueDate: "",
        notes: ms.notes,
        waitReason: "",
        waitUntil: "",
        cancelReason: "",
        doneAt: ms.doneAt,
        completedBy: ms.status === "done" ? user : "",
        reopenCount: 0,
        carryOverCount: ms.carryOverCount,
        source: "rock",
        origin: ms.origin,
        rolledFromId: null,
        order: ms.order,
        deletedAt: null,
        createdAt: ms.order,
        createdBy: user,
        updatedAt: now,
        updatedBy: user,
        importBatch: IMPORT_BATCH,
        importKey: ms.importKey,
      },
    });
  });

  plan.assignments.forEach((a) => {
    const milestoneId = resolvedMilestone.get(a.milestoneImportKey)!;
    writes.push({
      ref: db.collection(ASSIGNMENTS).doc(assignmentId(milestoneId, a.periodType, a.periodKey)),
      merge: true,
      data: {
        milestoneId,
        quarterKey: plan.quarterKey,
        periodType: a.periodType,
        periodKey: a.periodKey,
        assignedAt: a.assignedAt,
        assignedBy: user,
        outcome: a.outcome,
        closedAt: a.closedAt,
      },
    });
  });

  await commitWrites(db, writes);

  // רישום אחד ליומן על האצווה כולה - כדי שיהיה תיעוד מי הריץ ומה נכתב.
  await db.collection(ACTIVITY).add({
    entityType: "quarter",
    entityId: plan.quarterKey,
    action: "create",
    field: "ייבוא",
    oldValue: "",
    newValue: QUARTER_LABEL,
    milestoneId: "",
    quarterKey: plan.quarterKey,
    note: `ייבוא ${IMPORT_BATCH} · ${report.rocksCreated}+${report.rocksUpdated} סלעים · ${report.milestonesCreated}+${report.milestonesUpdated} אבני דרך · ${report.assignmentsWritten} שיוכים`,
    userName: user,
    at: now,
  });

  revalidatePath("/dashboard/duxus", "layout");
  return { ok: true, committed: true, report };
}

export type DiagnosticsResult =
  | { ok: true; lines: string[] }
  | { ok: false; message: string };

/**
 * בדיקת חיבור: קוראת מעט מאוד מכל קולקשן ומדווחת מה קיים.
 *
 * קיימת כדי שכשמשהו לא עובד תהיה **תשובה** ולא מסך שותק - היא מבדילה בין
 * "אין הרשאה", "אין חיבור ל-Firestore" ו-"הכל תקין אבל עוד לא ייבאת".
 */
export async function runDiagnosticsAction(): Promise<DiagnosticsResult> {
  try {
    await requireOwner();
  } catch {
    return { ok: false, message: "אין לך הרשאת בעלים, או שההתחברות פגה. יש להתחבר מחדש." };
  }

  const lines: string[] = [];
  try {
    const db = getAdminFirestore();
    lines.push("חיבור ל-Firestore: תקין");

    const names = [QUARTERS, ROCKS, MILESTONES, ASSIGNMENTS, PERSONAL_TASKS, PERSONAL_COMMENTS, ACTIVITY];
    const counts = await Promise.all(names.map(async (n) => [n, (await db.collection(n).count().get()).data().count] as const));
    counts.forEach(([n, c]) => lines.push(`${n}: ${c} מסמכים`));

    const imported = await db.collection(ROCKS).where("importBatch", "==", IMPORT_BATCH).count().get();
    lines.push(`סלעים מאצוות הייבוא: ${imported.data().count}`);
    const user = await currentUserLabel();
    lines.push(`משתמש מחובר: ${user || "(לא זוהה שם)"}`);
    lines.push(`דגל QUARTER1_IMPORT: ${importEnabled() ? "on" : "off"}`);
    return { ok: true, lines };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `שגיאה בגישה ל-Firestore: ${message}` };
  }
}
