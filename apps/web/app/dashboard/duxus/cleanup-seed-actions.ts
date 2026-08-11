"use server";

import { revalidatePath } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";

/**
 * מוחק (owner-only) כל רשומה ב-n_rocks / n_milestones / n_procedures שנוצרה
 * ע"י הייבוא האוטומטי החד-פעמי הקודם (מסומנת createdBy: "seed"). לא נוגע
 * בשום דבר שהוזן ידנית דרך הממשק. אידמפוטנטי - הרצה חוזרת אחרי שהניקוי כבר
 * בוצע פשוט לא תמצא כלום למחוק.
 */

export type CleanupSummary = { rocksDeleted: number; milestonesDeleted: number; proceduresDeleted: number };

async function deleteBySeedMarker(collection: string): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db.collection(collection).where("createdBy", "==", "seed").get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

export async function deleteSeedDataAction(): Promise<
  { ok: true; summary: CleanupSummary } | { ok: false; message: string }
> {
  await requireOwner();

  const [rocksDeleted, milestonesDeleted, proceduresDeleted] = await Promise.all([
    deleteBySeedMarker("n_rocks"),
    deleteBySeedMarker("n_milestones"),
    deleteBySeedMarker("n_procedures"),
  ]);

  revalidatePath("/dashboard/duxus");
  revalidatePath("/dashboard/duxus/rocks");

  return { ok: true, summary: { rocksDeleted, milestonesDeleted, proceduresDeleted } };
}
