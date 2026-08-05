"use server";

import { revalidatePath } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireModuleAccess } from "@/lib/perms";
import type { ShopLeadStatus } from "@ultranet/shared-types";

export async function updateLeadStatusAction(id: string, status: ShopLeadStatus) {
  await requireModuleAccess("shop");
  await getAdminFirestore().collection("n_shop_leads").doc(id).set({ status }, { merge: true });
  revalidatePath("/dashboard/shop");
}

export async function deleteLeadAction(id: string) {
  await requireModuleAccess("shop");
  await getAdminFirestore().collection("n_shop_leads").doc(id).delete();
  revalidatePath("/dashboard/shop");
}
