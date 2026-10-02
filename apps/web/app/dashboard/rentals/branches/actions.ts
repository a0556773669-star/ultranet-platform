"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions, invalidateUserSyncCache } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, PermissionKey, UserAssignment, UserRole } from "@ultranet/shared-types";
import { closeBranch, reopenBranch } from "@/lib/history";

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
  const phone = String(formData.get("phone") ?? "").trim() || undefined;
  // The branch's opening date: every income/expense calculation for this branch starts here.
  // Deliberately kept as "" and not undefined when the field is left empty - stripUndefined would
  // drop it from the merge, and clearing the date in the form has to actually clear it.
  const openedAt = String(formData.get("openedAt") ?? "").trim();
  // Always written explicitly (including false), so unchecking the box reactivates the branch.
  const notStarted = formData.get("notStarted") === "on";
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
    phone,
    openedAt,
    notStarted,
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

/** Soft-delete: hides the branch from every active list/picker, but keeps the Firestore doc (and
 *  therefore its name and every linked expense/transfer/income record) so its accounting history
 *  stays visible under /dashboard/rentals/accounting. */
export async function deleteRentalBranchAction(id: string) {
  await requireOwner();
  await getAdminFirestore()
    .collection("n_branches")
    .doc(id)
    .set({ deleted: true, deletedAt: new Date().toISOString() }, { merge: true });
  revalidatePath("/dashboard/branches");
  revalidatePath("/dashboard/rentals/branches");
  revalidatePath("/dashboard/rentals/accounting");
  redirect("/dashboard/rentals/branches");
}


/**
 * "בדוק הרשאות השכרות לכל הסניפים" — מוודא שלכל סניף השכרות עם "מייל השותף" יש משתמש שותף
 * עם הרשאת השכרות **בסניף הזה**.
 *
 * הגרסה הקודמת דרסה את `role`/`branchId`/`perms` הראשיים של כל משתמש שהמייל שלו נמצא, ולכן:
 * - בעלים שהמייל שלו רשום כמייל שותף (למשל בסניף "שלי" שמולא בטעות) ירד לתפקיד שותף ואיבד גישה;
 * - שותף בשני סניפים "קפץ" בכל הרצה לסניף האחרון בלולאה;
 * - עובד בחדר מחשבים איבד את התפקיד הזה — ו-`assignments` נשאר לא מסונכרן עם השדות הראשיים.
 *
 * עכשיו: בעלים לא נוגעים בו לעולם; כשהתפקיד הנכון חסר הוא **נוסף כשיוך נוסף** ולא מחליף את
 * הקיים. רק כשהסניף הזה הוא כבר הסניף הראשי של המשתמש מתקנים את השדות הראשיים (ואת
 * `assignments[0]` איתם). משתמש חדש נוצר גם עם אישור כניסה בקוד במייל — בלי זה לא הייתה לו
 * שום דרך להתחבר (אין לו סיסמה).
 */
export async function auditRentalPermissionsAction(): Promise<{ checked: number; fixed: number; skipped: number; owners: number }> {
  await requireOwner();
  const db = getAdminFirestore();
  const branchesSnap = await db.collection("n_branches").where("branchType", "==", "rentals").get();
  let checked = 0;
  let fixed = 0;
  let skipped = 0;
  let owners = 0;
  for (const doc of branchesSnap.docs) {
    const data = doc.data() as { partnerEmail?: string; partnerName?: string; deleted?: boolean };
    if (data.deleted || !data.partnerEmail?.trim()) {
      skipped++;
      continue;
    }
    checked++;
    const emailLower = data.partnerEmail.trim().toLowerCase();
    const wanted: UserAssignment = { role: "partner", branchId: doc.id, branchType: "rentals", perms: { rentals: true } };
    const usersSnap = await db.collection("n_users").where("email", "==", emailLower).get();

    if (usersSnap.empty) {
      const name = data.partnerName || emailLower;
      await db.collection("n_users").add({
        name,
        email: emailLower,
        role: "partner",
        branchId: doc.id,
        perms: { rentals: true },
        assignments: [wanted],
      });
      await db.collection("n_approved_emails").doc(emailLower).set({ name, role: "partner", branchId: doc.id });
      fixed++;
      continue;
    }

    const userDoc = usersSnap.docs[0]!;
    const user = userDoc.data() as {
      role?: UserRole;
      branchId?: string;
      perms?: Partial<Record<PermissionKey, boolean>>;
      assignments?: UserAssignment[];
    };
    const assignments: UserAssignment[] =
      Array.isArray(user.assignments) && user.assignments.length > 0
        ? user.assignments.filter((a) => a && a.role)
        : [{ role: user.role ?? "employee", branchId: user.branchId ?? "", perms: user.perms ?? {} }];

    // בעלים (בכל אחד מהכובעים) רואה הכל ממילא — אסור להוריד אותו לשותף.
    if (user.role === "owner" || assignments.some((a) => a.role === "owner")) {
      owners++;
      continue;
    }

    const idx = assignments.findIndex((a) => a.branchId === doc.id);
    const current = idx >= 0 ? assignments[idx] : undefined;
    if (current && current.role !== "employee" && current.perms?.rentals === true) continue; // תקין

    let next: UserAssignment[];
    if (current) {
      // יש לו כבר כובע בסניף הזה — משלימים אותו לשותף עם השכרות, בלי לגעת בכובעים האחרים.
      next = assignments.map((a, i) =>
        i === idx ? { ...a, role: a.role === "employee" ? "partner" : a.role, branchType: "rentals", perms: { ...(a.perms ?? {}), rentals: true } } : a,
      );
    } else if (assignments.length === 1 && !assignments[0]!.branchId) {
      // משתמש בלי סניף בכלל — הסניף הזה הופך לשיוך הראשי שלו.
      next = [{ ...wanted, perms: { ...(assignments[0]!.perms ?? {}), rentals: true } }];
    } else {
      next = [...assignments, wanted];
    }

    const primary = next[0]!;
    await userDoc.ref.set(
      { assignments: next, role: primary.role, branchId: primary.branchId, perms: primary.perms ?? {} },
      { merge: true },
    );
    invalidateUserSyncCache(emailLower);
    fixed++;
  }
  revalidatePath("/dashboard/rentals/branches");
  revalidatePath("/dashboard/users");
  return { checked, fixed, skipped, owners };
}

/**
 * סגירת סניף — בעלים בלבד. הסניף לא נמחק: הוא מקבל תאריך סגירה עסקי (`closedAt`), כל
 * ההוצאות הקבועות שלו נעצרות באותו יום, והמעקב אחריו נעצר בחודש הסגירה. ההיסטוריה, וגם יתרת
 * ההעברה הפתוחה מול השותף, נשארות — סגירת סניף היא לא מחיקת חוב. ראו `closeBranch` ב-`lib/history.ts`.
 */
export async function closeRentalBranchAction(id: string, closedAt: string): Promise<{ ok: boolean; message: string }> {
  await requireOwner();
  const result = await closeBranch(id, closedAt);
  revalidatePath("/dashboard/rentals", "layout");
  revalidatePath("/dashboard/accounting/mobile");
  revalidatePath("/dashboard/accounting");
  return { ok: result.ok, message: result.message };
}

/** פתיחה מחדש של סניף שנסגר. ההוצאות שנעצרו לא חוזרות לבד. בעלים בלבד. */
export async function reopenRentalBranchAction(id: string): Promise<{ ok: boolean; message: string }> {
  await requireOwner();
  const result = await reopenBranch(id);
  revalidatePath("/dashboard/rentals", "layout");
  revalidatePath("/dashboard/accounting/mobile");
  return result;
}
