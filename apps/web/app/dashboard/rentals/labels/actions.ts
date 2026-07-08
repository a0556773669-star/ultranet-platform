"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAccess, requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";

export type LabelSettings = {
  widthMm: number;
  heightMm: number;
  wifiName: string;
  wifiCode: string;
};

const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  widthMm: 60,
  heightMm: 40,
  wifiName: "ultranet",
  wifiCode: "1234567890",
};

export async function getLabelSettingsAction(): Promise<LabelSettings> {
  await requireModuleAccess("rentals");
  const doc = await getAdminFirestore().collection("n_label_settings").doc("default").get();
  if (!doc.exists) return DEFAULT_LABEL_SETTINGS;
  return { ...DEFAULT_LABEL_SETTINGS, ...(doc.data() as Partial<LabelSettings>) };
}

export async function updateLabelSettingsAction(formData: FormData) {
  await requireOwner();
  const widthMm = Number(formData.get("widthMm"));
  const heightMm = Number(formData.get("heightMm"));
  const wifiName = String(formData.get("wifiName") ?? "");
  const wifiCode = String(formData.get("wifiCode") ?? "");
  const settings: LabelSettings = {
    widthMm: widthMm > 0 ? widthMm : DEFAULT_LABEL_SETTINGS.widthMm,
    heightMm: heightMm > 0 ? heightMm : DEFAULT_LABEL_SETTINGS.heightMm,
    wifiName: wifiName || DEFAULT_LABEL_SETTINGS.wifiName,
    wifiCode: wifiCode || DEFAULT_LABEL_SETTINGS.wifiCode,
  };
  await getAdminFirestore().collection("n_label_settings").doc("default").set(settings);
  revalidatePath("/dashboard/rentals/labels");
  revalidatePath("/dashboard/rentals/labels/settings");
}
