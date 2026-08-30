/**
 * The unified transaction read model: n_tx plus every legacy collection projected into the same
 * shape, so "seven sources of expense" becomes one list without migrating a single document.
 *
 * WHY A PROJECTION AND NOT A MIGRATION
 * The live Firestore is the business's real books. Rewriting six collections into a seventh is
 * a one-way operation on real money records, and it buys nothing the projection doesn't already
 * give: a single list, one shape, one place to sum. New rows are written to n_tx; old rows keep
 * working exactly where they are and read back identically. It is the same technique
 * RETIRED_RATE_KEYS uses ("kept as a filter rather than a migration"), applied to whole
 * collections instead of two rate keys.
 *
 * WHAT THIS DELETES
 * Once the owner's cash ledger is a query over this model, the "mirror" rows
 * (VariableExpense.linkedAhExpenseId / MultiBranchExpense.linkedAhExpenseId) have no job left:
 * they existed only so a branch expense could ALSO be seen as owner cash-out, and the query sees
 * it from both angles with no second document. Existing mirrors are recognised here and dropped
 * from the model so they cannot be counted twice while they still sit in Firestore; new ones are
 * no longer written (see lib/branch-expense-ledger.ts).
 *
 * Likewise the auto-created "laptops" income rows behind a partner transfer are re-classified as
 * `nature: "transfer"` (כלל 8): they settle a debt for income already recorded in the branch's
 * book, so they are cash movement, never new income.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type {
  AccountingExpense,
  AccountingIncome,
  AdArea,
  Branch,
  BranchIncome,
  BranchTransfer,
  FixedExpense,
  MultiBranchExpense,
  Purchase,
  Transaction,
  TxBusiness,
  VariableExpense,
} from "@ultranet/shared-types";
import { ownerExpenseBurden } from "./branch-accounting";
import { HQ_NODE_ID, SHARED_NODE_ID, TX_COLLECTION, normalizeAllocations } from "./tx";
import { splitOf } from "./multi-branch-expense";
import { splitAdArea } from "./ad-areas";
import { PURCHASES_COLLECTION } from "./assets";
import { SHARED_COMPUTERS_BRANCH_ID, SHARED_RENTALS_BRANCH_ID } from "./expense-shared-scope";

/** Which collection a row in the model came from - shown in the UI so every number is traceable. */
export type TxSource =
  | "tx"
  | "ah_income"
  | "ah_expense"
  | "var_expense"
  | "fixed_expense"
  | "multi_branch"
  | "ad_area"
  | "branch_income"
  | "purchase"
  | "setup_cost";

export const TX_SOURCE_LABEL: Record<TxSource, string> = {
  tx: "תנועה",
  ah_income: "הכנסה בהנה\"ח האישית",
  ah_expense: "הוצאה בהנה\"ח האישית",
  var_expense: "הוצאה חד-פעמית בסניף",
  fixed_expense: "הוצאה קבועה בסניף",
  multi_branch: "הוצאה רב-סניפית",
  ad_area: "אזור פרסום",
  branch_income: "הכנסה בספר הסניף",
  purchase: "רכישה",
  setup_cost: "עלות הקמה",
};

export interface UnifiedTx extends Transaction {
  source: TxSource;
  /**
   * A legacy row that is only a second copy of another row in this same model, written so the
   * money could be seen from a second angle. Excluded from every total: the row it mirrors is
   * already here, and the model can be looked at from any angle without copies.
   */
  mirror?: boolean;
}

const doc = <T>(d: QueryDocumentSnapshot) => ({ ...(d.data() as Omit<T, "id">), id: d.id }) as T;

function businessOf(branch: Branch | undefined): TxBusiness {
  switch (branch?.branchType) {
    case "rentals":
      return "rentals";
    case "computers":
      return "computers";
    case "coworking":
      return "coworking";
    default:
      return "hq";
  }
}

