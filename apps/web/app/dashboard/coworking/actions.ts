"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CoworkingStation, CoworkingClient, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { countsToMainFromForm } from "@/lib/counts-to-main";
import { SETUP_CATEGORY } from "@/lib/coworking";

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
  revalidatePath("/dashboard/coworking/expenses");
  revalidatePath("/dashboard/coworking/accounting");
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard");
}

export async function createStationAction(formData: FormData) {
  await requireSession();
  const branchId = String(formData.get("branchId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!branchId || !name) {
    throw new Error("סניף ושם עמדה הם שדות חובה");
  }
  const data: Omit<CoworkingStation, "id"> = {
    branchId,
    name,
    price: Number(formData.get("price") ?? 0),
  };
  await getAdminFirestore().collection("n_cw_stations").add(stripUndefined(data));
  revalidatePath("/dashboard/coworking/stations");
}

export async function createCoworkingClientAction(formData: FormData) {
  await requireSession();
  const branchId = String(formData.get("branchId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const stationId = String(formData.get("stationId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  if (!branchId || !name || !stationId || !startDate) {
    throw new Error("יש למלא את כל השדות");
  }
  const data: Omit<CoworkingClient, "id"> = {
    branchId,
    name,
    stationId,
    stationNumber: String(formData.get("stationNumber") ?? "").trim() || undefined,
    startDate,
    endDate: String(formData.get("endDate") ?? "").trim() || undefined,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    customPrice: formData.get("customPrice") ? Number(formData.get("customPrice")) : undefined,
    payDay: formData.get("payDay") ? Number(formData.get("payDay")) : undefined,
    payments: [],
  };
  await getAdminFirestore().collection("n_cw_clients").add(stripUndefined(data));
  revalidatePath("/dashboard/coworking");
  redirect("/dashboard/coworking");
}

/**
 * רישום תשלום חודשי.
 *
 * התשלום מוחלף ולא נוסף כשכבר קיים תשלום לאותו חודש: "שילם" הוא מצב של חודש, לא אירוע
 * שיכול לקרות פעמיים - וכפילות כאן הייתה מכפילה גם את ההכנסה בספר הראשי.
 */
export async function addPaymentAction(clientId: string, formData: FormData) {
  await requireSession();
  const amount = Number(formData.get("amount") ?? 0);
  const month = String(formData.get("month") ?? "");
  if (!amount || !month) {
    throw new Error("סכום וחודש הם שדות חובה");
  }
  const db = getAdminFirestore();
  const ref = db.collection("n_cw_clients").doc(clientId);
  const doc = await ref.get();
  const client = doc.data() as CoworkingClient | undefined;
  const payments = (client?.payments ?? []).filter((p) => p.month !== month);
  payments.push(
    stripUndefined({
      month,
      amount,
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: String(formData.get("paymentMethod") ?? "").trim() || undefined,
      countsToMain: countsToMainFromForm(formData),
    }),
  );
  payments.sort((a, b) => a.month.localeCompare(b.month));
  await ref.set({ payments }, { merge: true });
  revalidateCoworking();
}

export async function endCoworkingClientAction(clientId: string, formData: FormData) {
  await requireSession();
  const endDate = String(formData.get("endDate") ?? "").trim() || new Date().toISOString().slice(0, 10);
  await getAdminFirestore().collection("n_cw_clients").doc(clientId).set({ endDate }, { merge: true });
  revalidateCoworking();
}

export async function reopenCoworkingClientAction(clientId: string) {
  await requireSession();
  await getAdminFirestore()
    .collection("n_cw_clients")
    .doc(clientId)
    .set({ endDate: FieldValue.delete() }, { merge: true });
  revalidateCoworking();
}

/* ── הוצאות המשרד השיתופי ─────────────────────────────────────────────────────
 * שלושת הסוגים (הקמה / קבועות / שוטפות) יושבים באותם קולקשנים כמו בכל מודול אחר,
 * כי הם אותו דבר: `n_fixed_expenses` לקבועות, `n_var_expenses` לשתי האחרות, כשההקמה
 * מסומנת בקטגוריה `SETUP_CATEGORY`. קולקשן רביעי היה מחייב כל חישוב בעסק לדעת עליו.
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

export async function createCoworkingVariableExpenseAction(
  branchId: string,
  kind: "setup" | "variable",
  formData: FormData,
) {
  await requireSession();
  const desc = String(formData.get("desc") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const amount = Number(formData.get("amount")) || 0;
  if (!desc || !date || !amount) throw new Error("חובה למלא תיאור, סכום ותאריך");
  const category =
    kind === "setup" ? SETUP_CATEGORY : String(formData.get("category") ?? "").trim() || undefined;
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
