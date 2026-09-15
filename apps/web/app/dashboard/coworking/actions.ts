"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { countsToMainFromForm } from "@/lib/counts-to-main";

/**
 * מה שנשאר כאן הוא ניהול ההוצאות של המשרד השיתופי, שמסך ההנה"ח מזין דרכו.
 *
 * פעולות הלקוחות והתשלומים שהיו כאן נמחקו יחד עם מסך "לקוחות ותשלומים": השכרת עמדה היא
 * מה שיוצר לקוח, ולכן `station-actions.ts` הוא הבעלים היחיד של המנויים והתשלומים.
 */

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("יש להתחבר");
  }
  return session;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

function revalidateCoworking() {
  revalidatePath("/dashboard/coworking");
  revalidatePath("/dashboard/coworking/stations");
  revalidatePath("/dashboard/coworking/accounting");
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard");
}

/* ── הוצאות המשרד השיתופי ─────────────────────────────────────────────────────
 * שני סוגים: קבועות (`n_fixed_expenses`) ושוטפות (`n_var_expenses`), באותם קולקשנים
 * כמו בכל מודול אחר - קולקשן נפרד היה מחייב כל חישוב בעסק לדעת עליו. מנוהלות ממסך
 * ההנה"ח של המודול; לשונית "הוצאות" הנפרדת בוטלה.
 *
 * **הקמה כבר לא נרשמת כאן**: היא שדה על הסניף (`Branch.setupCost` + `setupItems`),
 * בטופס הסניף. שורות ישנות בקטגוריית `SETUP_CATEGORY` נשארות בדאטה וממשיכות להיספר
 * ב-`buildCoworkingLedger` כ-`setupFromExpenses`, כדי ששום סכום קיים לא ייעלם.
 */

export async function createCoworkingFixedExpenseAction(branchId: string, formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  if (!name || !startDate) throw new Error("חובה למלא שם ותאריך התחלה");
  const data: Omit<FixedExpense, "id"> = stripUndefined({
    branchId,
    name,
    amount: Number(formData.get("amount")) || 0,
    startDate,
    category: String(formData.get("category") ?? "").trim() || undefined,
    paidBy: "owner",
    owedBy: "owner",
    countsToMain: countsToMainFromForm(formData),
  });
  await getAdminFirestore().collection("n_fixed_expenses").add(data);
  revalidateCoworking();
}

export async function createCoworkingVariableExpenseAction(branchId: string, formData: FormData) {
  await requireSession();
  const desc = String(formData.get("desc") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const amount = Number(formData.get("amount")) || 0;
  if (!desc || !date || !amount) throw new Error("חובה למלא תיאור, סכום ותאריך");
  const category = String(formData.get("category") ?? "").trim() || undefined;
  const data: Omit<VariableExpense, "id"> = stripUndefined({
    branchId,
    desc,
    amount,
    date,
    month: date.slice(0, 7),
    category,
    paidBy: "owner",
    owedBy: "owner",
    countsToMain: countsToMainFromForm(formData),
  });
  await getAdminFirestore().collection("n_var_expenses").add(data);
  revalidateCoworking();
}

export async function deleteCoworkingFixedExpenseAction(id: string) {
  await requireSession();
  await getAdminFirestore().collection("n_fixed_expenses").doc(id).delete();
  revalidateCoworking();
}

export async function deleteCoworkingVariableExpenseAction(id: string) {
  await requireSession();
  await getAdminFirestore().collection("n_var_expenses").doc(id).delete();
  revalidateCoworking();
}
