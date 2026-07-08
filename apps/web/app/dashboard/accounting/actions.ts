"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { chargeViaRoute } from "@/lib/collection-charge";
import type {
  AccountingIncome,
  AccountingExpense,
  CollectionRoute,
} from "@ultranet/shared-types";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
  return session;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== "") {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export async function createIncomeAction(formData: FormData) {
  await requireOwner();
  const date = String(formData.get("date") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!date || !amount) {
    throw new Error("תאריך וסכום הם שדות חובה");
  }
  const data: Omit<AccountingIncome, "id"> = {
    date,
    amount,
    desc: String(formData.get("desc") ?? "").trim(),
    business: String(formData.get("business") ?? "general") as AccountingIncome["business"],
    type: String(formData.get("type") ?? "fixed") as AccountingIncome["type"],
    month: date.slice(0, 7),
  };
  await getAdminFirestore().collection("n_ah_income").add(data);
  revalidatePath("/dashboard/accounting");
}

export async function createExpenseAction(formData: FormData) {
  await requireOwner();
  const date = String(formData.get("date") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!date || !amount) {
    throw new Error("תאריך וסכום הם שדות חובה");
  }
  const data: Omit<AccountingExpense, "id"> = {
    date,
    amount,
    desc: String(formData.get("desc") ?? "").trim(),
    business: String(formData.get("business") ?? "general") as AccountingExpense["business"],
    month: date.slice(0, 7),
  };
  await getAdminFirestore().collection("n_ah_expenses").add(data);
  revalidatePath("/dashboard/accounting");
}

export async function deleteIncomeAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_ah_income").doc(id).delete();
  revalidatePath("/dashboard/accounting");
}

export async function deleteExpenseAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_ah_expenses").doc(id).delete();
  revalidatePath("/dashboard/accounting");
}

export async function createCollectionRouteAction(formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("שם המסלול הוא שדה חובה");
  }
  const data: Omit<CollectionRoute, "id"> = {
    terminalId: String(formData.get("terminalId") ?? "").trim(),
    status: "not_connected" as CollectionRoute["status"],
    name,
    branchScope: String(formData.get("branchScope") ?? "").trim() || null,
    provider: String(formData.get("provider") ?? "manual") as CollectionRoute["provider"],
    currency: String(formData.get("currency") ?? "ILS").trim() || undefined,
    feePct: formData.get("feePct") ? Number(formData.get("feePct")) : undefined,
    feeFixed: formData.get("feeFixed") ? Number(formData.get("feeFixed")) : undefined,
    depositsTo: String(formData.get("depositsTo") ?? "owner") as CollectionRoute["depositsTo"],
    apiKey: String(formData.get("apiKey") ?? "").trim() || undefined,
    apiSecret: String(formData.get("apiSecret") ?? "").trim() || undefined,
    receiptsProvider: "none",
  };
  await getAdminFirestore().collection("n_collection_routes").add(stripUndefined(data));
  revalidatePath("/dashboard/accounting/routes");
}

export async function deleteCollectionRouteAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_collection_routes").doc(id).delete();
  revalidatePath("/dashboard/accounting/routes");
}

export async function manualChargeAction(formData: FormData) {
  await requireOwner();
  const routeId = String(formData.get("routeId") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const desc = String(formData.get("desc") ?? "").trim() || "גביה ידנית";
  const business = String(formData.get("business") ?? "general") as AccountingIncome["business"];
  const date = String(formData.get("date") ?? "").trim() || new Date().toISOString().slice(0, 10);
  if (!routeId || !amount) {
    throw new Error("נא לבחור מסלול גביה ולהזין סכום");
  }
  const result = await chargeViaRoute({ routeId, amount, desc, business, date });
  if (!result.ok) {
    throw new Error(result.message);
  }
  revalidatePath("/dashboard/accounting");
}
