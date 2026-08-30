"use server";

import { revalidatePath } from "next/cache";
import { FieldValue } from "firebase-admin/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  branchExpenseFrom,
  branchIncomeFrom,
  entryCollection,
  ledgerExpenseFrom,
  ledgerIncomeFrom,
  type EntryBook,
  type EntryFields,
  type EntryKind,
} from "@/lib/accounting-entries";
import {
  createLinkedOwnerLedgerExpense,
  deleteLinkedOwnerLedgerExpense,
} from "@/lib/branch-expense-ledger";
import { normalizeAllocations } from "@/lib/tx";
import type { BranchIncome, Transaction, VariableExpense } from "@ultranet/shared-types";

/** Same contract as the rest of the accounting forms: never throw, always answer. */
export interface SaveResult {
  ok: boolean;
  message: string;
}

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

/**
 * Every screen that shows these rows, in one place. A movement can be created on one screen,
 * edited on a second and read on a third, so a mutation has to clear all of them or the row
 * looks unchanged wherever the user happens to look next.
 */
function revalidateEverywhere(branchIds: (string | undefined)[] = []) {
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/accounting/entries");
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath("/dashboard/accounting/attribute");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/rentals/expenses");
  revalidatePath("/dashboard/rentals/accounting");
  for (const id of branchIds) {
    if (id) revalidatePath(`/dashboard/accounting/overview/${id}`);
  }
}

async function ownerError(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session) return "נדרשת התחברות מחדש";
  if (session.user?.role !== "owner") return "רק הבעלים יכול לערוך או למחוק תנועות";
  return null;
}

