"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingIncome, AccountingExpense } from "@ultranet/shared-types";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
  return session;
}

function revalidate() {
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath("/dashboard/accounting");
}

/** Keeps the three classic n_ah_income types meaningful; anything else is a free-category entry. */
function incomeTypeFor(category: string): AccountingIncome["type"] {
  if (category === "אשראי מהעסק") return "credit";
  if (category === "מזומן") return "cash";
  if (category === "ניידים") return "laptops";
  return "other";
}

function businessFor(category: string): AccountingIncome["business"] {
  if (category === "ניידים") return "rentals";
  if (category === "חדרי מחשבים" || category === "מזומן") return "computers";
  if (category === "משרד שיתופי") return "coworking";
  return "general";
}

function readEntry(formData: FormData) {
  const date = String(formData.get("date") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const category = String(formData.get("category") ?? "").trim();
  const desc = String(formData.get("desc") ?? "").trim();
  if (!date || !amount || amount <= 0) {
    throw new Error("תאריך וסכום הם שדות חובה");
  }
  if (!category) {
    throw new Error("נא לבחור קטגוריה");
  }
  return { date, amount, category, desc, month: date.slice(0, 7) };
}

export async function addMyIncomeAction(formData: FormData) {
  await requireOwner();
  const { date, amount, category, desc, month } = readEntry(formData);
  const data: Omit<AccountingIncome, "id"> = {
    date,
    month,
    amount,
    category,
    desc: desc || category,
    business: businessFor(category),
    type: incomeTypeFor(category),
  };
  await getAdminFirestore().collection("n_ah_income").add(data);
  revalidate();
}

export async function addMyExpenseAction(formData: FormData) {
  await requireOwner();
  const { date, amount, category, desc, month } = readEntry(formData);
  const data: Omit<AccountingExpense, "id"> = {
    date,
    month,
    amount,
    category,
    desc: desc || category,
    business: "general",
  };
  await getAdminFirestore().collection("n_ah_expenses").add(data);
  revalidate();
}

export async function deleteMyIncomeAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_ah_income").doc(id).delete();
  revalidate();
}

export async function deleteMyExpenseAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_ah_expenses").doc(id).delete();
  revalidate();
}
