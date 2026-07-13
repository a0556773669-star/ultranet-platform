"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("הפעולה זו מוגבלת לבעלים בלבד");
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

async function upsertPartnerUser(email: string, name: string | undefined, branchId: string) {
  const db = getAdminFirestore();
  const emailLower = email.trim().toLowerCase();
  if (!emailLower) return;
  const snap = await db.collection("n_users").where("email", "==", emailLower).get();
  if (snap.empty) {
    await db.collection("n_users").add({
      name: name || emailLower,
      email: emailLower,
      role: "partner",
      branchId,
      perms: { rentals: true },
    });
  } else {
    const doc = snap.docs[0]!;
    const existing = doc.data() as { perms?: Record<string, boolean>; role?: string };
    await doc.ref.set(
      {
        branchId,
        role: existing.role === "owner" ? existing.role : "partner",
        perms: { ...(existing.perms ?? {}), rentals: true },
      },
      { merge: true }
    );
  }
}
function parseRentalBranchForm(formData: FormData): Omit<Branch, "id"> {
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || undefined;
  const isMine = formData.get("isMine") === "on";
  const partnerName = String(formData.get("partnerName") ?? "").trim() || undefined;
  const partnerEmail = String(formData.get("partnerEmail") ?? "").trim() || undefined;
  const myPct = Number(formData.get("myPct")) || 0;
  const partnerPct = Number(formData.get("partnerPct")) || 0;
  const parentPct = Number(formData.get("parentPct")) || undefined;
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const parentBranchId = String(formData.get("parentBranchId") ?? "").trim() || null;
  const collectionRouteId = String(formData.get("collectionRouteId") ?? "").trim() || null;
  const allowCollection = formData.get("allowCollection") === "on";
  const allowReceipts = formData.get("allowReceipts") === "on";

  return {
    name,
    branchType: "rentals",
    location,
    isMine,
    partnerName,
    partnerEmail,
    myPct,
    partnerPct,
    parentPct,
    notes,
    parentBranchId,
    collectionRouteId,
    allowCollection,
    allowReceipts,
  };
}

export async function createRentalBranchAction(formData: FormData) {
  await requireOwner();
  const data = parseRentalBranchForm(formData);
  if (!data.name) {
    throw new Error("חובה להזין שם סניף");
  }
  const ref = await getAdminFirestore().collection("n_branches").add(stripUndefined(data));
  if (data.partnerEmail) {
    await upsertPartnerUser(data.partnerEmail, data.partnerName, ref.id);
  }
  revalidatePath("/dashboard/branches");
  revalidatePath("/dashboard/rentals/branches");
  redirect(`/dashboard/rentals/branches/${ref.id}`);
}

export async function updateRentalBranchAction(id: string, formData: FormData) {
  await requireOwner();
  const data = parseRentalBranchForm(formData);
  await getAdminFirestore().collection("n_branches").doc(id).set(stripUndefined(data), { merge: true });
  if (data.partnerEmail) {
    await upsertPartnerUser(data.partnerEmail, data.partnerName, id);
  }
  revalidatePath("/dashboard/branches");
  revalidatePath("/dashboard/rentals/branches");
  revalidatePath(`/dashboard/rentals/branches/${id}`);
  redirect("/dashboard/rentals/branches");
}

export async function deleteRentalBranchAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_branches").doc(id).delete();
  revalidatePath("/dashboard/branches");
  revalidatePath("/dashboard/rentals/branches");
  redirect("/dashboard/rentals/branches");
}


export async function auditRentalPermissionsAction(): Promise<{ checked: number; fixed: number; skipped: number }> {
  await requireOwner();
  const db = getAdminFirestore();
  const branchesSnap = await db.collection("n_branches").where("branchType", "==", "rentals").get();
  let checked = 0;
  let fixed = 0;
  let skipped = 0;
  for (const doc of branchesSnap.docs) {
    const data = doc.data() as { partnerEmail?: string; partnerName?: string };
    if (!data.partnerEmail) {
      skipped++;
      continue;
    }
    checked++;
    const emailLower = data.partnerEmail.trim().toLowerCase();
    const usersSnap = await db.collection("n_users").where("email", "==", emailLower).get();
    if (usersSnap.empty) {
      await db.collection("n_users").add({
        name: data.partnerName || emailLower,
        email: emailLower,
        role: "partner",
        branchId: doc.id,
        perms: { rentals: true },
      });
      fixed++;
    } else {
      const userDoc = usersSnap.docs[0];
        if (!userDoc) continue;
      const userData = userDoc.data() as { perms?: Record<string, boolean>; branchId?: string; role?: string };
      const needsFix = userData.perms?.rentals !== true || userData.branchId !== doc.id || userData.role !== "partner";
      if (needsFix) {
        await userDoc.ref.set(
          {
            role: "partner",
            branchId: doc.id,
            perms: { ...(userData.perms ?? {}), rentals: true },
          },
          { merge: true }
        );
        fixed++;
      }
    }
  }
  revalidatePath("/dashboard/rentals/branches");
  return { checked, fixed, skipped };
}
