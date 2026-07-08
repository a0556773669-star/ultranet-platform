"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModuleAccess, requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";

export type LabelSettings = {
  computerWidthMm: number;
  computerHeightMm: number;
  stickWidthMm: number;
  stickHeightMm: number;
  computerFontSizePt: number;
  stickFontSizePt: number;
  infoFontSizePt: number;
  fontFamily: string;
  textColor: string;
  wifiName: string;
  wifiCode: string;
  logoUrl?: string;
};

const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  computerWidthMm: 60,
  computerHeightMm: 40,
  stickWidthMm: 40,
  stickHeightMm: 25,
  computerFontSizePt: 16,
  stickFontSizePt: 14,
  infoFontSizePt: 8,
  fontFamily: "var(--font-heebo), Heebo, sans-serif",
  textColor: "#111111",
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
  const db = getAdminFirestore();
  const ref = db.collection("n_label_settings").doc("default");
  const existingDoc = await ref.get();
  const existing: LabelSettings = {
    ...DEFAULT_LABEL_SETTINGS,
    ...(existingDoc.exists ? (existingDoc.data() as Partial<LabelSettings>) : {}),
  };

  const num = (name: string, fallback: number) => {
    const v = Number(formData.get(name));
    return v > 0 ? v : fallback;
  };

  const logoDataUrl = String(formData.get("logoDataUrl") ?? "");
  const removeLogo = String(formData.get("removeLogo") ?? "") === "1";

  const settings: LabelSettings = {
    computerWidthMm: num("computerWidthMm", existing.computerWidthMm),
    computerHeightMm: num("computerHeightMm", existing.computerHeightMm),
    stickWidthMm: num("stickWidthMm", existing.stickWidthMm),
    stickHeightMm: num("stickHeightMm", existing.stickHeightMm),
    computerFontSizePt: num("computerFontSizePt", existing.computerFontSizePt),
    stickFontSizePt: num("stickFontSizePt", existing.stickFontSizePt),
    infoFontSizePt: num("infoFontSizePt", existing.infoFontSizePt),
    fontFamily: String(formData.get("fontFamily") ?? "") || existing.fontFamily,
    textColor: String(formData.get("textColor") ?? "") || existing.textColor,
    wifiName: String(formData.get("wifiName") ?? "") || existing.wifiName,
    wifiCode: String(formData.get("wifiCode") ?? "") || existing.wifiCode,
  };

  if (!removeLogo) {
    const finalLogo = logoDataUrl || existing.logoUrl;
    if (finalLogo) settings.logoUrl = finalLogo;
  }

  await ref.set(settings);
  revalidatePath("/dashboard/rentals/labels");
  revalidatePath("/dashboard/rentals/labels/settings");
  redirect("/dashboard/rentals/labels");
}
