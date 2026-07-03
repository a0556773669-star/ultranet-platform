"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, BranchType } from "@ultranet/shared-types";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
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

function parseBranchForm(formData: FormData): Omit<Branch, "id"> {
  const name = String(formData.get("name") ?? "").trim();
  const branchType = String(formData.get("branchType") ?? "computers") as BranchType;
  const location = String(formData.get("location") ?? "").trim() || undefined;
  const isMine = formData.get("isMine") === "on";
  const partnerName = String(formData.get("partnerName") ?? "").trim() || undefined;
  const partnerEmail = String(formData.get("partnerEmail") ?? "").trim() || undefined;
  const myPct = Number(formData.get("myPct") ?? 100);
  const partnerPct = Number(formData.get("partnerPct") ?? 0);
  const setupCostRaw = formData.get("setupCost");
  const setupCost = setupCostRaw ? Number(setupCostRaw) : undefined;
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const parentBranchId = String(formData.get("parentBranchId") ?? "").trim() || null;

  return {
    name,
    branchType,
    location,
    isMine,
    partnerName,
    partnerEmail,
    myPct,
    partnerPct,
    setupCost,
    notes,
    parentBranchId,
  };
}

export async function createBranchAction(formData: FormData) {
  await requireOwner();
  const data = parseBranchForm(formData);
  if (!data.name) {
    throw new Error("שם הסניף הוא שדה חובה");
  }
  const ref = await getAdminFirestore().collection("n_branches").add(stripUndefined(data));
  revalidatePath("/dashboard/branches");
  redirect(`/dashboard/branches/${ref.id}`);
}

export async function updateBranchAction(id: string, formData: FormData) {
  await requireOwner();
  const data = parseBranchForm(formData);
  await getAdminFirestore().collection("n_branches").doc(id).set(stripUndefined(data), { merge: true });
  revalidatePath("/dashboard/branches");
  revalidatePath(`/dashboard/branches/${id}`);
}

export async function deleteBranchAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_branches").doc(id).delete();
  revalidatePath("/dashboard/branches");
  redirect("/dashboard/branches");
}
