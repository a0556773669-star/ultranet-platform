"use server";

/**
 * פעולות למודול "הוצאות קבועות משתנות".
 *
 * הפעולות יושבות כאן ולא ליד מסך מסוים כי המודול עצמו לא שייך למסך אחד: אותה שורה של
 * "חשמל" יכולה לחיות בחדר מחשבים, במשרד השיתופי או בהנה"ח הראשית, וכל שכפול של הפעולות
 * היה מזמין את שלוש העותקים להיפרד.
 */
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type {
  ExpenseScope,
  RecurringFrequency,
  RecurringFrequencyChange,
  RecurringVariableExpense,
} from "@ultranet/shared-types";
import { countsToMainFromForm } from "@/lib/counts-to-main";
import {
  RECURRING_VAR_EXPENSES_COLLECTION,
  currentMonth,
  dueMonths,
  upsertAmount,
} from "@/lib/recurring-expenses";

/** טוען את ההוצאה ומוודא הרשאה - הפתיחה של כל פעולה כאן. */
async function loadForEdit(id: string) {
  const db = getAdminFirestore();
  const ref = db.collection(RECURRING_VAR_EXPENSES_COLLECTION).doc(id);
  const doc = await ref.get();
  const existing = doc.data() as Omit<RecurringVariableExpense, "id"> | undefined;
  if (!existing) throw new Error("ההוצאה לא נמצאה");
  await requireAccess(existing.branchId);
  return { ref, existing };
}

const FREQUENCIES: RecurringFrequency[] = ["monthly", "bimonthly", "quarterly", "yearly"];

/** תדירות לא מוכרת (טופס ישן, בקשה מזויפת) נופלת לחודשי - ההתנהגות שהייתה לפני השדה. */
function frequencyFromForm(formData: FormData): RecurringFrequency {
  const raw = String(formData.get("frequency") ?? "").trim() as RecurringFrequency;
  return FREQUENCIES.includes(raw) ? raw : "monthly";
}

/**
 * הפריסה נשלחת תמיד מפורשות ("true"/"false") ולא כצ'קבוקס, כי `undefined` כאן כבר תפוס:
 * הוא אומר "פרוס" ברשומות שנוצרו לפני השדה. צ'קבוקס שלא סומן לא היה מבדיל בין
 * "אל תפרוס" לבין "טופס ישן שלא מכיר את השדה".
 */
function spreadFromForm(formData: FormData): boolean {
  return String(formData.get("spread") ?? "true") !== "false";
}

async function requireAccess(branchId?: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  if (session.user?.role === "owner") return session;
  if (branchId && session.user?.branchId === branchId) return session;
  throw new Error("אין הרשאה");
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as T;
}

function revalidateAll(scope: ExpenseScope, branchId?: string) {
  // דף הבית מציג את תזכורת התשלום החודשית, ולכן הוא חייב להתרענן אחרי כל עדכון חודש -
  // אחרת מי שמעדכן את החשמל ממסך הסניף ממשיך לראות בבית "חסר עדכון" על מה שהרגע עדכן.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/accounting");
  if (scope === "computers") {
    revalidatePath("/dashboard/expenses");
    if (branchId) revalidatePath(`/dashboard/expenses/${branchId}`);
  }
  if (scope === "rentals") {
    revalidatePath("/dashboard/rentals/expenses");
    if (branchId) revalidatePath(`/dashboard/rentals/expenses/${branchId}`);
  }
  if (scope === "coworking") {
    revalidatePath("/dashboard/coworking/accounting");
  }
}

export async function createRecurringVariableExpenseAction(
  scope: ExpenseScope,
  branchId: string | undefined,
  formData: FormData,
) {
  await requireAccess(branchId);
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  if (!name || !startDate) throw new Error("חובה למלא שם ותאריך התחלה");

  const data: Omit<RecurringVariableExpense, "id"> = stripUndefined({
    scope,
    branchId: branchId || undefined,
    name,
    category: String(formData.get("category") ?? "").trim() || undefined,
    startDate,
    frequency: frequencyFromForm(formData),
    spread: spreadFromForm(formData),
    defaultAmount: formData.get("defaultAmount") ? Number(formData.get("defaultAmount")) : undefined,
    countsToMain: countsToMainFromForm(formData),
    paidBy: String(formData.get("paidBy") ?? "").trim() || undefined,
    owedBy: String(formData.get("owedBy") ?? "").trim() || undefined,
    amounts: [],
  });
  await getAdminFirestore().collection(RECURRING_VAR_EXPENSES_COLLECTION).add(data);
  revalidateAll(scope, branchId);
}

