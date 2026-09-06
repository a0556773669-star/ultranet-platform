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
import type { ExpenseScope, RecurringVariableExpense } from "@ultranet/shared-types";
import { countsToMainFromForm } from "@/lib/counts-to-main";
import { RECURRING_VAR_EXPENSES_COLLECTION, upsertAmount } from "@/lib/recurring-expenses";

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
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/accounting/extra-expenses");
  if (scope === "computers") {
    revalidatePath("/dashboard/expenses");
    if (branchId) revalidatePath(`/dashboard/expenses/${branchId}`);
  }
  if (scope === "rentals") {
    revalidatePath("/dashboard/rentals/expenses");
    if (branchId) revalidatePath(`/dashboard/rentals/expenses/${branchId}`);
  }
  if (scope === "coworking") {
    revalidatePath("/dashboard/coworking/expenses");
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
