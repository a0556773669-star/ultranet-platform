"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import type { DocumentReference, Firestore } from "firebase-admin/firestore";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";
import type { PersonalTask, TaskSettings } from "@ultranet/shared-types";
import {
  buildPersonalImportPlan,
  PERSONAL_IMPORT_BATCH,
  phoneKey,
  titleKey,
  type PersonalImportPlan,
} from "./personal-import-plan";

const TASKS = "n_personal_tasks";
const COMMENTS = "n_personal_task_comments";
const ACTIVITY = "n_task_activity";
const SETTINGS = "n_task_settings";
const SETTINGS_DOC = "default";

const BATCH_LIMIT = 400;

/** שם ברירת המחדל כשלא ניתן לזהות את המזכירה בוודאות - לא ממציאים משתמש. */
const IMPORT_USER = "ייבוא";

export type PersonalImportResult =
  | { ok: true; committed: boolean; report: PersonalImportReport }
  | { ok: false; message: string };

export type PersonalImportReport = {
  plan: PersonalImportPlan["stats"];
  review: PersonalImportPlan["review"];
  warnings: string[];
  createdBy: string;
  /** נוצרו חדשות */
  created: number;
  /** רשומות של האצווה שכבר קיימות ועודכנו */
  updated: number;
  /** אוחדו לתוך משימה שכבר הייתה בטאב לפני הייבוא */
  mergedIntoExisting: { title: string; matchedBy: "כותרת" | "טלפון" }[];
  comments: number;
  /** משימות קיימות בטאב שאינן חלק מהייבוא ולא נגענו בהן */
  untouched: number;
};

async function currentUserLabel(): Promise<string> {
  const session = await getServerSession(authOptions);
  return session?.user?.name ?? session?.user?.email ?? "";
}

/**
 * מי רשום כיוצר המשימות המיובאות.
 *
 * ההוראה: משתמש המזכירה אם ניתן לזהותו **בבטחה**, אחרת משתמש הייבוא - בלי
 * להמציא משתמש. לכן רק כאשר מוגדרת בדיוק כתובת אחת ברשימת העורכים (זו של
 * המזכירה) היא נבחרת; בכל מצב אחר נופלים למשתמש הייבוא.
 */
async function resolveCreatedBy(db: Firestore): Promise<string> {
  const doc = await db.collection(SETTINGS).doc(SETTINGS_DOC).get();
  const raw = doc.exists ? (doc.data() as Partial<TaskSettings>).personalEditorEmails : undefined;
  const editors = Array.isArray(raw) ? raw.map((v) => String(v).trim()).filter(Boolean) : [];
  return editors.length === 1 ? (editors[0] as string) : IMPORT_USER;
}

type Write = { ref: DocumentReference; data: Record<string, unknown>; merge: boolean };

async function commitWrites(db: Firestore, writes: Write[]): Promise<void> {
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    writes.slice(i, i + BATCH_LIMIT).forEach((w) => batch.set(w.ref, w.data, { merge: w.merge }));
    await batch.commit();
  }
}

/**
 * מריץ את ייבוא "משימות ליוני". `commit: false` הוא dry-run אמיתי מול הדאטה החי:
 * קורא את המצב הקיים ומדווח בדיוק מה ייווצר, מה יעודכן ומה יאוחד - בלי לכתוב.
 *
 * **שלוש דרגות התאמה, בסדר הזה:**
 * 1. רשומה של האצווה עם אותו `importKey` → עדכון שלה (זה מה שהופך הרצה חוזרת
 *    לבטוחה).
 * 2. משימה **פעילה** שכבר הייתה בטאב עם אותה כותרת או אותו טלפון → **מיזוג**:
 *    מוסיפים לה את ההערות, ממלאים רק שדות ריקים, ולא נוגעים בסטטוס, בדחיפות
 *    או בכל ערך קיים. היא מסומנת ב-`importKey` כדי שהמיזוג עצמו יהיה idempotent.
 * 3. אין התאמה → יצירת משימה חדשה.
 *
 * הייבוא **אינו מוחק דבר** ואינו נוגע בסלעים, באבני הדרך או ברבעון.
 */