function readFields(formData: FormData): EntryFields | string {
  const date = String(formData.get("date") ?? "").trim();
  const rawAmount = String(formData.get("amount") ?? "").replace(/[₪,\s]/g, "");
  const amount = Number(rawAmount);
  const desc = String(formData.get("desc") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "נא לבחור תאריך";
  if (!Number.isFinite(amount) || amount <= 0) return "נא להזין סכום גדול מאפס";
  if (!desc && !category) return "נא להזין תיאור או לבחור קטגוריה";
  return { date, amount, desc, category: category || undefined };
}

/**
 * An edit that clears the category has to erase the stored field, not merely omit it - under
 * `{ merge: true }` an omitted key keeps whatever was there, so the category the owner just
 * deleted would come straight back.
 */
function withCategory(data: object, category: string | undefined): Record<string, unknown> {
  return { ...data, category: category ?? FieldValue.delete() };
}

/**
 * Deletes one movement, whichever of the four collections it lives in.
 *
 * A branch expense may carry a matching row in the owner's ledger, written when it was created
 * (VariableExpense.linkedAhExpenseId); that mirror goes with it, otherwise the deleted expense
 * leaves a ghost behind in the personal books.
 */
export async function deleteEntryAction(
  kind: EntryKind,
  book: EntryBook,
  id: string,
): Promise<SaveResult> {
  try {
    const denied = await ownerError();
    if (denied) return { ok: false, message: denied };
    if (!id) return { ok: false, message: "לא זוהתה שורה למחיקה" };

    const db = getAdminFirestore();
    const ref = db.collection(entryCollection(kind, book)).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return { ok: false, message: "השורה כבר לא קיימת" };

    const data = doc.data() as { branchId?: string; linkedAhExpenseId?: string };
    if (kind === "expense" && book === "branch") {
      await deleteLinkedOwnerLedgerExpense(data.linkedAhExpenseId);
    }
    await ref.delete();

    revalidateEverywhere([data.branchId]);
    return { ok: true, message: kind === "income" ? "ההכנסה נמחקה" : "ההוצאה נמחקה" };
  } catch (err) {
    return {
      ok: false,
      message: `המחיקה נכשלה: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`,
    };
  }
}

/**
 * Edits one movement - and re-files it if the branch changed.
 *
 * The branch picker on the edit form means "whose book is this row in". Changing it is not an
 * ordinary field edit: a branch's money and the owner's own money live in different collections,
 * so a book change is written as a real move - recreated at the destination, original deleted -
 * and never as a copy, which would count the same money twice.
 */
export async function updateEntryAction(
  kind: EntryKind,
  book: EntryBook,
  id: string,
  formData: FormData,
): Promise<SaveResult> {
  try {
    const denied = await ownerError();
    if (denied) return { ok: false, message: denied };
    if (!id) return { ok: false, message: "לא זוהתה שורה לעריכה" };

    const fields = readFields(formData);
    if (typeof fields === "string") return { ok: false, message: fields };

    const targetBranchId = String(formData.get("branchId") ?? "").trim();
    const targetBook: EntryBook = targetBranchId ? "branch" : "ledger";

    const db = getAdminFirestore();

    /* --- the unified book: a transaction is edited in place ------------------ *
     * A tx row never moves between books, because there is only one. Re-tagging it to another
     * branch is a change of node, not a change of collection - which is the whole point of
     * collapsing the two-axis grid into one place. `ownerShare` is rescaled with the amount so
     * an edited total can never drift away from the split it carries.                        */
    if (book === "tx") {
      const txRef = db.collection(entryCollection(kind, "tx")).doc(id);
      const txDoc = await txRef.get();
      if (!txDoc.exists) return { ok: false, message: "התנועה כבר לא קיימת" };
      const tx = txDoc.data() as Partial<Transaction>;

      const oldAmount = tx.amount || 0;
      const ratio = oldAmount > 0 ? fields.amount / oldAmount : 1;
      const patch: Record<string, unknown> = {
        date: fields.date,
        month: fields.date.slice(0, 7),
        amount: Math.round(fields.amount),
        desc: fields.desc || fields.category || (kind === "income" ? "הכנסה" : "הוצאה"),
        category: fields.category ?? FieldValue.delete(),
        ownerShare: Math.round((tx.ownerShare ?? oldAmount) * ratio),
      };
      if (tx.allocations?.length) {
        patch.allocations = normalizeAllocations(
          fields.amount,
          tx.allocations.map((a) => ({ branchId: a.branchId, amount: a.amount * ratio })),
        );
      }
      if (targetBranchId && targetBranchId !== tx.node?.branchId) {
        const branchDoc = await db.collection("n_branches").doc(targetBranchId).get();
        if (!branchDoc.exists) return { ok: false, message: "הסניף שנבחר לא נמצא" };
        const branchType = (branchDoc.data() as { branchType?: string }).branchType;
        patch.node = {
          business:
            branchType === "rentals" || branchType === "computers" || branchType === "coworking"
              ? branchType
              : "hq",
          branchId: targetBranchId,
        };
        // Re-tagging to one branch replaces any previous split; keeping both would let the
        // allocations disagree with the node the row now hangs on.
        patch.allocations = FieldValue.delete();
      }

      await txRef.set(patch, { merge: true });
      revalidateEverywhere([tx.node?.branchId, targetBranchId]);
      return {
        ok: true,
        message: `התנועה עודכנה: ${fields.desc || fields.category} — ${money(fields.amount)}`,
      };
    }

    const ref = db.collection(entryCollection(kind, book)).doc(id);
    const doc = await ref.get();
    if (!doc.exists) return { ok: false, message: "השורה כבר לא קיימת" };
    const existing = doc.data() as Partial<VariableExpense & BranchIncome>;

    let branchLabel = "";
    if (targetBranchId) {
      const branchDoc = await db.collection("n_branches").doc(targetBranchId).get();
      if (!branchDoc.exists) return { ok: false, message: "הסניף שנבחר לא נמצא" };
      branchLabel = (branchDoc.data() as { name?: string }).name ?? "הסניף";
    }

    const label = `${fields.desc || fields.category} — ${money(fields.amount)}`;

    /* --- same book: a field update, plus a branch swap for rows already in a branch book --- */
    if (book === targetBook && book === "branch") {
      const patch: Record<string, unknown> =
        kind === "expense"
          ? withCategory(
              branchExpenseFrom(fields, targetBranchId, {
                paidBy: existing.paidBy,
                owedBy: existing.owedBy,
              }),
              fields.category,
            )
          : // an edit must not flip who is holding the cash - that flag drives the partner
            // settlement, and it was decided when the row was first written
            { ...branchIncomeFrom(fields, targetBranchId, { collectedByOwner: existing.collectedByOwner ?? false }) };

      // The mirror row in the owner's ledger holds the owner's share of THIS amount, so it is
      // rewritten from scratch rather than left pointing at the figure that was just replaced.
      if (kind === "expense" && existing.linkedAhExpenseId) {
        await deleteLinkedOwnerLedgerExpense(existing.linkedAhExpenseId);
        const linkedAhExpenseId = await createLinkedOwnerLedgerExpense({
          business: "general",
          desc: `${fields.desc || fields.category} — ${branchLabel}`,
          amount: fields.amount,
          paidBy: existing.paidBy,
          owedBy: existing.owedBy,
          date: fields.date,
        });
        patch.linkedAhExpenseId = linkedAhExpenseId ?? FieldValue.delete();
      }

      await ref.set(patch, { merge: true });
      revalidateEverywhere([existing.branchId, targetBranchId]);
      return { ok: true, message: `עודכן אצל ${branchLabel}: ${label}` };
    }

    if (book === targetBook) {
      const patch = withCategory(
        kind === "expense" ? ledgerExpenseFrom(fields) : ledgerIncomeFrom(fields),
        fields.category,
      );
      // `business` and `type` say which form the row was entered from. Editing an amount or a
      // date must not silently reclassify a "ניידים" income row as a generic one, so both are
      // left exactly as they were.
      delete patch.business;
      delete patch.type;
      await ref.set(patch, { merge: true });
      revalidateEverywhere([existing.branchId]);
      return { ok: true, message: `עודכן בהנה"ח האישית: ${label}` };
    }

    /* --- book change: recreate at the destination, then drop the original --- */
    if (targetBook === "branch") {
      const data =
        kind === "expense"
          ? branchExpenseFrom(fields, targetBranchId)
          : branchIncomeFrom(fields, targetBranchId);
      await db.collection(entryCollection(kind, "branch")).add(data);
      await ref.delete();
      revalidateEverywhere([targetBranchId]);
      return { ok: true, message: `הועבר לספר של ${branchLabel}: ${label}` };
    }

    if (kind === "expense") {
      await deleteLinkedOwnerLedgerExpense(existing.linkedAhExpenseId);
    }
    const data = kind === "expense" ? ledgerExpenseFrom(fields) : ledgerIncomeFrom(fields);
    await db.collection(entryCollection(kind, "ledger")).add(data);
    await ref.delete();
    revalidateEverywhere([existing.branchId]);
    return { ok: true, message: `הוחזר להנה"ח האישית: ${label}` };
  } catch (err) {
    return {
      ok: false,
      message: `השמירה נכשלה: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`,
    };
  }
}