export async function updateRecurringVariableExpenseAction(id: string, formData: FormData) {
  const db = getAdminFirestore();
  const ref = db.collection(RECURRING_VAR_EXPENSES_COLLECTION).doc(id);
  const doc = await ref.get();
  const existing = doc.data() as Omit<RecurringVariableExpense, "id"> | undefined;
  if (!existing) throw new Error("ההוצאה לא נמצאה");
  await requireAccess(existing.branchId);

  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  if (!name || !startDate) throw new Error("חובה למלא שם ותאריך התחלה");
  const category = String(formData.get("category") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();

  await ref.set(
    {
      name,
      startDate,
      frequency: frequencyFromForm(formData),
      spread: spreadFromForm(formData),
      category: category || FieldValue.delete(),
      endDate: endDate || FieldValue.delete(),
      defaultAmount: formData.get("defaultAmount") ? Number(formData.get("defaultAmount")) : FieldValue.delete(),
      countsToMain: countsToMainFromForm(formData),
    },
    { merge: true },
  );
  revalidateAll(existing.scope, existing.branchId);
}

/**
 * מעדכן את הסכום של חודש אחד. זו הפעולה שהמודול קיים בשבילה: לא "הוספת הוצאה" אלא
 * "החשמל של אוגוסט היה 412 ₪". החודש הוא המפתח, ולכן כתיבה חוזרת לאותו חודש מחליפה
 * ולא מכפילה (`upsertAmount`).
 */
export async function setRecurringMonthAmountAction(id: string, formData: FormData) {
  const db = getAdminFirestore();
  const ref = db.collection(RECURRING_VAR_EXPENSES_COLLECTION).doc(id);
  const doc = await ref.get();
  const existing = doc.data() as Omit<RecurringVariableExpense, "id"> | undefined;
  if (!existing) throw new Error("ההוצאה לא נמצאה");
  await requireAccess(existing.branchId);

  const month = String(formData.get("month") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("חודש לא תקין");
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount)) throw new Error("סכום לא תקין");
  const note = String(formData.get("note") ?? "").trim();

  const amounts = upsertAmount(existing.amounts, {
    month,
    amount,
    updatedAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  });
  await ref.set({ amounts }, { merge: true });
  revalidateAll(existing.scope, existing.branchId);
}

/**
 * מילוי היסטוריה: אותו סכום לטווח חודשים בבת אחת.
 *
 * הוצאה שקיימת שנה ונרשמה במערכת רק עכשיו מגיעה עם שנים-עשר חודשים ריקים, והקלדה של
 * שנים-עשר טפסים נפרדים היא בדיוק הסיבה שאף אחד לא משלים היסטוריה. `overwrite` כבוי
 * כברירת מחדל: מילוי גורף ממלא רק חודשים ריקים ולא דורס חודש שכבר הוקלד נכון ביד.
 */
export async function fillRecurringHistoryAction(id: string, formData: FormData) {
  const db = getAdminFirestore();
  const ref = db.collection(RECURRING_VAR_EXPENSES_COLLECTION).doc(id);
  const doc = await ref.get();
  const existing = doc.data() as Omit<RecurringVariableExpense, "id"> | undefined;
  if (!existing) throw new Error("ההוצאה לא נמצאה");
  await requireAccess(existing.branchId);

  const from = String(formData.get("from") ?? "").trim();
  const to = String(formData.get("to") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) throw new Error("חודש לא תקין");
  if (from > to) throw new Error("חודש ההתחלה מאוחר מחודש הסיום");
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount)) throw new Error("סכום לא תקין");
  const overwrite = String(formData.get("overwrite") ?? "") === "on";

  // רק חודשים שבהם באמת מגיע תשלום: בהוצאה דו-חודשית מילוי של טווח שלם לא אמור להמציא
  // חיוב בחודשים שאין בהם חיוב. הטווח נחתך גם בחודש הנוכחי - "היסטוריה" היא מה שכבר היה,
  // והגבלת ה-`max` בטופס היא הצעה בדפדפן בלבד.
  const expense = { ...existing, id } as RecurringVariableExpense;
  const upto = currentMonth();
  const targets = dueMonths(expense, to < upto ? to : upto).filter((m) => m >= from);
  const have = new Set((existing.amounts ?? []).map((a) => a.month));
  const updatedAt = new Date().toISOString();

  let amounts = existing.amounts ?? [];
  for (const month of targets) {
    if (have.has(month) && !overwrite) continue;
    amounts = upsertAmount(amounts, { month, amount, updatedAt });
  }
  await ref.set({ amounts }, { merge: true });
  revalidateAll(existing.scope, existing.branchId);
}

