"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Laptop } from "@ultranet/shared-types";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  return session;
}

async function requireOwner() {
  const session = await requireSession();
  if (session.user?.role !== "owner") throw new Error("אין הרשאה");
  return session;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function parseLaptopForm(formData: FormData, branchId: string): Omit<Laptop, "id"> {
  const name = String(formData.get("name") ?? "").trim();
  const dayPrice = Number(formData.get("dayPrice")) || 0;
  const weekPrice = Number(formData.get("weekPrice")) || 0;
  const monthPrice = Number(formData.get("monthPrice")) || 0;
  const hasStick = formData.get("hasStick") === "on";
  const simNumber = hasStick ? String(formData.get("simNumber") ?? "").trim() || undefined : undefined;
  const altPricing = formData.get("altPricing") === "on";
  const noInternetDayPrice = altPricing ? Number(formData.get("noInternetDayPrice")) || 0 : undefined;
  const noInternetWeekPrice = altPricing ? Number(formData.get("noInternetWeekPrice")) || 0 : undefined;
  const noInternetMonthPrice = altPricing ? Number(formData.get("noInternetMonthPrice")) || 0 : undefined;
  const stickOnlyDayPrice = altPricing ? Number(formData.get("stickOnlyDayPrice")) || 0 : undefined;
  const stickOnlyWeekPrice = altPricing ? Number(formData.get("stickOnlyWeekPrice")) || 0 : undefined;
  const stickOnlyMonthPrice = altPricing ? Number(formData.get("stickOnlyMonthPrice")) || 0 : undefined;
  return {
    branchId,
    name,
    dayPrice,
    weekPrice,
    monthPrice,
    hasStick,
    simNumber,
    altPricing,
    noInternetDayPrice,
    noInternetWeekPrice,
    noInternetMonthPrice,
    stickOnlyDayPrice,
    stickOnlyWeekPrice,
    stickOnlyMonthPrice,
  };
}

export async function createLaptopAction(formData: FormData) {
  const session = await requireSession();
  const role = session.user?.role;
  const branchId =
    role === "owner" ? String(formData.get("branchId") ?? "").trim() : String(session.user?.branchId ?? "").trim();
  const data = parseLaptopForm(formData, branchId);
  (data as Record<string, unknown>).addedDate = new Date().toISOString().slice(0, 10);
  if (!data.branchId || !data.name) {
    redirect(`/dashboard/rentals/laptops/new?error=${role !== "owner" && !data.branchId ? "no-branch" : "missing"}`);
  }
  try {
    await getAdminFirestore().collection("n_laptops").add(stripUndefined(data));
  } catch (e) {
    throw new Error("שגיאה בשמירת המחשב ל-Firestore: " + (e instanceof Error ? e.message : String(e)));
  }
  revalidatePath("/dashboard/rentals/laptops");
  redirect("/dashboard/rentals/laptops");
}

export async function updateLaptopAction(id: string, formData: FormData) {
  const session = await requireSession();
  const role = session.user?.role;
  const existing = await getAdminFirestore().collection("n_laptops").doc(id).get();
  const existingBranchId = (existing.data() as Omit<Laptop, "id"> | undefined)?.branchId ?? "";
  const branchId = role === "owner" ? String(formData.get("branchId") ?? "").trim() : existingBranchId;
  const data = parseLaptopForm(formData, branchId);
  if (!data.branchId || !data.name) {
    redirect(`/dashboard/rentals/laptops/${id}?error=${role !== "owner" && !data.branchId ? "no-branch" : "missing"}`);
  }
  try {
    await getAdminFirestore().collection("n_laptops").doc(id).set(stripUndefined(data), { merge: true });
  } catch (e) {
    throw new Error("שגיאה בעדכון המחשב ב-Firestore: " + (e instanceof Error ? e.message : String(e)));
  }
  revalidatePath("/dashboard/rentals/laptops");
  redirect("/dashboard/rentals/laptops");
}

export async function deleteLaptopAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_laptops").doc(id).delete();
  revalidatePath("/dashboard/rentals/laptops");
  redirect("/dashboard/rentals/laptops");
}
