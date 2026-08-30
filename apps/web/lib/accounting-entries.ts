/**
 * One shared vocabulary for every money row the owner types by hand, so the entry screen
 * ("רישום ותנועות"), the attribution screen and the CRUD actions all describe the same thing.
 *
 * A movement is identified by two axes, and the pair picks the Firestore collection:
 *
 *                  | ledger (הנה"ח אישית)   | branch (ספר הסניף)
 *   ---------------+------------------------+---------------------
 *   income         | n_ah_income            | n_branch_income
 *   expense        | n_ah_expenses          | n_var_expenses
 *
 * "ledger" rows are book 1 of lib/accounting-overview.ts (money through the owner's own hands);
 * "branch" rows are book 2 (the branch's own operating book). The two books are never summed,
 * so a row lives in exactly one of them - attributing a row to a branch MOVES it, never copies.
 *
 * Deliberately free of any firebase-admin import: the entry list and the attribution table are
 * client components and import from here. The loader lives in ./accounting-entries-data.ts.
 */
import type { AccountingExpense, AccountingIncome, BranchIncome, VariableExpense } from "@ultranet/shared-types";

export type EntryKind = "income" | "expense";
export type EntryBook = "ledger" | "branch";

export function entryCollection(kind: EntryKind, book: EntryBook): string {
  if (kind === "income") return book === "branch" ? "n_branch_income" : "n_ah_income";
  return book === "branch" ? "n_var_expenses" : "n_ah_expenses";
}

/** One hand-entered money row, flattened out of whichever collection it came from. */
export interface MovementEntry {
  id: string;
  kind: EntryKind;
  book: EntryBook;
  desc: string;
  category?: string;
  date: string;
  amount: number;
  /** the branch this row belongs to (branch rows), or the branch typed on a ledger income row */
  branchId?: string;
  branchName?: string;
  /**
   * A ledger expense that is only a mirror of a branch expense - written automatically as the
   * owner's share when that expense was created (VariableExpense.linkedAhExpenseId).
   * It is not a separate transaction, so it must never be offered for attribution: attributing
   * it would charge the branch a second time for money already counted in its own book.
   */
  mirror?: boolean;
  /** ledger income only: "ניידים" / "מזומן" / "אשראי מהעסק", the form it was entered from */
  typeLabel?: string;
}

/**
 * A row still waiting to be filed to a branch: it sits in the owner's personal ledger and has
 * not been moved into any branch book. Mirror rows are excluded - they already belong to a
 * branch expense and only exist to record the owner's cash outflow.
 */
export function isPendingAttribution(e: MovementEntry): boolean {
  return e.book === "ledger" && !e.mirror;
}

/* ------------------------------------------------------------------ *
 * Shapes written when a row is created at, or moved into, a book
 * ------------------------------------------------------------------ */

export interface EntryFields {
  desc: string;
  category?: string;
  date: string;
  amount: number;
}

export function branchExpenseFrom(
  fields: EntryFields,
  branchId: string,
  extra: { paidBy?: string; owedBy?: string } = {},
): Omit<VariableExpense, "id"> {
  return {
    branchId,
    amount: fields.amount,
    desc: fields.desc || fields.category || "הוצאה",
    date: fields.date,
    month: fields.date.slice(0, 7),
    paidBy: extra.paidBy ?? "owner",
    ...(extra.owedBy ? { owedBy: extra.owedBy } : {}),
    ...(fields.category ? { category: fields.category } : {}),
  };
}

/**
 * `collectedByOwner: true` on purpose: the row is being moved out of the owner's own ledger,
 * which is where money that physically reached the owner is recorded. That flag is what the
 * partner settlement reads to know the cash is already in the owner's hands.
 */
export function branchIncomeFrom(
  fields: EntryFields,
  branchId: string,
  extra: { collectedByOwner?: boolean } = {},
): Omit<BranchIncome, "id"> {
  return {
    branchId,
    amount: fields.amount,
    desc: fields.desc || fields.category || "הכנסה",
    date: fields.date,
    month: fields.date.slice(0, 7),
    collectedByOwner: extra.collectedByOwner ?? true,
  };
}

export function ledgerExpenseFrom(fields: EntryFields): Omit<AccountingExpense, "id"> {
  return {
    date: fields.date,
    amount: fields.amount,
    desc: fields.desc || fields.category || "הוצאה",
    business: "general",
    month: fields.date.slice(0, 7),
    ...(fields.category ? { category: fields.category } : {}),
  };
}

export function ledgerIncomeFrom(fields: EntryFields): Omit<AccountingIncome, "id"> {
  return {
    date: fields.date,
    amount: fields.amount,
    desc: fields.desc || fields.category || "הכנסה",
    business: "general",
    type: "other",
    month: fields.date.slice(0, 7),
    ...(fields.category ? { category: fields.category } : {}),
  };
}
