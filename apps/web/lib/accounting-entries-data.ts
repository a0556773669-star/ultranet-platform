/**
 * Reads every hand-entered money row out of the four collections described in
 * ./accounting-entries.ts. Server-only (firebase-admin) - the client components import the
 * types and helpers from that file instead.
 */
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminFirestore } from "./firebase-admin";
import type { MovementEntry } from "./accounting-entries";
import type {
  AccountingExpense,
  AccountingIncome,
  Branch,
  BranchIncome,
  Transaction,
  VariableExpense,
} from "@ultranet/shared-types";
import { TX_COLLECTION, TX_NATURE_LABEL } from "./tx";

const INCOME_TYPE_LABELS: Record<string, string> = {
  laptops: "ניידים",
  credit: "אשראי מהעסק",
  cash: "מזומן",
  fixed: "קבוע",
  variable: "משתנה",
  other: "אחר",
};

const BUSINESS_LABELS: Record<string, string> = {
  computers: "מחשבים",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
  general: "כללי",
  other: "אחר",
};

export interface MovementsData {
  /** every hand-entered row from all four collections, newest first */
  entries: MovementEntry[];
  /** every branch, deleted ones included, so an old row still resolves a name */
  branches: Branch[];
  /** the branches a row may be filed to */
  liveBranches: Branch[];
}

/**
 * All four collections are read together on purpose: the entry screen has to show a row
 * wherever it currently lives, otherwise filing an expense to a branch looks exactly like a
 * save that silently failed.
 */
export async function loadMovements(): Promise<MovementsData> {
  const db = getAdminFirestore();
  const [ahIncomeSnap, ahExpenseSnap, branchIncomeSnap, varExpenseSnap, branchesSnap, txSnap] =
    await Promise.all([
      db.collection("n_ah_income").get(),
      db.collection("n_ah_expenses").get(),
      db.collection("n_branch_income").get(),
      db.collection("n_var_expenses").get(),
      db.collection("n_branches").get(),
      db.collection(TX_COLLECTION).get(),
    ]);

  const doc = <T>(d: QueryDocumentSnapshot) => ({ ...(d.data() as Omit<T, "id">), id: d.id }) as T;

  const branches = branchesSnap.docs.map((d) => doc<Branch>(d));
  const byId = new Map(branches.map((b) => [b.id, b.name || b.id]));
  const nameOf = (id?: string) => (id ? byId.get(id) ?? "סניף לא ידוע" : undefined);

  const varExpenses = varExpenseSnap.docs.map((d) => doc<VariableExpense>(d));
  const mirrored = new Set(
    varExpenses.map((e) => e.linkedAhExpenseId).filter((id): id is string => Boolean(id)),
  );

  const entries: MovementEntry[] = [
    ...ahIncomeSnap.docs
      .map((d) => doc<AccountingIncome>(d))
      .map((i) => ({
        id: i.id,
        kind: "income" as const,
        book: "ledger" as const,
        desc: i.desc || i.category || BUSINESS_LABELS[i.business] || "הכנסה",
        category: i.category,
        date: i.date ?? "",
        amount: i.amount ?? 0,
        branchId: i.branchId,
        branchName: nameOf(i.branchId),
        typeLabel: INCOME_TYPE_LABELS[i.type],
      })),
    ...branchIncomeSnap.docs
      .map((d) => doc<BranchIncome>(d))
      .map((i) => ({
        id: i.id,
        kind: "income" as const,
        book: "branch" as const,
        desc: i.desc || "הכנסה",
        date: i.date ?? "",
        amount: i.amount ?? 0,
        branchId: i.branchId,
        branchName: nameOf(i.branchId),
      })),
    ...ahExpenseSnap.docs
      .map((d) => doc<AccountingExpense>(d))
      .map((e) => ({
        id: e.id,
        kind: "expense" as const,
        book: "ledger" as const,
        desc: e.desc || e.category || BUSINESS_LABELS[e.business] || "הוצאה",
        category: e.category,
        date: e.date ?? "",
        amount: e.amount ?? 0,
        mirror: mirrored.has(e.id),
      })),
    ...varExpenses.map((e) => ({
      id: e.id,
      kind: "expense" as const,
      book: "branch" as const,
      desc: e.desc || e.category || "הוצאה",
      category: e.category,
      date: e.date ?? "",
      amount: e.amount ?? 0,
      branchId: e.branchId,
      branchName: nameOf(e.branchId),
    })),
    // The unified book. One collection for income and expense alike: a transaction already says
    // which it is, so the two-axis grid above collapses into a single destination.
    ...txSnap.docs
      .map((d) => doc<Transaction>(d))
      .map((t) => ({
        id: t.id,
        kind: (t.direction === "in" ? "income" : "expense") as "income" | "expense",
        book: "tx" as const,
        desc: t.desc || t.category || (t.direction === "in" ? "הכנסה" : "הוצאה"),
        category: t.category,
        date: t.date ?? "",
        amount: t.amount ?? 0,
        branchId: t.node?.branchId,
        branchName: nameOf(t.node?.branchId),
        natureLabel: TX_NATURE_LABEL[t.nature] ?? undefined,
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const liveBranches = branches
    .filter(
      (b) =>
        !b.deleted &&
        (b.branchType === "rentals" || b.branchType === "computers" || b.branchType === "coworking"),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return { entries, branches, liveBranches };
}
