"use server";

import { revalidatePath } from "next/cache";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";

const ROCKS_PATH = "/dashboard/duxus/rocks";
const BATCH_LIMIT = 450; // מתחת למגבלת ה-500 כתיבות לבאץ' של Firestore, ליתר ביטחון

/** מוחקת קולקשן שלם (כל המסמכים) בבאצ'ים - בלי תלות במבנה השדות. */
async function wipeCollection(db: Firestore, collection: string): Promise<number> {
  let deleted = 0;
  // לולאה עד שהקולקשן ריק - כדי להתמודד עם קולקשנים גדולים משמעותית מ-BATCH_LIMIT
  for (;;) {
    const snap = await db.collection(collection).limit(BATCH_LIMIT).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < BATCH_LIMIT) break;
  }
  return deleted;
}

export type WipeSummary = { rocksDeleted: number; milestonesDeleted: number; reviewsDeleted: number };

/**
 * מחיקה חד-פעמית (owner-only) של **כל** הסלעים, אבני הדרך וסיכומי הפגישות -
 * ללא קשר למקור (ידני או ייבוא). לא נוגעת בנהלים (n_procedures).
 */
export async function wipeAllRocksDataAction(): Promise<
  { ok: true; summary: WipeSummary } | { ok: false; message: string }
> {
  await requireOwner();
  const db = getAdminFirestore();

  const [rocksDeleted, milestonesDeleted, reviewsDeleted] = await Promise.all([
    wipeCollection(db, "n_rocks"),
    wipeCollection(db, "n_milestones"),
    wipeCollection(db, "n_rock_reviews"),
  ]);

  revalidatePath(ROCKS_PATH);

  return { ok: true, summary: { rocksDeleted, milestonesDeleted, reviewsDeleted } };
}
