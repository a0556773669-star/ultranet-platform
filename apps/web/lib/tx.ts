/**
 * שכבה 1 — התנועה. Every shekel that moves, recorded exactly once (כלל 1).
 *
 * This module is the read model that seven separate expense/income sources collapse into:
 * n_ah_income, n_ah_expenses, n_var_expenses, n_fixed_expenses, n_multi_branch_expenses and
 * n_ad_areas all describe the same thing - money moved, this much of it is mine, it belongs to
 * these branches - and each of them existed only because the previous one couldn't express one
 * of those three facts. A Transaction expresses all three:
 *
 *   amount       - always the full sum, before any split
 *   ownerShare   - the owner's part in ₪, so a free percentage needs no separate collection
 *   allocations  - the per-branch split, so a multi-branch expense needs no separate collection
 *   recurring    - so a fixed monthly expense needs no separate collection
 *
 * Two consequences worth stating out loud, because they delete code rather than add it:
 *
 *  1. The owner's cash ledger (תזרים) becomes a QUERY over this model - `paidBy === "owner"`,
 *     summing `ownerShare` - instead of a collection that has to be kept in sync. That is what
 *     retires the "mirror" rows (VariableExpense.linkedAhExpenseId): a mirror was only ever a
 *     second copy of a row so it could be seen from a second angle, and a query sees it from
 *     any angle for free.
 *  2. Nothing needs migrating. Legacy documents are projected into this shape at read time
 *     (./tx-data.ts) - the same "filter instead of migrate" technique RETIRED_RATE_KEYS uses.
 *
 * Pure module on purpose (no firebase-admin import): the entry form is a client component and
 * imports the labels and the split preview from here. Loading lives in ./tx-data.ts.
 */
import type {
  Transaction,
  TxAllocation,
  TxBusiness,
  TxNature,
  TxNode,
  TxRecurring,
} from "@ultranet/shared-types";
import { monthsBetween } from "./branch-accounting";

export const TX_COLLECTION = "n_tx";

/** The whole-business node of a unit, used when the specific branch isn't known (see below). */
export const SHARED_NODE_ID = "shared";
/** The headquarters node: accountant, bank, software, car - costs that belong to no branch. */
export const HQ_NODE_ID = "hq";

export const TX_NATURE_LABEL: Record<TxNature, string> = {
  operating: "תפעולית",
  capital: "הונית",
  transfer: "העברה",
};

export const TX_NATURE_HELP: Record<TxNature, string> = {
  operating: "אינטרנט, סינון, פרסום, שכירות, הכנסות — נכנס לספר הסניף ומתחלק עם השותף",
  capital: "מחשבים, סטיקים, תיקים, הקמת חדר — נעצר בשכבת הנכסים, לא מתחלק עם אף אחד",
  transfer: "ההעברה החודשית מהשותף, העברה בין חשבונות — סילוק חוב, לא הכנסה ולא הוצאה",
};

export const TX_BUSINESS_LABEL: Record<TxBusiness, string> = {
  rentals: "השכרות ניידים",
  computers: "חדרי מחשבים",
  coworking: "משרד שיתופי",
  hq: "מטה",
};

/* ------------------------------------------------------------------ *
 * The three layer rules, as functions
 * ------------------------------------------------------------------ */

/**
 * כלל 7 — a capital transaction never enters a branch's operating book.
 * Equipment is the owner's own capital: it isn't split, isn't deducted from profit, and the
 * partner doesn't carry it. It is measured only in שכבה 2.
 *
 * כלל 8 — a transfer is neither income nor expense. Money arriving from the partner settles a
 * debt for income that is ALREADY recorded in the branch's book; counting it again is the exact
 * duplication the old model produced by auto-writing an n_ah_income row of type "laptops".
 */
export function affectsBranchBook(tx: Pick<Transaction, "nature">): boolean {
  return tx.nature === "operating";
}

/** Whether this transaction moved cash through the owner's own hands (the תזרים book). */
export function isOwnerCashMovement(tx: Pick<Transaction, "paidBy">): boolean {
  return (tx.paidBy ?? "owner") === "owner";
}

/**
 * Signed effect of one transaction on the owner's cash flow, in ₪.
 *
 * Money in is positive, money out negative. Only the owner's own share counts: an expense the
 * partner fronted never left the owner's account, and nets out of the month-end settlement
 * instead - the rule ownerLedgerExpenseAmount() already encodes for the legacy collections.
 */
export function ownerCashEffect(tx: Transaction): number {
  if (!isOwnerCashMovement(tx)) return 0;
  const share = tx.direction === "in" ? tx.amount : tx.ownerShare;
  return tx.direction === "in" ? share : -share;
}

/* ------------------------------------------------------------------ *
 * כלל 3 — the split always adds back up to the transaction
 * ------------------------------------------------------------------ */

/**
 * Forces Σ allocations === amount, to the shekel, with the rounding remainder landing on the
 * first branch. Rounding to whole shekels first and fixing the remainder afterwards is what
 * keeps "1,000 ₪ על 3 סניפים" from quietly becoming 999 - the same technique
 * attributeEntriesAction already uses.
 */
