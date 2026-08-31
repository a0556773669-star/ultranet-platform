"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { closeBranch, reopenBranch } from "@/lib/history";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * One branch's two "when does this branch count" fields, saved from the branch-status screen:
 *
 *  - `openedAt`   - the opening date every income/expense calculation starts from. Written as ""
 *                   when the field is cleared, so clearing really clears it (a merge would keep
 *                   the old value if we wrote undefined).
 *  - `notStarted` - the manual "hasn't started operating yet" mark. Always written explicitly,
 *                   including `false`, so unchecking the box actually reactivates the branch.
 */
export async function saveBranchStatusAction(branchId: string, formData: FormData) {
  await requireOwner();
  if (!branchId) throw new Error("חסר מזהה סניף");

  const openedAt = String(formData.get("openedAt") ?? "").trim();
  if (openedAt && !DATE_RE.test(openedAt)) {
    throw new Error("תאריך פתיחה לא תקין");
  }
  const notStarted = formData.get("notStarted") === "on";

  await getAdminFirestore().collection("n_branches").doc(branchId).set({ openedAt, notStarted }, { merge: true });

  revalidatePath("/dashboard/accounting/branches");
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath(`/dashboard/accounting/overview/${branchId}`);
  revalidatePath("/dashboard/rentals/branches");
  revalidatePath("/dashboard/branches");
}

/** Never throw at the browser: every outcome comes back as something the screen can render. */
export interface BranchActionResult {
  ok: boolean;
  message: string;
}

/**
 * Creates a branch of any type from the one branch-management screen.
 * The percentage the owner types is the PARTNER's share, since that is how a partnership is
 * spoken about ("he's on 50%"); `myPct`/`partnerPct` are derived from it. With no partner name
 * the branch is fully the owner's.
 */
export async function createBranchAction(formData: FormData): Promise<BranchActionResult> {
  try {
    await requireOwner();

    const name = String(formData.get("name") ?? "").trim();
    if (!name) return { ok: false, message: "נא להזין שם סניף" };

    const branchType = String(formData.get("branchType") ?? "").trim();
    if (!["rentals", "computers", "coworking"].includes(branchType)) {
      return { ok: false, message: "נא לבחור סוג סניף" };
    }

    const openedAt = String(formData.get("openedAt") ?? "").trim();
    if (openedAt && !DATE_RE.test(openedAt)) return { ok: false, message: "תאריך פתיחה לא תקין" };

    const partnerName = String(formData.get("partnerName") ?? "").trim();
    const partnerEmail = String(formData.get("partnerEmail") ?? "").trim();
    const rawPct = Number(String(formData.get("partnerPct") ?? "").trim());
    const partnerPct = partnerName ? (Number.isFinite(rawPct) ? Math.min(100, Math.max(0, rawPct)) : 50) : 0;

    const db = getAdminFirestore();
    const existing = await db.collection("n_branches").get();
    const clash = existing.docs.some(
      (d) => ((d.data() as { name?: string; deleted?: boolean }).name ?? "").trim() === name &&
        !(d.data() as { deleted?: boolean }).deleted,
    );
    if (clash) return { ok: false, message: `כבר קיים סניף פעיל בשם "${name}"` };

    await db.collection("n_branches").add({
      name,
      branchType,
      isMine: !partnerName,
      myPct: 100 - partnerPct,
      partnerPct,
      ...(partnerName ? { partnerName } : {}),
      ...(partnerEmail ? { partnerEmail } : {}),
      ...(openedAt ? { openedAt } : {}),
      notStarted: false,
    });

    revalidateBranchScreens();
    return { ok: true, message: `הסניף "${name}" נוסף` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "ההוספה נכשלה" };
  }
}

/**
 * Writes the opening dates the owner approved on the proposals table - many branches in one go.
 *
 * Only the rows she ticked are written, each with the date shown in its own field, so a proposal
 * she corrected is saved as corrected and a proposal she left unticked is not saved at all.
 * Nothing is written unless every ticked row carries a valid date: a partial write here would
 * leave the books half-fixed, which is harder to see than not having run it.
 *
 * Saving a date also clears `notStarted`, and the screen says so: an opening date IS the
 * statement that the branch is open, so leaving the "hasn't started" mark on would keep the
 * branch out of its own book and make the date look broken.
 */
