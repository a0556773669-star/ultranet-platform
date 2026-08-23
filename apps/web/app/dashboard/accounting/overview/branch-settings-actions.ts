"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { BRANCH_COST_SETTINGS_COLLECTION, branchCostSettingId } from "@/lib/cost-rates";
import type { BranchCostSetting } from "@ultranet/shared-types";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
}

function optionalNumber(raw: FormDataEntryValue | null): number | undefined {
  const text = String(raw ?? "").trim();
  if (!text) return undefined;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Upserts one branch's override of one price-list line. Written with a full `set` (no merge) on
 * a deterministic id, so clearing a field in the form really clears the override and the value
 * falls back to the price list rather than silently keeping the old number.
 */
export async function saveBranchCostSettingAction(branchId: string, rateKey: string, formData: FormData) {
  await requireOwner();
  if (!branchId || !rateKey) throw new Error("סניף וקטגוריה הם שדות חובה");

  const owedByRaw = String(formData.get("owedBy") ?? "").trim();
  const paidByRaw = String(formData.get("paidBy") ?? "").trim();

  const data: Omit<BranchCostSetting, "id"> = {
    branchId,
    rateKey,
    ...(optionalNumber(formData.get("qty")) != null ? { qty: optionalNumber(formData.get("qty"))! } : {}),
    ...(optionalNumber(formData.get("unitCost")) != null
      ? { unitCost: optionalNumber(formData.get("unitCost"))! }
      : {}),
    ...(owedByRaw ? { owedBy: owedByRaw as BranchCostSetting["owedBy"] } : {}),
    ...(paidByRaw ? { paidBy: paidByRaw as BranchCostSetting["paidBy"] } : {}),
    enabled: formData.get("enabled") === "on",
  };

  await getAdminFirestore()
    .collection(BRANCH_COST_SETTINGS_COLLECTION)
    .doc(branchCostSettingId(branchId, rateKey))
    .set(data);

  revalidatePath(`/dashboard/accounting/overview/${branchId}`);
  revalidatePath("/dashboard/accounting/overview");
}
