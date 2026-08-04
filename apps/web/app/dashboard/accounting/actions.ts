"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  const db = getAdminFirestore();
  const type = String(formData.get("type") ?? "cash") as AccountingIncome["type"];
  const date = String(formData.get("date") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!date || !amount) {
    throw new Error("תאריך וסכום הם שדות חובה");
  }

  let business: AccountingIncome["business"] = "general";
  let branchId: string | undefined;
  let desc = String(formData.get("desc") ?? "").trim();

  if (type === "laptops") {
    branchId = String(formData.get("branchId") ?? "").trim();
    if (!branchId) {
      throw new Error("נא לבחור סניף ניידים");
    }
    business = "rentals";
    if (!desc) {
      const branchDoc = await db.collection("n_branches").doc(branchId).get();
      desc = (branchDoc.data() as { name?: string } | undefined)?.name ?? "הכנסת ניידים";
    }
  } else if (type === "cash") {
    branchId = String(formData.get("branchId") ?? "").trim();
    if (!branchId) {
      throw new Error("נא לבחור קופה (סניף חדר מחשבים)");
    }
    business = "computers";
    if (!desc) {
      const branchDoc = await db.collection("n_branches").doc(branchId).get();
      const branchName = (branchDoc.data() as { name?: string } | undefined)?.name ?? "";
      desc = `מזומן מקופה${branchName ? ` — ${branchName}` : ""}`;
    }
  } else if (type === "credit") {
    business = "general";
    if (!desc) desc = "הכנסות אשראי מהעסק";
  } else {
    // legacy "fixed"/"variable" types - only reachable from old data, no longer created by the UI
    business = String(formData.get("business") ?? "general") as AccountingIncome["business"];
  }

  const data: Omit<AccountingIncome, "id"> = stripUndefined({
    date,
    amount,
    desc,
    business,
    type,
    month: date.slice(0, 7),
    branchId,
  });
  await db.collection("n_ah_income").add(data);
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/rentals/accounting");
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
  revalidatePath("/dashboard/rentals/accounting");
}

export async function deleteIncomeAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_ah_income").doc(id).delete();
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/rentals/accounting");
}

export async function deleteExpenseAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_ah_expenses").doc(id).delete();
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/rentals/accounting");
}

export async function updateExpenseAction(id: string, formData: FormData) {
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
  await getAdminFirestore().collection("n_ah_expenses").doc(id).set(data, { merge: true });
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/rentals/accounting");
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
    receiptsProvider: (String(formData.get("receiptsProvider") ?? "none").trim() ||
      "none") as CollectionRoute["receiptsProvider"],
    receiptsCompanyId: String(formData.get("receiptsCompanyId") ?? "").trim() || undefined,
    receiptsApiKey: String(formData.get("receiptsApiKey") ?? "").trim() || undefined,
    receiptsApiSecret: String(formData.get("receiptsApiSecret") ?? "").trim() || undefined,
    defaultForNewCards: formData.get("defaultForNewCards") === "on",
  };
  await getAdminFirestore().collection("n_collection_routes").add(stripUndefined(data));
  revalidatePath("/dashboard/accounting/routes");
}

export async function updateCollectionRouteAction(id: string, formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("שם המסלול הוא שדה חובה");
  }

  const db = getAdminFirestore();
  const existingDoc = await db.collection("n_collection_routes").doc(id).get();
  const existing = existingDoc.data() as Omit<CollectionRoute, "id"> | undefined;
  if (!existing) {
    throw new Error("מסלול לא נמצא");
  }

  // secret fields: only overwrite if the admin typed a new value, otherwise keep what's stored
  // (the form leaves these blank on load instead of re-displaying the stored secret)
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const apiSecret = String(formData.get("apiSecret") ?? "").trim();
  const receiptsApiKey = String(formData.get("receiptsApiKey") ?? "").trim();
  const receiptsApiSecret = String(formData.get("receiptsApiSecret") ?? "").trim();

  const data: Omit<CollectionRoute, "id"> = {
    terminalId: String(formData.get("terminalId") ?? "").trim(),
    status: existing.status,
    name,
    branchScope: String(formData.get("branchScope") ?? "").trim() || null,
    provider: String(formData.get("provider") ?? "manual") as CollectionRoute["provider"],
    currency: String(formData.get("currency") ?? "ILS").trim() || undefined,
    feePct: formData.get("feePct") ? Number(formData.get("feePct")) : undefined,
    feeFixed: formData.get("feeFixed") ? Number(formData.get("feeFixed")) : undefined,
    depositsTo: String(formData.get("depositsTo") ?? "owner") as CollectionRoute["depositsTo"],
    apiKey: apiKey || existing.apiKey,
    apiSecret: apiSecret || existing.apiSecret,
    receiptsProvider: (String(formData.get("receiptsProvider") ?? "none").trim() ||
      "none") as CollectionRoute["receiptsProvider"],
    receiptsCompanyId: String(formData.get("receiptsCompanyId") ?? "").trim() || undefined,
    receiptsApiKey: receiptsApiKey || existing.receiptsApiKey,
    receiptsApiSecret: receiptsApiSecret || existing.receiptsApiSecret,
    defaultForNewCards: formData.get("defaultForNewCards") === "on",
  };
  await db.collection("n_collection_routes").doc(id).set(stripUndefined(data), { merge: false });
  revalidatePath("/dashboard/accounting/routes");
  redirect("/dashboard/accounting/routes");
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
