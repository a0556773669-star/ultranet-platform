"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { AD_AREAS_COLLECTION, DEFAULT_AD_OWNER_PCT } from "@/lib/ad-areas";
import type { AdArea } from "@ultranet/shared-types";

function revalidate() {
  revalidatePath("/dashboard/accounting/ads");
  revalidatePath("/dashboard/accounting/overview");
}

const MONTH_RE = /^\d{4}-\d{2}$/;

function readArea(formData: FormData): Omit<AdArea, "id"> {
  const name = String(formData.get("name") ?? "").trim();
  const monthlyCost = Math.round(Number(formData.get("monthlyCost") ?? 0));
  const ownerPctRaw = formData.get("ownerPct");
  const ownerPct = ownerPctRaw === null || ownerPctRaw === "" ? DEFAULT_AD_OWNER_PCT : Number(ownerPctRaw);
  const branchIds = formData.getAll("branchIds").map((v) => String(v)).filter(Boolean);
  const countRaw = String(formData.get("branchCount") ?? "").trim();
  const branchCount = countRaw ? Math.round(Number(countRaw)) : branchIds.length;
  const startMonth = String(formData.get("startMonth") ?? "").trim();
  const endMonth = String(formData.get("endMonth") ?? "").trim();
  const paidBy = formData.get("paidBy") === "partner" ? "partner" : "owner";
  const note = String(formData.get("note") ?? "").trim();

  if (!name) throw new Error("נא להזין שם אזור (למשל: קרית ספר)");
  if (!monthlyCost || monthlyCost <= 0) throw new Error("נא להזין את עלות הפרסום החודשית");
  if (!Number.isFinite(ownerPct) || ownerPct < 0 || ownerPct > 100) {
    throw new Error("אחוז הבעלים חייב להיות בין 0 ל-100");
  }
  if (branchIds.length === 0) throw new Error("נא לסמן לפחות סניף אחד באזור");
  if (!Number.isFinite(branchCount) || branchCount < branchIds.length) {
    throw new Error(`מספר הסניפים באזור לא יכול להיות קטן ממספר הסניפים שסומנו (${branchIds.length})`);
  }
  if (startMonth && !MONTH_RE.test(startMonth)) throw new Error("חודש התחלה לא תקין");
  if (endMonth && !MONTH_RE.test(endMonth)) throw new Error("חודש סיום לא תקין");
  if (startMonth && endMonth && endMonth < startMonth) throw new Error("חודש הסיום מוקדם מחודש ההתחלה");

  const area: Omit<AdArea, "id"> = { name, monthlyCost, ownerPct, branchCount, branchIds, paidBy };
  if (startMonth) area.startMonth = startMonth;
  if (endMonth) area.endMonth = endMonth;
  if (note) area.note = note;
  return area;
}

export async function createAdAreaAction(formData: FormData) {
  await requireOwner();
  await getAdminFirestore().collection(AD_AREAS_COLLECTION).add(readArea(formData));
  revalidate();
}

export async function updateAdAreaAction(id: string, formData: FormData) {
  await requireOwner();
  const area = readArea(formData);
  // set() with the full object so clearing startMonth/endMonth/note actually removes them
  await getAdminFirestore().collection(AD_AREAS_COLLECTION).doc(id).set(area);
  revalidate();
}

export async function deleteAdAreaAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection(AD_AREAS_COLLECTION).doc(id).delete();
  revalidate();
}
