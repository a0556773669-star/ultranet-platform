"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireModuleAccess } from "@/lib/perms";
import type { ShopAddon, ShopAddonType } from "@ultranet/shared-types";

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function parseForm(formData: FormData): Omit<ShopAddon, "id"> {
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "other") as ShopAddonType;
  const priceRaw = String(formData.get("priceILS") ?? "").trim();
  const priceILS = priceRaw ? Number(priceRaw) : undefined;
  const active = formData.get("active") === "on";
  return { name, type, priceILS, active };
}

export async function createAddonAction(formData: FormData) {
  await requireModuleAccess("shop");
  const data = parseForm(formData);
  if (!data.name) {
    redirect("/dashboard/shop/addons/new?error=missing");
  }
  const db = getAdminFirestore();
  await db.collection("n_shop_addons").add(stripUndefined(data));
  revalidatePath("/dashboard/shop/addons");
  redirect("/dashboard/shop/addons");
}

export async function updateAddonAction(id: string, formData: FormData) {
  await requireModuleAccess("shop");
  const data = parseForm(formData);
  if (!data.name) {
    redirect(`/dashboard/shop/addons/${id}?error=missing`);
  }
  const db = getAdminFirestore();
  await db.collection("n_shop_addons").doc(id).set(stripUndefined(data), { merge: true });
  revalidatePath("/dashboard/shop/addons");
  redirect("/dashboard/shop/addons");
}

export async function deleteAddonAction(id: string) {
  await requireModuleAccess("shop");
  await getAdminFirestore().collection("n_shop_addons").doc(id).delete();
  revalidatePath("/dashboard/shop/addons");
  redirect("/dashboard/shop/addons");
}