export async function runPersonalImportAction(commit: boolean): Promise<PersonalImportResult> {
  await requireOwner();

  const db = getAdminFirestore();
  const plan = buildPersonalImportPlan();
  if (plan.warnings.length) return { ok: false, message: `נתוני המקור אינם תקינים: ${plan.warnings[0]}` };

  const snap = await db.collection(TASKS).get();
  const existing = snap.docs.map((d) => ({ id: d.id, data: d.data() as Partial<PersonalTask> }));

  const byImportKey = new Map<string, string>();
  existing.forEach((e) => {
    if (e.data.importBatch === PERSONAL_IMPORT_BATCH && e.data.importKey) byImportKey.set(e.data.importKey, e.id);
  });

  // מועמדים למיזוג: רק משימות פעילות שאינן שייכות לאצווה ואינן מחוקות.
  const mergeCandidates = existing.filter(
    (e) => e.data.importBatch !== PERSONAL_IMPORT_BATCH && !e.data.deletedAt && e.data.status !== "done" && e.data.status !== "cancelled"
  );
  const byTitle = new Map<string, (typeof mergeCandidates)[number]>();
  const byPhone = new Map<string, (typeof mergeCandidates)[number]>();
  mergeCandidates.forEach((e) => {
    const t = titleKey(e.data.title ?? "");
    if (t && !byTitle.has(t)) byTitle.set(t, e);
    const p = phoneKey(e.data.contactPhone ?? "");
    if (p.length >= 7 && !byPhone.has(p)) byPhone.set(p, e);
  });

  const user = await currentUserLabel();
  const createdBy = await resolveCreatedBy(db);
  const now = Date.now();

  const report: PersonalImportReport = {
    plan: plan.stats,
    review: plan.review,
    warnings: plan.warnings,
    createdBy,
    created: 0,
    updated: 0,
    mergedIntoExisting: [],
    comments: 0,
    untouched: 0,
  };

  const writes: Write[] = [];
  const claimed = new Set<string>();

  plan.tasks.forEach((task) => {
    const fromBatch = byImportKey.get(task.importKey);
    let ref: DocumentReference;
    let mode: "create" | "update" | "merge";
    let target: (typeof mergeCandidates)[number] | undefined;

    if (fromBatch) {
      ref = db.collection(TASKS).doc(fromBatch);
      mode = "update";
      report.updated += 1;
    } else {
      const byT = byTitle.get(titleKey(task.title));
      const p = phoneKey(task.contactPhone);
      const byP = p.length >= 7 ? byPhone.get(p) : undefined;
      target = byT ?? byP;
      if (target && !claimed.has(target.id)) {
        claimed.add(target.id);
        ref = db.collection(TASKS).doc(target.id);
        mode = "merge";
        report.mergedIntoExisting.push({ title: task.title, matchedBy: byT ? "כותרת" : "טלפון" });
      } else {
        ref = db.collection(TASKS).doc();
        mode = "create";
        report.created += 1;
      }
    }

    if (mode === "merge" && target) {
      // מיזוג שמרני: ממלאים רק מה שריק, ולא נוגעים בסטטוס, בדחיפות או בכל ערך קיים.
      const fill: Record<string, unknown> = { importBatch: PERSONAL_IMPORT_BATCH, importKey: task.importKey, updatedAt: now, updatedBy: user };
      if (!target.data.description && task.description) fill.description = task.description;
      if (!target.data.contactName && task.contactName) fill.contactName = task.contactName;
      if (!target.data.contactPhone && task.contactPhone) fill.contactPhone = task.contactPhone;
      writes.push({ ref, data: fill, merge: true });
    } else {
      writes.push({
        ref,
        merge: true,
        data: {
          title: task.title,
          description: task.description,
          contactName: task.contactName,
          contactPhone: task.contactPhone,
          priority: task.priority,
          status: task.status,
          dueDate: "",
          dueTime: "",
          pinned: false,
          lastNote: task.comments.length ? (task.comments[task.comments.length - 1] as string) : "",
          createdBy,
          createdAt: task.createdAt,
          viewedAt: null,
          completedBy: "",
          completedAt: task.completedAt,
          cancelledBy: "",
          cancelledAt: null,
          cancelReason: "",
          reopenCount: 0,
          deletedAt: null,
          deletedBy: "",
          updatedAt: task.completedAt ?? task.createdAt,
          updatedBy: createdBy,
          importBatch: PERSONAL_IMPORT_BATCH,
          importKey: task.importKey,
        },
      });
    }

    // הערות: מזהה דטרמיניסטי, ולכן הרצה חוזרת לא מכפילה אותן.
    task.comments.forEach((body, i) => {
      report.comments += 1;
      writes.push({
        ref: db.collection(COMMENTS).doc(`${PERSONAL_IMPORT_BATCH}__${task.importKey}__${i}`),
        merge: true,
        data: {
          taskId: ref.id,
          body,
          createdBy,
          createdAt: task.createdAt + i * 1000,
          editedAt: null,
        },
      });
    });
  });

  report.untouched = existing.filter((e) => e.data.importBatch !== PERSONAL_IMPORT_BATCH && !claimed.has(e.id)).length;

  if (!commit) return { ok: true, committed: false, report };

  await commitWrites(db, writes);

  await db.collection(ACTIVITY).add({
    entityType: "personal_task",
    entityId: "",
    action: "create",
    field: "ייבוא",
    oldValue: "",
    newValue: PERSONAL_IMPORT_BATCH,
    personalTaskId: "",
    note: `ייבוא ${PERSONAL_IMPORT_BATCH} · ${report.created} נוצרו · ${report.updated} עודכנו · ${report.mergedIntoExisting.length} אוחדו · ${report.comments} הערות`,
    userName: user,
    at: now,
  });

  revalidatePath("/dashboard/duxus", "layout");
  return { ok: true, committed: true, report };
}
