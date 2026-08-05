"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireModuleAccess } from "@/lib/perms";
import type { ShopComputerConfig, ShopTier, ShopUseCase } from "@ultranet/shared-types";

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function parseForm(formData: FormData): Omit<ShopComputerConfig, "id"> {
  const name = String(formData.get("name") ?? "").trim();
  const tier = String(formData.get("tier") ?? "recommended") as ShopTier;
  const useCases = formData
    .getAll("useCases")
    .map((v) => String(v))
    .filter(Boolean) as ShopUseCase[];
  const minLoadLevel = Math.min(5, Math.max(1, Number(formData.get("minLoadLevel")) || 1));
  const cpu = String(formData.get("cpu") ?? "").trim();
  const ram = String(formData.get("ram") ?? "").trim();
  const storage = String(formData.get("storage") ?? "").trim();
  const gpu = String(formData.get("gpu") ?? "").trim() || undefined;
  const extras = String(formData.get("extras") ?? "").trim() || undefined;
  const priceRaw = String(formData.get("priceILS") ?? "").trim();
  const priceILS = priceRaw ? Number(priceRaw) : undefined;
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const active = formData.get("active") === "on";
  return { name, tier, useCases, minLoadLevel, cpu, ram, storage, gpu, extras, priceILS, notes, active };
}

export async function createCatalogItemAction(formData: FormData) {
  await requireModuleAccess("shop");
  const data = parseForm(formData);
  if (!data.name || !data.cpu || !data.ram || !data.storage || !data.useCases.length) {
    redirect("/dashboard/shop/catalog/new?error=missing");
  }
  const db = getAdminFirestore();
  await db.collection("n_shop_catalog").add(stripUndefined(data));
  revalidatePath("/dashboard/shop/catalog");
  redirect("/dashboard/shop/catalog");
}

export async function updateCatalogItemAction(id: string, formData: FormData) {
  await requireModuleAccess("shop");
  const data = parseForm(formData);
  if (!data.name || !data.cpu || !data.ram || !data.storage || !data.useCases.length) {
    redirect(`/dashboard/shop/catalog/${id}?error=missing`);
  }
  const db = getAdminFirestore();
  await db.collection("n_shop_catalog").doc(id).set(stripUndefined(data), { merge: true });
  revalidatePath("/dashboard/shop/catalog");
  redirect("/dashboard/shop/catalog");
}

export async function deleteCatalogItemAction(id: string) {
  await requireModuleAccess("shop");
  await getAdminFirestore().collection("n_shop_catalog").doc(id).delete();
  revalidatePath("/dashboard/shop/catalog");
  redirect("/dashboard/shop/catalog");
}