/** The business unit a sentinel "all branches of this module" expense belongs to. */
function sharedBusinessOf(branchId: string): TxBusiness | null {
  if (branchId === SHARED_RENTALS_BRANCH_ID) return "rentals";
  if (branchId === SHARED_COMPUTERS_BRANCH_ID) return "computers";
  return null;
}

function nodeFor(branchId: string, branchById: Map<string, Branch>): { business: TxBusiness; branchId: string } {
  const shared = sharedBusinessOf(branchId);
  if (shared) return { business: shared, branchId: SHARED_NODE_ID };
  const branch = branchById.get(branchId);
  if (!branch) return { business: "hq", branchId: HQ_NODE_ID };
  return { business: businessOf(branch), branchId };
}

function branchHasPartner(branch: Branch | undefined): boolean {
  if (!branch) return false;
  if (branch.isMine) return false;
  const pct = branch.myPct ?? 100 - (branch.partnerPct ?? 0);
  return Number.isFinite(pct) ? pct < 100 : false;
}

export interface TransactionModel {
  /** every movement, native and projected, mirrors already removed */
  transactions: UnifiedTx[];
  /** the mirror rows that were dropped - the cleanup screen lists them */
  mirrors: UnifiedTx[];
  branches: Branch[];
  branchById: Map<string, Branch>;
  purchases: Purchase[];
}

/**
 * Loads every source and projects it into one list of transactions.
 *
 * Reading order matters in one place only: the mirror and transfer-income back-references are
 * collected first (they live on the branch-side documents), so the ledger-side rows they point
 * at can be classified correctly when they are projected.
 */
