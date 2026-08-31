"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { createLinkedOwnerLedgerExpense } from "@/lib/branch-expense-ledger";
import type { Branch, FixedExpense, VariableExpense } from "@ultranet/shared-types";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
}

/** One row as the import screen resolved it - branch already picked, amount already a number. */
export interface ImportRow {
  name: string;
  branchId: string;
  /** YYYY-MM-DD for a dated expense, YYYY-MM for a recurring one */
  when: string;
  amount: number;
  category?: string;
}

export interface ImportResult {
  created: number;
  skipped: number;
  /** one line per row that was skipped, so nothing disappears without an explanation */
  notes: string[];
  error?: string;
}

const money = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

/**
 * Writes imported expenses, skipping anything that already looks present.
 *
 * Duplicate rule:
 *  - recurring: same branch + same name + same monthly amount already exists -> skip
 *  - dated: same branch + same month + same amount + same description already exists -> skip
 * That makes the import safe to run twice - a second run adds nothing.
 */
export async function importExpensesAction(payload: string): Promise<ImportResult> {
  await requireOwner();

  let parsed: {
    mode: "recurring" | "dated";
    rows: ImportRow[];
    writeToOwnerLedger: boolean;
  };
  try {
    parsed = JSON.parse(payload);
  } catch {
    return { created: 0, skipped: 0, notes: [], error: "לא הצלחתי לקרוא את הנתונים שנשלחו" };
  }

  const rows = (parsed.rows ?? []).filter((r) => r.branchId && r.amount > 0);
  if (rows.length === 0) {
    return { created: 0, skipped: 0, notes: [], error: "אין שורות תקינות לייבוא" };
  }

  const db = getAdminFirestore();
  const notes: string[] = [];
  let created = 0;
  let skipped = 0;

  const branchIds = Array.from(new Set(rows.map((r) => r.branchId)));
  const branchDocs = await Promise.all(branchIds.map((id) => db.collection("n_branches").doc(id).get()));
  const branchById = new Map<string, Branch>();
  for (const d of branchDocs) {
    if (d.exists) branchById.set(d.id, { ...(d.data() as Omit<Branch, "id">), id: d.id } as Branch);
  }
  const nameOf = (id: string) => branchById.get(id)?.name ?? id;

  if (parsed.mode === "recurring") {
    // one recurring expense per branch: the amount repeats every month from the earliest month seen
    const byBranch = new Map<string, ImportRow[]>();
    for (const r of rows) {
      const arr = byBranch.get(r.branchId) ?? [];
      arr.push(r);
      byBranch.set(r.branchId, arr);
    }

    const existingSnap = await db.collection("n_fixed_expenses").get();
    const existing = existingSnap.docs.map((d) => d.data() as Omit<FixedExpense, "id">);

    for (const [branchId, list] of byBranch) {
      const name = list.find((r) => r.name)?.name || "שכירות";
      const amounts = Array.from(new Set(list.map((r) => r.amount)));
      const amount = amounts[0]!;
      const startDate = `${list.map((r) => r.when.slice(0, 7)).sort()[0]}-01`;

      const dup = existing.some(
        (e) => e.branchId === branchId && (e.name ?? "").trim() === name.trim() && (e.amount ?? 0) === amount,
      );
      if (dup) {
        skipped += 1;
        notes.push(`${nameOf(branchId)} — "${name}" ${money(amount)} כבר קיימת כהוצאה קבועה, דילגתי`);
        continue;
      }
      if (amounts.length > 1) {
        notes.push(
          `${nameOf(branchId)} — בקובץ יש כמה סכומים שונים (${amounts.map(money).join(", ")}); נרשם ${money(amount)}`,
        );
      }

      const data: Omit<FixedExpense, "id"> = {
        branchId,
        name,
        amount,
        startDate,
        category: "שכירות",
        paidBy: "owner",
      };
      await db.collection("n_fixed_expenses").add(data);
      created += 1;
    }
  } else {
    const existingSnap = await db.collection("n_var_expenses").get();
    const existing = existingSnap.docs.map((d) => d.data() as Omit<VariableExpense, "id">);

    for (const r of rows) {
      const date = r.when.length === 7 ? `${r.when}-01` : r.when;
      const month = date.slice(0, 7);
      const desc = r.name || r.category || "הוצאה";

      const dup = existing.some(
        (e) =>
          e.branchId === r.branchId &&
          (e.month ?? (e.date ?? "").slice(0, 7)) === month &&
          (e.amount ?? 0) === r.amount &&
          (e.desc ?? "").trim() === desc.trim(),
      );
      if (dup) {
        skipped += 1;
        notes.push(`${nameOf(r.branchId)} — "${desc}" ${money(r.amount)} ב-${month} כבר קיימת, דילגתי`);
        continue;
      }

      const branch = branchById.get(r.branchId);
      const business = branch?.branchType === "rentals" ? "rentals" : "computers";
      const linkedAhExpenseId = parsed.writeToOwnerLedger
        ? await createLinkedOwnerLedgerExpense({
            business,
            desc,
            amount: r.amount,
            paidBy: "owner",
            date,
          })
        : undefined;

      const data: Omit<VariableExpense, "id"> = {
        branchId: r.branchId,
        amount: r.amount,
        desc,
        date,
        month,
        paidBy: "owner",
        ...(r.category ? { category: r.category } : {}),
        ...(linkedAhExpenseId ? { linkedAhExpenseId } : {}),
      };
      await db.collection("n_var_expenses").add(data);
      created += 1;
    }
  }

  revalidatePath("/dashboard/accounting/overview");
  revalidatePath("/dashboard/accounting/import");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/rentals/expenses");

  return { created, skipped, notes };
}
