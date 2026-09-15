"use server";

/**
 * ניהול סוגי הרכישה החוזרת והשיוך של רכישות אליהם.
 *
 * הכל owner-only: סוג רכישה חוצה סניפים ומודולים, ומי שמסמן רכישה של סניף אחר משנה מספר
 * שמישהו אחר מסתכל עליו.
 */
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { RecurringPurchaseType } from "@ultranet/shared-types";
import { MULTI_BRANCH_EXPENSES_COLLECTION } from "@/lib/multi-branch-expense";
import { EXPENSE_TYPES_COLLECTION } from "@/lib/recurring-purchases";

/** זורק ולא מפנה: בתוך Server Action שגיאה מגיעה למשתמש כהודעה, ו-redirect פשוט נבלע. */
async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  if (session.user?.role !== "owner") throw new Error("אין הרשאה");
  return session;
}

const MODULES: RecurringPurchaseType["module"][] = ["computers", "rentals", "coworking", "general"];

function moduleFromForm(formData: FormData): RecurringPurchaseType["module"] {
  const raw = String(formData.get("module") ?? "").trim() as RecurringPurchaseType["module"];
  return MODULES.includes(raw) ? raw : "general";
}

/** ריק = כל סניפי המודול, בדיוק כמו בהוצאה משותפת — ולכן השדה נמחק ולא נשמר כמערך ריק. */
function branchIdsFromForm(formData: FormData): string[] | undefined {
  if (String(formData.get("branchScope") ?? "all") !== "selected") return undefined;
  const ids = formData
    .getAll("branchIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  return ids.length > 0 ? Array.from(new Set(ids)) : undefined;
}

function revalidateAll() {
  revalidatePath("/dashboard/accounting/recurring-purchases");
  revalidatePath("/dashboard/accounting/extra-expenses");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/rentals/expenses");
  revalidatePath("/dashboard/coworking/accounting");
}

export async function createExpenseTypeAction(formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("חובה למלא שם");

  const data: Omit<RecurringPurchaseType, "id"> = {
    name,
    module: moduleFromForm(formData),
    createdAt: new Date().toISOString(),
    ...(String(formData.get("category") ?? "").trim()
      ? { category: String(formData.get("category")).trim() }
      : {}),
    ...(String(formData.get("note") ?? "").trim() ? { note: String(formData.get("note")).trim() } : {}),
  };
  const branchIds = branchIdsFromForm(formData);
  if (branchIds) data.branchIds = branchIds;

  await getAdminFirestore().collection(EXPENSE_TYPES_COLLECTION).add(data);
  revalidateAll();
}

export async function updateExpenseTypeAction(id: string, formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("חובה למלא שם");
  const category = String(formData.get("category") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const branchIds = branchIdsFromForm(formData);

  await getAdminFirestore()
    .collection(EXPENSE_TYPES_COLLECTION)
    .doc(id)
    .set(
      {
        name,
        module: moduleFromForm(formData),
        category: category || FieldValue.delete(),
        note: note || FieldValue.delete(),
        branchIds: branchIds ?? FieldValue.delete(),
      },
      { merge: true },
    );
  revalidateAll();
}

/**
 * ארכוב ולא מחיקה: סוג שהופסק מפסיק להופיע בטפסים, אבל כל הרכישות שסומנו בו נשארות
 * מסומנות וההיסטוריה של השנים הקודמות ממשיכה להיות קריאה. מוצר שקנינו שנתיים והפסקנו
 * הוא בדיוק מה שרוצים לראות בדוח, לא מה שרוצים למחוק ממנו.
 */
export async function setExpenseTypeArchivedAction(id: string, archived: boolean) {
  await requireOwner();
  await getAdminFirestore()
    .collection(EXPENSE_TYPES_COLLECTION)
    .doc(id)
    .set({ archived }, { merge: true });
  revalidateAll();
}

/**
 * מחיקה אמיתית — ורק אחרי שהשיוך הוסר מכל רכישה שהצביעה על הסוג. `expenseTypeId` יתום
 * הוא רכישה שסומנה כחוזרת ואי אפשר לדעת של מה, כלומר בדיוק השורה שהמודול קיים כדי למנוע.
 */
export async function deleteExpenseTypeAction(id: string) {
  await requireOwner();
  const db = getAdminFirestore();
  const [varSnap, multiSnap] = await Promise.all([
    db.collection("n_var_expenses").where("expenseTypeId", "==", id).get(),
    db.collection(MULTI_BRANCH_EXPENSES_COLLECTION).where("expenseTypeId", "==", id).get(),
  ]);

  const docs = [...varSnap.docs, ...multiSnap.docs];
  // מכסת ה-batch של Firestore היא 500; הפיצול ל-400 הוא אותו גודל שבו נכתב העדכון
  // הרטרואקטיבי, כדי שסוג עם היסטוריה ארוכה לא ייכשל בשקט.
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + 400)) {
      batch.set(doc.ref, { expenseTypeId: FieldValue.delete() }, { merge: true });
    }
    await batch.commit();
  }

  await db.collection(EXPENSE_TYPES_COLLECTION).doc(id).delete();
  revalidateAll();
}

const SOURCE_COLLECTIONS = {
  variable: "n_var_expenses",
  "multi-branch": MULTI_BRANCH_EXPENSES_COLLECTION,
} as const;

function collectionForSource(raw: string): string {
  const hit = SOURCE_COLLECTIONS[raw as keyof typeof SOURCE_COLLECTIONS];
  if (!hit) throw new Error("מקור לא תקין");
  return hit;
}

/** משייך רכישה קיימת לסוג — זו הדרך לתפוס למפרע את כל מה שנקנה לפני שהסוג נולד. */
export async function tagPurchaseAction(typeId: string, formData: FormData) {
  await requireOwner();
  const id = String(formData.get("purchaseId") ?? "").trim();
  const collection = collectionForSource(String(formData.get("source") ?? ""));
  if (!id) throw new Error("רכישה לא תקינה");

  const db = getAdminFirestore();
  const typeDoc = await db.collection(EXPENSE_TYPES_COLLECTION).doc(typeId).get();
  if (!typeDoc.exists) throw new Error("סוג הרכישה לא נמצא");

  await db.collection(collection).doc(id).set({ expenseTypeId: typeId }, { merge: true });
  revalidateAll();
}

export async function untagPurchaseAction(formData: FormData) {
  await requireOwner();
  const id = String(formData.get("purchaseId") ?? "").trim();
  const collection = collectionForSource(String(formData.get("source") ?? ""));
  if (!id) throw new Error("רכישה לא תקינה");

  await getAdminFirestore()
    .collection(collection)
    .doc(id)
    .set({ expenseTypeId: FieldValue.delete() }, { merge: true });
  revalidateAll();
}
