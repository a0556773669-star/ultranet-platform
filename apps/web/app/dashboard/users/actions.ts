"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";
import type { UserRole } from "@ultranet/shared-types";

const PERM_KEYS = ["branches", "computers", "rentals", "coworking", "accounting", "tasks"] as const;

function parseUserForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pass = String(formData.get("pass") ?? "");
  const role = String(formData.get("role") ?? "employee") as UserRole;
  const branchId = String(formData.get("branchId") ?? "");
  const perms: Partial<Record<(typeof PERM_KEYS)[number], boolean>> = {};
  for (const key of PERM_KEYS) {
    perms[key] = formData.get(`perm_${key}`) === "on";
  }
  const viewClientBranchIds: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("viewBranch_") && value === "on") {
      viewClientBranchIds.push(key.slice("viewBranch_".length));
    }
  }
  return { name, email, pass, role, branchId, perms, viewClientBranchIds };
}

export async function createUserAction(formData: FormData) {
  await requireOwner();
  const data = parseUserForm(formData);
  if (!data.name || !data.email || !data.pass) {
    throw new Error("יש למלא שם, אימייל וסיסמה");
  }
  const db = getAdminFirestore();
  const existing = await db.collection("n_users").where("email", "==", data.email).get();
  if (!existing.empty) {
    throw new Error("כבר קיים משתמש עם אימייל זה");
  }
  const branchId = data.role === "owner" ? (data.branchId || "all") : data.branchId;
  await db.collection("n_users").add({
    name: data.name,
    email: data.email,
    pass: data.pass,
    role: data.role,
    branchId,
    perms: data.perms,
    viewClientBranchIds: data.viewClientBranchIds,
  });
  await db.collection("n_approved_emails").doc(data.email).set({
    name: data.name,
    role: data.role,
    branchId,
  });
  revalidatePath("/dashboard/users");
  redirect("/dashboard/users");
}

export async function updateUserAction(id: string, formData: FormData) {
  await requireOwner();
  const data = parseUserForm(formData);
  if (!data.name || !data.email) {
    throw new Error("יש למלא שם ואימייל");
  }
  const db = getAdminFirestore();
  const docRef = db.collection("n_users").doc(id);
  const doc = await docRef.get();
  const prevEmail = doc.exists ? (doc.data()?.email as string | undefined) : undefined;
  const branchId = data.role === "owner" ? (data.branchId || "all") : data.branchId;

  const update: Record<string, unknown> = {
    name: data.name,
    email: data.email,
    role: data.role,
    branchId,
    perms: data.perms,
    viewClientBranchIds: data.viewClientBranchIds,
  };
  if (data.pass) {
    update.pass = data.pass;
  }
  await docRef.set(update, { merge: true });

  if (prevEmail && prevEmail !== data.email) {
    await db.collection("n_approved_emails").doc(prevEmail).delete();
  }
  await db.collection("n_approved_emails").doc(data.email).set({
    name: data.name,
    role: data.role,
    branchId,
  });

  revalidatePath("/dashboard/users");
  redirect("/dashboard/users");
}

export async function deleteUserAction(id: string) {
  const session = await requireOwner();
  const db = getAdminFirestore();
  const docRef = db.collection("n_users").doc(id);
  const doc = await docRef.get();
  const email = doc.exists ? (doc.data()?.email as string | undefined) : undefined;
  if (email && email === session.user?.email) {
    throw new Error("לא ניתן למחוק את המשתמש המחובר");
  }
  await docRef.delete();
  if (email) {
    await db.collection("n_approved_emails").doc(email).delete();
  }
  revalidatePath("/dashboard/users");
  redirect("/dashboard/users");
}
