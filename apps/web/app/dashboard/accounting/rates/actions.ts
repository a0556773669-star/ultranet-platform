"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { COST_RATES_COLLECTION, DEFAULT_COST_RATES } from "@/lib/cost-rates";
import type { CostRate } from "@ultranet/shared-types";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
}

function revalidate() {
  revalidatePath("/dashboard/accounting/rates");
  revalidatePath("/dashboard/accounting/overview");
}

/** Writes the default price list once, so the overview stops running on in-memory defaults. */
export async function seedDefaultRatesAction() {
  await requireOwner();
  const db = getAdminFirestore();
  const existing = await db.collection(COST_RATES_COLLECTION).limit(1).get();
  if (!existing.empty) return;
  const batch = db.batch();
  for (const rate of DEFAULT_COST_RATES) {
    batch.set(db.collection(COST_RATES_COLLECTION).doc(rate.key), rate);
  }
  await batch.commit();
  revalidate();
}

export async function saveRateAction(id: string, formData: FormData) {
  await requireOwner();
  const label = String(formData.get("label") ?? "").trim();
  const unitCost = Number(formData.get("unitCost") ?? 0);
  if (!label) throw new Error("שם הקטגוריה הוא שדה חובה");
  if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("עלות ליחידה חייבת להיות מספר חיובי");

  const data: Partial<CostRate> = {
    label,
    unitCost,
    kind: String(formData.get("kind") ?? "monthly") as CostRate["kind"],
    owedBy: String(formData.get("owedBy") ?? "owner") as CostRate["owedBy"],
    qtySource: String(formData.get("qtySource") ?? "one") as CostRate["qtySource"],
  };
  await getAdminFirestore().collection(COST_RATES_COLLECTION).doc(id).set(data, { merge: true });
  revalidate();
}
