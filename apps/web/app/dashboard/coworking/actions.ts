"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CoworkingStation, CoworkingClient } from "@ultranet/shared-types";

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
    startDate,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    customPrice: formData.get("customPrice") ? Number(formData.get("customPrice")) : undefined,
    payDay: formData.get("payDay") ? Number(formData.get("payDay")) : undefined,
    payments: [],
  };
  await getAdminFirestore().collection("n_cw_clients").add(stripUndefined(data));
  revalidatePath("/dashboard/coworking");
  redirect("/dashboard/coworking");
}

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
  const payments = client?.payments ?? [];
  payments.push({
    month,
    amount,
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: String(formData.get("paymentMethod") ?? "").trim() || undefined,
  });
  await ref.set({ payments }, { merge: true });
  revalidatePath("/dashboard/coworking");
}