export async function applyOpeningDatesAction(formData: FormData): Promise<BranchActionResult> {
  try {
    await requireOwner();

    const ids = formData.getAll("branchId").map(String).filter(Boolean);
    if (ids.length === 0) return { ok: false, message: "לא סומן אף סניף" };

    const dates = new Map<string, string>();
    for (const id of ids) {
      const date = String(formData.get(`date_${id}`) ?? "").trim();
      const name = String(formData.get(`name_${id}`) ?? "").trim() || "סניף";
      if (!date) return { ok: false, message: `לסניף "${name}" לא הוזן תאריך — נא למלא או להסיר את הסימון` };
      if (!DATE_RE.test(date)) return { ok: false, message: `תאריך לא תקין בסניף "${name}"` };
      dates.set(id, date);
    }

    const db = getAdminFirestore();
    const batch = db.batch();
    for (const [id, date] of dates) {
      batch.set(db.collection("n_branches").doc(id), { openedAt: date, notStarted: false }, { merge: true });
    }
    await batch.commit();

    revalidateBranchScreens();
    return {
      ok: true,
      message: `נשמרו תאריכי פתיחה ל-${dates.size} סניפים — מהחודש של כל תאריך הסניף נכנס לספר שלו`,
    };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "השמירה נכשלה" };
  }
}

/**
 * Soft-delete, matching the rest of the app: the branch drops out of every active screen but its
 * income, expenses and settlements stay in Firestore. A report for a past month must not change
 * retroactively just because a partner left today - and the branch can be restored intact.
 */
export async function deleteBranchAction(branchId: string, expectedName: string): Promise<BranchActionResult> {
  try {
    await requireOwner();
    if (!branchId) return { ok: false, message: "חסר מזהה סניף" };

    const ref = getAdminFirestore().collection("n_branches").doc(branchId);
    const doc = await ref.get();
    if (!doc.exists) return { ok: false, message: "הסניף לא נמצא" };

    const name = ((doc.data() as { name?: string }).name ?? "").trim();
    // typing the name is the guard against deleting the wrong branch with one click
    if (expectedName.trim() !== name) {
      return { ok: false, message: "שם הסניף שהוקלד אינו תואם — לא נמחק" };
    }

    await ref.set({ deleted: true, deletedAt: new Date().toISOString() }, { merge: true });
    revalidateBranchScreens();
    return { ok: true, message: `הסניף "${name}" נמחק — ההיסטוריה שלו נשמרה` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "המחיקה נכשלה" };
  }
}

export async function restoreBranchAction(branchId: string): Promise<BranchActionResult> {
  try {
    await requireOwner();
    if (!branchId) return { ok: false, message: "חסר מזהה סניף" };

    const ref = getAdminFirestore().collection("n_branches").doc(branchId);
    const doc = await ref.get();
    if (!doc.exists) return { ok: false, message: "הסניף לא נמצא" };

    await ref.set({ deleted: false, deletedAt: "" }, { merge: true });
    revalidateBranchScreens();
    const name = ((doc.data() as { name?: string }).name ?? "").trim();
    return { ok: true, message: `הסניף "${name}" שוחזר` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "השחזור נכשל" };
  }
}

function revalidateBranchScreens() {
  revalidatePath("/dashboard/accounting/branches");
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath("/dashboard/accounting/entries");
  revalidatePath("/dashboard/accounting/inventory");
  revalidatePath("/dashboard/accounting/policies");
  revalidatePath("/dashboard/rentals/branches");
  revalidatePath("/dashboard/branches");
}

/**
 * סגירת סניף (פרק טו׳) — תאריך סגירה עסקי, לא מחיקה.
 *
 * `closedAt` is not `deletedAt`. Deleting is a technical act performed whenever someone gets
 * around to it; closing is the business fact that decides from which month the branch stops
 * accruing costs and stops owing a transfer. Using the wrong one bills a dead branch for months
 * it never operated - the exact failure `openedAt` already fixes at the other end.
 */
export async function closeBranchAction(branchId: string, formData: FormData): Promise<BranchActionResult> {
  try {
    await requireOwner();
    const closedAt = String(formData.get("closedAt") ?? "").trim();
    const result = await closeBranch(branchId, closedAt);
    revalidateBranchScreens();
    revalidatePath(`/dashboard/accounting/overview/${branchId}`);
    return { ok: result.ok, message: result.message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "הסגירה נכשלה" };
  }
}

export async function reopenBranchAction(branchId: string): Promise<BranchActionResult> {
  try {
    await requireOwner();
    const result = await reopenBranch(branchId);
    revalidateBranchScreens();
    revalidatePath(`/dashboard/accounting/overview/${branchId}`);
    return result;
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "הפתיחה מחדש נכשלה" };
  }
}