export function normalizeAllocations(amount: number, allocations: TxAllocation[]): TxAllocation[] {
  const rows = allocations.filter((a) => a.branchId);
  if (rows.length === 0) return [];
  const target = Math.round(amount);
  const rounded = rows.map((a) => ({ branchId: a.branchId, amount: Math.round(a.amount) }));
  const drift = target - rounded.reduce((sum, a) => sum + a.amount, 0);
  if (drift !== 0 && rounded[0]) rounded[0] = { ...rounded[0], amount: rounded[0].amount + drift };
  return rounded;
}

/** An even split across branches, used by the entry form's live preview. */
export function evenAllocations(amount: number, branchIds: string[]): TxAllocation[] {
  if (branchIds.length === 0) return [];
  const per = amount / branchIds.length;
  return normalizeAllocations(
    amount,
    branchIds.map((branchId) => ({ branchId, amount: per })),
  );
}

export function allocationsValid(tx: Pick<Transaction, "amount" | "allocations">): boolean {
  if (!tx.allocations || tx.allocations.length === 0) return true;
  const sum = tx.allocations.reduce((s, a) => s + (a.amount || 0), 0);
  return Math.abs(sum - tx.amount) <= 0.5;
}

/**
 * The branches this transaction touches, and by how much. A transaction with no explicit split
 * sits entirely on its own node - which for a real branch means that branch, and for `shared`
 * or `hq` means a parent node that carries the amount itself.
 *
 * That last case is deliberate and healthy (פרק ה׳): "תייג בצומת הנמוכה ביותר שאתה באמת יודע".
 * A parent node holding real sums beats an invented per-branch split every time.
 */
export function branchSlices(tx: Transaction): TxAllocation[] {
  if (tx.allocations && tx.allocations.length > 0) return tx.allocations;
  return [{ branchId: tx.node.branchId, amount: tx.amount }];
}

/** The owner's share of ONE branch's slice, in proportion to that slice. */
export function ownerShareOfSlice(tx: Transaction, slice: TxAllocation): number {
  if (tx.amount === 0) return 0;
  return (tx.ownerShare * slice.amount) / tx.amount;
}

/* ------------------------------------------------------------------ *
 * Recurring — a fixed monthly charge is a transaction, not a collection
 * ------------------------------------------------------------------ */

/**
 * The months a transaction actually charges, up to and including `uptoMonth`.
 *
 * A one-off charges exactly its own month. A recurring one charges every month from `from` to
 * `to` (or to today) - expanded at READ time, exactly the technique expandExpenseLines already
 * uses for n_fixed_expenses. That is the whole of what the separate fixed-expense collection did.
 */
export function txMonths(tx: Pick<Transaction, "month" | "recurring">, uptoMonth: string): string[] {
  const rec = tx.recurring;
  if (!rec?.from) return tx.month && tx.month <= uptoMonth ? [tx.month] : [];
  const end = rec.to && rec.to < uptoMonth ? rec.to : uptoMonth;
  if (end < rec.from) return [];
  return monthsBetween(rec.from, end);
}

export function chargesInMonth(tx: Pick<Transaction, "month" | "recurring">, month: string): boolean {
  const rec = tx.recurring;
  if (!rec?.from) return tx.month === month;
  if (rec.from > month) return false;
  if (rec.to && rec.to < month) return false;
  return true;
}

/* ------------------------------------------------------------------ *
 * Building a transaction
 * ------------------------------------------------------------------ */

export interface TxDraft {
  date: string;
  direction: Transaction["direction"];
  amount: number;
  nature: TxNature;
  business: TxBusiness;
  branchId: string;
  desc: string;
  category?: string;
  paidBy?: "owner" | "partner";
  /** the owner's share in ₪; defaults to the full amount (capital and hq costs are all his) */
  ownerShare?: number;
  allocations?: TxAllocation[];
  recurring?: TxRecurring | null;
  purchaseId?: string;
  doc?: string;
  note?: string;
}

/**
 * The owner's default share of a transaction, before any explicit override.
 * Capital is always 100% the owner's (כלל 7) - the partner never carries equipment.
 */
export function defaultOwnerShare(amount: number, nature: TxNature, hasPartner: boolean): number {
  if (nature === "capital") return amount;
  if (!hasPartner) return amount;
  return amount / 2;
}

export function buildTransaction(draft: TxDraft): Omit<Transaction, "id"> {
  const amount = Math.round(draft.amount);
  const node: TxNode = { business: draft.business, branchId: draft.branchId };
  const allocations = draft.allocations ? normalizeAllocations(amount, draft.allocations) : undefined;

  const tx: Omit<Transaction, "id"> = {
    date: draft.date,
    month: draft.date.slice(0, 7),
    direction: draft.direction,
    amount,
    nature: draft.nature,
    node,
    desc: draft.desc,
    ownerShare: Math.round(draft.ownerShare ?? amount),
    paidBy: draft.paidBy ?? "owner",
    createdAt: Date.now(),
  };
  if (draft.category) tx.category = draft.category;
  if (allocations && allocations.length > 0) tx.allocations = allocations;
  if (draft.recurring?.from) tx.recurring = draft.recurring;
  if (draft.purchaseId) tx.purchaseId = draft.purchaseId;
  if (draft.doc) tx.doc = draft.doc;
  if (draft.note) tx.note = draft.note;
  return tx;
}

/** Today's YYYY-MM. Lives here so client components can use it without pulling in a data module. */
export function currentMonthOf(): string {
  return new Date().toISOString().slice(0, 7);
}