/** מוחק סכום של חודש אחד ומחזיר אותו למצב "עוד לא עודכן" - הדרך לתקן הקלדה שגויה. */
export async function clearRecurringMonthAction(id: string, formData: FormData) {
  const db = getAdminFirestore();
  const ref = db.collection(RECURRING_VAR_EXPENSES_COLLECTION).doc(id);
  const doc = await ref.get();
  const existing = doc.data() as Omit<RecurringVariableExpense, "id"> | undefined;
  if (!existing) throw new Error("ההוצאה לא נמצאה");
  await requireAccess(existing.branchId);

  const month = String(formData.get("month") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("חודש לא תקין");
  const amounts = (existing.amounts ?? []).filter((a) => a.month !== month);
  await ref.set({ amounts }, { merge: true });
  revalidateAll(existing.scope, existing.branchId);
}

/**
 * הפסקת ההוצאה מתאריך מסוים - התשובה הנכונה ל"זה נגמר", במקום מחיקה.
 *
 * מחיקה מוציאה את ההוצאה מכל החודשים למפרע וההיסטוריה שנרשמה נעלמת מהדוחות; הפסקה
 * משאירה את כל מה שכבר שולם ורק מפסיקה לבקש עדכון מהחודש הזה והלאה.
 */
export async function endRecurringVariableExpenseAction(id: string, formData: FormData) {
  const { ref, existing } = await loadForEdit(id);
  const endDate = String(formData.get("endDate") ?? "").trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new Error("תאריך לא תקין");
  await ref.set({ endDate }, { merge: true });
  revalidateAll(existing.scope, existing.branchId);
}

/** ביטול ההפסקה: ההוצאה חוזרת לבקש עדכון מהחודש הנוכחי. */
export async function resumeRecurringVariableExpenseAction(id: string) {
  const { ref, existing } = await loadForEdit(id);
  await ref.set({ endDate: FieldValue.delete() }, { merge: true });
  revalidateAll(existing.scope, existing.branchId);
}

/**
 * שינוי תדירות מחודש מסוים והלאה - חשמל שהיה דו-חודשי והפך לחודשי.
 *
 * זו הסיבה שלא פותחים שורה שנייה: השורה השנייה שוברת את הסיכום של "חשמל" לשניים.
 * כתיבה חוזרת לאותו חודש מחליפה (upsert לפי `from`), כך שתיקון של שינוי שהוזן לא נכון
 * הוא פשוט הזנה מחדש של אותו חודש.
 */
export async function setRecurringFrequencyChangeAction(id: string, formData: FormData) {
  const { ref, existing } = await loadForEdit(id);
  const from = String(formData.get("from") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(from)) throw new Error("חודש לא תקין");
  if (from < existing.startDate.slice(0, 7)) throw new Error("השינוי מוקדם מתאריך ההתחלה של ההוצאה");
  const frequency = frequencyFromForm(formData);
  const changes: RecurringFrequencyChange[] = [
    ...(existing.frequencyChanges ?? []).filter((c) => c.from !== from),
    { from, frequency },
  ].sort((a, b) => a.from.localeCompare(b.from));
  await ref.set({ frequencyChanges: changes }, { merge: true });
  revalidateAll(existing.scope, existing.branchId);
}

/** ביטול שינוי תדירות: התקופה הזו חוזרת להתמזג עם זו שלפניה. */
export async function removeRecurringFrequencyChangeAction(id: string, from: string) {
  const { ref, existing } = await loadForEdit(id);
  const changes = (existing.frequencyChanges ?? []).filter((c) => c.from !== from);
  await ref.set(
    { frequencyChanges: changes.length > 0 ? changes : FieldValue.delete() },
    { merge: true },
  );
  revalidateAll(existing.scope, existing.branchId);
}

export async function deleteRecurringVariableExpenseAction(id: string) {
  const db = getAdminFirestore();
  const ref = db.collection(RECURRING_VAR_EXPENSES_COLLECTION).doc(id);
  const doc = await ref.get();
  const existing = doc.data() as Omit<RecurringVariableExpense, "id"> | undefined;
  if (!existing) return;
  await requireAccess(existing.branchId);
  await ref.delete();
  revalidateAll(existing.scope, existing.branchId);
}
