"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { PERM_KEYS, requireOwner } from "@/lib/perms";
import { invalidateUserSyncCache } from "@/lib/auth";
import type { BranchType, PermissionKey, UserAssignment, UserRole } from "@ultranet/shared-types";

const ROLES: readonly UserRole[] = ["owner", "partner", "employee"];
const BRANCH_TYPES: readonly BranchType[] = ["computers", "rentals", "coworking"];

/**
 * הטופס שולח את השיוכים כ-JSON אחד. הוא מגיע מהדפדפן ולכן נבדק כאן שדה-שדה: תפקיד שאינו
 * מוכר, מפתח הרשאה שהומצא או סוג סניף שגוי פשוט נזרקים, ולא נכתבים ל-Firestore.
 */
function parseAssignments(raw: string): UserAssignment[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: UserAssignment[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const role = ROLES.find((r) => r === row.role);
    if (!role) continue;

    const branchId = typeof row.branchId === "string" ? row.branchId : "";
    const branchType = BRANCH_TYPES.find((t) => t === row.branchType);

    const perms: Partial<Record<PermissionKey, boolean>> = {};
    const rawPerms = (row.perms ?? {}) as Record<string, unknown>;
    for (const key of PERM_KEYS) {
      perms[key] = rawPerms[key] === true;
    }

    const assignment: UserAssignment = { role, branchId, perms };
    if (branchType) assignment.branchType = branchType;
    out.push(assignment);
  }
  return out;
}

function parseUserForm(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pass = String(formData.get("pass") ?? "");

  const assignments = parseAssignments(String(formData.get("assignments") ?? "[]"));
  // תמיד יש שיוך אחד לפחות: בלעדיו אין למשתמש תפקיד, וגם `n_approved_emails` צריך אחד.
  const primary: UserAssignment = assignments[0] ?? { role: "employee", branchId: "", perms: {} };
  const normalized = assignments.length > 0 ? assignments : [primary];

  const viewClientBranchIds: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("viewBranch_") && value === "on") {
      viewClientBranchIds.push(key.slice("viewBranch_".length));
    }
  }

  return {
    name,
    email,
    pass,
    assignments: normalized,
    // השדות ההיסטוריים ממשיכים לשקף את השיוך הראשון — `app.html` ו-`n_approved_emails`
    // קוראים אותם, ולכן הם לא יכולים להתרוקן. ראה `AppUser`.
    role: primary.role,
    branchId: primary.branchId,
    perms: primary.perms ?? {},
    viewClientBranchIds,
  };
}

/** בעלים ללא סניף נשמר כ-`"all"` — ההתנהגות ההיסטורית, ועכשיו על כל שיוך בנפרד. */
function withOwnerBranch(data: ReturnType<typeof parseUserForm>) {
  const assignments: UserAssignment[] = data.assignments.map((a) => ({
    ...a,
    branchId: a.role === "owner" ? a.branchId || "all" : a.branchId,
  }));
  // השדה ההיסטורי `branchId` הוא תמיד זה של השיוך הראשון — ראה `parseUserForm`.
  return { branchId: assignments[0]?.branchId ?? "", assignments };
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
  const { branchId, assignments } = withOwnerBranch(data);
  await db.collection("n_users").add({
    name: data.name,
    email: data.email,
    pass: data.pass,
    role: data.role,
    branchId,
    perms: data.perms,
    assignments,
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
  const { branchId, assignments } = withOwnerBranch(data);

  const update: Record<string, unknown> = {
    name: data.name,
    email: data.email,
    role: data.role,
    branchId,
    perms: data.perms,
    assignments,
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

  // Role/branch/perms edits shouldn't wait out the session sync window - drop both addresses so
  // the affected user picks the change up on their very next request.
  invalidateUserSyncCache(prevEmail);
  invalidateUserSyncCache(data.email);

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
    invalidateUserSyncCache(email);
  }
  revalidatePath("/dashboard/users");
  redirect("/dashboard/users");
}