export async function loadTransactionModel(): Promise<TransactionModel> {
  const db = getAdminFirestore();
  const [
    txSnap,
    branchesSnap,
    ahIncomeSnap,
    ahExpenseSnap,
    varSnap,
    fixedSnap,
    multiSnap,
    adAreasSnap,
    transfersSnap,
    purchasesSnap,
    branchIncomeSnap,
  ] = await Promise.all([
    db.collection(TX_COLLECTION).get(),
    db.collection("n_branches").get(),
    db.collection("n_ah_income").get(),
    db.collection("n_ah_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_multi_branch_expenses").get(),
    db.collection("n_ad_areas").get(),
    db.collection("n_branch_transfers").get(),
    db.collection(PURCHASES_COLLECTION).get(),
    db.collection("n_branch_income").get(),
  ]);

  const branches = branchesSnap.docs.map((d) => doc<Branch>(d));
  const branchById = new Map(branches.map((b) => [b.id, b]));
  const purchases = purchasesSnap.docs.map((d) => doc<Purchase>(d));

  const varExpenses = varSnap.docs.map((d) => doc<VariableExpense>(d));
  const multiExpenses = multiSnap.docs.map((d) => doc<MultiBranchExpense>(d));
  const transfers = transfersSnap.docs.map((d) => doc<BranchTransfer>(d));

  // Back-references: which ledger rows are only copies of a branch row, and which "income" rows
  // are really a partner settling a debt.
  const mirrorExpenseIds = new Set<string>();
  for (const e of varExpenses) if (e.linkedAhExpenseId) mirrorExpenseIds.add(e.linkedAhExpenseId);
  for (const e of multiExpenses) if (e.linkedAhExpenseId) mirrorExpenseIds.add(e.linkedAhExpenseId);
  const transferIncomeIds = new Set<string>();
  for (const t of transfers) if (t.linkedAhIncomeId) transferIncomeIds.add(t.linkedAhIncomeId);

  const out: UnifiedTx[] = [];
  const mirrors: UnifiedTx[] = [];

  /* --- native transactions ------------------------------------------------ */
  for (const d of txSnap.docs) {
    out.push({ ...doc<Transaction>(d), source: "tx" });
  }

  /* --- n_ah_income: the owner's own ledger income -------------------------- */
  for (const d of ahIncomeSnap.docs) {
    const i = doc<AccountingIncome>(d);
    const amount = i.amount || 0;
    const node = i.branchId ? nodeFor(i.branchId, branchById) : { business: "hq" as TxBusiness, branchId: HQ_NODE_ID };
    out.push({
      id: i.id,
      source: "ah_income",
      date: i.date,
      month: i.month || (i.date ?? "").slice(0, 7),
      direction: "in",
      amount,
      // A transfer from the partner is not new income - the income it pays for is already in the
      // branch's book. Classifying it as `transfer` is what keeps the two books addable one day
      // without producing a phantom shekel (כלל 8).
      nature: transferIncomeIds.has(i.id) ? "transfer" : "operating",
      node,
      desc: i.desc || i.category || "הכנסה",
      category: i.category,
      paidBy: "owner",
      ownerShare: amount,
      createdAt: 0,
    });
  }

  /* --- n_ah_expenses: the owner's own ledger expenses ---------------------- */
  for (const d of ahExpenseSnap.docs) {
    const e = doc<AccountingExpense>(d);
    const amount = e.amount || 0;
    const business: TxBusiness =
      e.business === "rentals" || e.business === "computers" || e.business === "coworking" ? e.business : "hq";
    const row: UnifiedTx = {
      id: e.id,
      source: "ah_expense",
      date: e.date,
      month: e.month || (e.date ?? "").slice(0, 7),
      direction: "out",
      amount,
      nature: "operating",
      node: { business, branchId: business === "hq" ? HQ_NODE_ID : SHARED_NODE_ID },
      desc: e.desc || e.category || "הוצאה",
      category: e.category,
      paidBy: "owner",
      // A ledger expense row already holds the owner's OWN share (that is what
      // ownerLedgerExpenseAmount wrote into it), so amount and ownerShare are the same here.
      ownerShare: amount,
      createdAt: 0,
    };
    if (mirrorExpenseIds.has(e.id)) {
      mirrors.push({ ...row, mirror: true });
      continue;
    }
    out.push(row);
  }

  /* --- n_var_expenses: one-off branch expenses ----------------------------- */
  for (const e of varExpenses) {
    const amount = e.amount || 0;
    out.push({
      id: e.id,
      source: "var_expense",
      date: e.date,
      month: e.month || (e.date ?? "").slice(0, 7),
      direction: "out",
      amount,
      nature: "operating",
      node: nodeFor(e.branchId, branchById),
      desc: e.desc || "הוצאה חד פעמית",
      category: e.category,
      paidBy: e.paidBy === "partner" ? "partner" : "owner",
      ownerShare: ownerExpenseBurden(amount, e.owedBy),
      createdAt: 0,
    });
  }

  /* --- n_fixed_expenses: recurring branch expenses ------------------------- */
  for (const d of fixedSnap.docs) {
    const e = doc<FixedExpense>(d);
    if (!e.startDate) continue;
    const amount = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
    out.push({
      id: e.id,
      source: "fixed_expense",
      date: e.startDate,
      month: e.startDate.slice(0, 7),
      direction: "out",
      amount,
      nature: "operating",
      node: nodeFor(e.branchId, branchById),
      desc: e.name || "הוצאה קבועה",
      category: e.category,
      paidBy: e.paidBy === "partner" ? "partner" : "owner",
      ownerShare: ownerExpenseBurden(amount, e.owedBy),
      // The separate "fixed expenses" collection was only ever this field.
      recurring: { from: e.startDate.slice(0, 7), ...(e.endDate ? { to: e.endDate.slice(0, 7) } : {}) },
      createdAt: 0,
    });
  }

  /* --- n_multi_branch_expenses: one expense over several branches ---------- */
  for (const e of multiExpenses) {
    const split = splitOf(e);
    const allocations = normalizeAllocations(
      e.amount,
      (e.branchIds ?? []).map((branchId) => ({ branchId, amount: split.perBranchLineTotal })),
    );
    out.push({
      id: e.id,
      source: "multi_branch",
      date: e.date,
      month: e.month || (e.date ?? "").slice(0, 7),
      direction: "out",
      amount: e.amount || 0,
      nature: "operating",
      node: { business: "rentals", branchId: SHARED_NODE_ID },
      desc: e.desc || "הוצאה משותפת",
      category: e.category,
      paidBy: e.paidBy === "partner" ? "partner" : "owner",
      // The free percentage `owedBy` could not express - and the entire reason this collection
      // had to exist separately. As a plain ₪ share it needs no collection of its own.
      ownerShare: split.ownerTotal,
      allocations,
      createdAt: 0,
    });
  }

  /* --- n_ad_areas: a shared advertising campaign --------------------------- */
  // The same idea as the previous block, implemented a second time. In this model they are one
  // shape: an amount, a free owner percentage, and a list of branches to spread the rest over.
  for (const d of adAreasSnap.docs) {
    const area = doc<AdArea>(d);
    const split = splitAdArea(area);
    const allocations = normalizeAllocations(
      area.monthlyCost,
      (area.branchIds ?? []).map((branchId) => ({ branchId, amount: split.perBranchLineTotal })),
    );
    const from = area.startMonth || "2000-01";
    out.push({
      id: area.id,
      source: "ad_area",
      date: `${from}-01`,
      month: from,
      direction: "out",
      amount: area.monthlyCost || 0,
      nature: "operating",
      node: { business: "rentals", branchId: SHARED_NODE_ID },
      desc: `פרסום — ${area.name}`,
      category: "פרסום ושיווק",
      paidBy: area.paidBy === "partner" ? "partner" : "owner",
      ownerShare: split.ownerTotal,
      allocations,
      recurring: { from, ...(area.endMonth ? { to: area.endMonth } : {}) },
      createdAt: 0,
    });
  }

  /* --- n_branches.setupCost: a computer room's setup ----------------------- */
  // Capital, not expense (פרק י״ב): setting up a room is buying equipment, so it belongs in the
  // asset layer and below the bottom line - never inside the room's operating profit. A room
  // whose setup has been entered as a real purchase no longer projects this field, so converting
  // one does not double it.
  const convertedSetup = new Set(
    purchases.filter((p) => p.note?.startsWith("setupCost:")).map((p) => p.note!.slice("setupCost:".length)),
  );
  for (const b of branches) {
    if (b.branchType !== "computers" || !b.setupCost || convertedSetup.has(b.id)) continue;
    out.push({
      id: `setup__${b.id}`,
      source: "setup_cost",
      date: b.openedAt || b.founded || "2000-01-01",
      month: (b.openedAt || b.founded || "2000-01").slice(0, 7),
      direction: "out",
      amount: b.setupCost,
      nature: "capital",
      node: { business: "computers", branchId: b.id },
      desc: `הקמת ${b.name}`,
      paidBy: "owner",
      ownerShare: b.setupCost,
      createdAt: 0,
    });
  }

  /* --- n_branch_income: manual income in a branch's own book ---------------- */
  for (const d of branchIncomeSnap.docs) {
    const i = doc<BranchIncome>(d);
    const branch = branchById.get(i.branchId);
    const amount = i.amount || 0;
    const ownerPct = branch && branchHasPartner(branch) ? branch.myPct ?? 100 - (branch.partnerPct ?? 0) : 100;
    out.push({
      id: i.id,
      source: "branch_income",
      date: i.date,
      month: i.month || (i.date ?? "").slice(0, 7),
      direction: "in",
      amount,
      nature: "operating",
      node: nodeFor(i.branchId, branchById),
      desc: i.desc || "הכנסה",
      paidBy: i.collectedByOwner ? "owner" : "partner",
      ownerShare: (amount * ownerPct) / 100,
      createdAt: 0,
    });
  }

  out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return { transactions: out, mirrors, branches, branchById, purchases };
}
