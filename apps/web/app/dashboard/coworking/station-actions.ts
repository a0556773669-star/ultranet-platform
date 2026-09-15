"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { FieldValue } from "firebase-admin/firestore";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CoworkingClient, CoworkingStation } from "@ultranet/shared-types";

/**
 * העמדות כמסך השכרה.
 *
 * עמדה היא מקום פיזי קבוע ולא רשומה שמקימים: יש ארבע, הן תמיד שם, והשאלה היחידה עליהן
 * היא מי יושב בהן עכשיו ועד מתי — בדיוק כמו נייד מושכר. לכן **מספר העמדה הוא הזהות**,
 * ומסמך ה-`n_cw_stations` נוצר מעצמו בפעם הראשונה שמשכירים אותה. אין "הוספת עמדה".
 *
 * ההשכרה עצמה נשארת `n_cw_clients` — אותו מודל מנוי שכבר מחשב חודשים לתשלום וחובות.
 */

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("יש להתחבר");
  return session;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

function revalidateAll() {
  revalidatePath("/dashboard/coworking");
  revalidatePath("/dashboard/coworking/accounting");
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard");
}

/** מאתר את מסמך העמדה לפי המספר שלה בסניף, ויוצר אותו אם זו הפעם הראשונה. */
async function resolveStationId(branchId: string, stationNumber: number, price: number): Promise<string> {
  const db = getAdminFirestore();
  const snap = await db.collection("n_cw_stations").where("branchId", "==", branchId).get();
  const existing = snap.docs.find((d) => (d.data() as CoworkingStation).name?.trim() === String(stationNumber));
  if (existing) {
    if (price > 0) await existing.ref.set({ price }, { merge: true });
    return existing.id;
  }
  const data: Omit<CoworkingStation, "id"> = { branchId, name: String(stationNumber), price };
  const ref = await db.collection("n_cw_stations").add(data);
  return ref.id;
}

/** התחלת השכרה על עמדה פנויה. */
export async function rentStationAction(branchId: string, stationNumber: number, formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const price = Number(formData.get("price")) || 0;
  if (!branchId || !name || !startDate) {
    throw new Error("שם השוכר ותאריך התחלה הם שדות חובה");
  }

  const stationId = await resolveStationId(branchId, stationNumber, price);
  const data: Omit<CoworkingClient, "id"> = stripUndefined({
    branchId,
    name,
    stationId,
    stationNumber: String(stationNumber),
    startDate,
    endDate: String(formData.get("endDate") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    customPrice: price || undefined,
    // יום התשלום הוא היום שבו התחילה השכירות - זו ההגדרה, ולכן הוא נגזר ולא נשאל.
    payDay: Number(startDate.slice(8, 10)) || undefined,
    payments: [],
  });
  await getAdminFirestore().collection("n_cw_clients").add(data);
  revalidateAll();
}

/** סיום השכרה. התאריך הוא עובדה היסטורית, ולכן נשמר ולא נמחק. */
export async function endStationRentalAction(clientId: string, formData: FormData) {
  await requireSession();
  const endDate = String(formData.get("endDate") ?? "").trim() || new Date().toISOString().slice(0, 10);
  await getAdminFirestore().collection("n_cw_clients").doc(clientId).set({ endDate }, { merge: true });
  revalidateAll();
}

/** ביטול סיום - העמדה חוזרת להיות מושכרת לאותו שוכר. */
export async function reopenStationRentalAction(clientId: string) {
  await requireSession();
  await getAdminFirestore()
    .collection("n_cw_clients")
    .doc(clientId)
    .set({ endDate: FieldValue.delete() }, { merge: true });
  revalidateAll();
}

/**
 * סימון "שילם" לחודש מסוים.
 *
 * הסימון הוא גם הרישום בהנה"ח הראשית: הבעלים ביקש שברגע שמסמנים ששולם, הסכום ייכנס
 * לספר הראשי — ולכן `countsToMain` דלוק ואין כאן שאלה נוספת. התשלום **מחליף** תשלום
 * קיים לאותו חודש ולא נוסף לצידו: "שילם" הוא מצב של חודש, וכפילות הייתה מכפילה את
 * ההכנסה בראשי.
 */
export async function markStationPaidAction(clientId: string, month: string, formData: FormData) {
  await requireSession();
  const amount = Number(formData.get("amount")) || 0;
  if (!month || !amount) throw new Error("חודש וסכום הם שדות חובה");

  const db = getAdminFirestore();
  const ref = db.collection("n_cw_clients").doc(clientId);
  const doc = await ref.get();
  const client = doc.data() as CoworkingClient | undefined;
  const payments = (client?.payments ?? []).filter((p) => p.month !== month);
  payments.push({
    month,
    amount,
    date: new Date().toISOString().slice(0, 10),
    countsToMain: true,
  });
  payments.sort((a, b) => a.month.localeCompare(b.month));
  await ref.set({ payments }, { merge: true });
  revalidateAll();
}

/** ביטול סימון תשלום - מוציא גם את ההכנסה מהספר הראשי. */
export async function unmarkStationPaidAction(clientId: string, month: string) {
  await requireSession();
  const db = getAdminFirestore();
  const ref = db.collection("n_cw_clients").doc(clientId);
  const doc = await ref.get();
  const client = doc.data() as CoworkingClient | undefined;
  const payments = (client?.payments ?? []).filter((p) => p.month !== month);
  await ref.set({ payments }, { merge: true });
  revalidateAll();
}

/**
 * מחיקת השכרה מההיסטוריה.
 *
 * זו מחיקה אמיתית ולא רכה: השכרה במשרד השיתופי לא מותירה אחריה שורות בקולקשנים אחרים
 * שיישארו יתומות (התשלומים יושבים בתוך המסמך עצמו), ולכן אין מה לשמר. **אבל** התשלומים
 * שנמחקים איתה הם הכנסה שנספרה בהנה"ח הראשית, ולכן המחיקה גורעת משם כסף - וזו בדיוק
 * הסיבה שהכפתור מבקש אישור שמונה כמה תשלומים ילכו. מוגבל לבעלים.
 */
export async function deleteRentalAction(clientId: string) {
  const session = await requireSession();
  if (session.user?.role !== "owner") {
    throw new Error("מחיקת השכרה מוגבלת לבעלים בלבד");
  }
  await getAdminFirestore().collection("n_cw_clients").doc(clientId).delete();
  revalidateAll();
}
