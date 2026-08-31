/**
 * The unified accounting picture behind /dashboard/accounting/overview.
 *
 * TWO SEPARATE BOOKS, NEVER SUMMED TOGETHER - that's the whole anti-double-counting rule:
 *
 *  1. "שלי" - the owner's own ledger: exactly the rows the owner typed into n_ah_income /
 *     n_ah_expenses, nothing computed, nothing derived. This is the money that actually moved
 *     through the owner's hands.
 *  2. "הסניפים" - each branch's real operating book at 100%: what the branch took in and what
 *     it costs to run, regardless of whose pocket it passed through. Split per branch into
 *     ניידים (rentals) and חדרי מחשבים (computers).
 *
 * Cash that moved from a branch to the owner shows up in book 1 only once the owner logs it,
 * and stays in book 2 as branch income - the two are different questions, so adding them
 * would be meaningless, not just double counting. Every screen keeps them in separate columns.
 *
 * Inside book 2 each cost is counted from exactly one source, and there is only one source left:
 * the transaction itself. The price list (n_cost_rates) and the shared advertising areas
 * (n_ad_areas) are gone - both were separate ways of saying "a recurring cost, split somehow",
 * which a transaction already says on its own. With no second source there is nothing to
 * suppress, which is why the whole suppression mechanism went with them.
 */
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminFirestore } from "./firebase-admin";
import type {
  Branch,
  Laptop,
  Stick,
  Rental,
  BranchIncome,
  FixedExpense,
  VariableExpense,
  CollectionRoute,
} from "@ultranet/shared-types";
import {
  ownerExpenseBurden,
  expenseNetToOwnerFromShares,
  isCollectedByOwner,
  incomeShareToOwner,
  type RentalIncomeLine,
} from "./branch-accounting";
import { ITEM_KIND_LABEL, investmentByLocation, type LocationInvestment } from "./assets";
import { loadAssets, type AssetsData } from "./assets-data";
import { loadTransactionModel, type TransactionModel, type UnifiedTx } from "./tx-data";
import { chargesInMonth } from "./tx";

export type OwedBy = "owner" | "partner" | "shared";
export type PaidBy = "owner" | "partner";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** The `count` months ending at (and including) `endMonth`, oldest first. */
export function monthsEndingAt(endMonth: string, count = 12): string[] {
  const [ey, em] = endMonth.split("-").map(Number);
  if (!ey || !em) return [];
  const out: string[] = [];
  let y = ey;
  let m = em;
  for (let i = 0; i < count; i++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/**
 * The two books the business is kept in. They are never summed together: a branch belongs to
 * exactly one of them, so the same shekel cannot appear in both.
 *  - "rentals" - laptop rental branches
 *  - "rooms"   - computer rooms and the coworking office
 */
export type AccountingBook = "rentals" | "rooms";

export const BOOK_LABEL: Record<AccountingBook, string> = {
  rentals: 'הנה"ח ניידים',
  rooms: 'הנה"ח חדרי מחשבים ומשרד שיתופי',
};
export const BOOK_SHORT: Record<AccountingBook, string> = {
  rentals: "ניידים",
  rooms: "חדרים + משרד שיתופי",
};

export function bookOf(b: Branch): AccountingBook {
  return b.branchType === "rentals" ? "rentals" : "rooms";
}

export function branchOwnerPct(b: Branch): number {
  if (b.isMine) return 100;
  const pct = b.myPct ?? 100 - (b.partnerPct ?? 0);
  return Number.isFinite(pct) ? pct : 100;
}
export function branchHasPartner(b: Branch): boolean {
  return branchOwnerPct(b) < 100;
}
export function branchPartnerLabel(b: Branch): string {
  return b.partnerName?.trim() || "השותף";
}

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export interface Bucket {
  income: number;
  expense: number;
  profit: number;
}
const emptyBucket = (): Bucket => ({ income: 0, expense: 0, profit: 0 });

export interface MyEntry {
  id: string;
  date: string;
  label: string;
  category?: string;
  amount: number;
}

export interface MyMonth {
  month: string;
  income: MyEntry[];
  expenses: MyEntry[];
  incomeTotal: number;
  expenseTotal: number;
  profit: number;
}

export interface CostLine {
  key: string;
  label: string;
  qty: number;
  unitCost: number;
  total: number;
  owedBy: OwedBy;
  paidBy: PaidBy;
  kind: "once" | "monthly";
  /** where the number came from, so the screen can say so out loud */
  source: "rate" | "fixed" | "variable";
  qtyNote: string;
  /** overrides the "על מי ההוצאה" pill text for splits `owedBy` can't express (e.g. 70/30) */
  owedLabel?: string;
  ownerShare: number;
  partnerShare: number;
  /** positive = the partner owes this to the owner; negative = the owner owes the partner */
  netToOwner: number;
}

/**
 * Whether a branch is even open in a given month:
 *  - "active"       - the branch is running, everything is calculated as usual
 *  - "before_open"  - the month is earlier than the branch's opening date: nothing is calculated
 *  - "not_started"  - the branch has no opening date and not a single data row yet, so there is
 *                     nothing to calculate from and no cost may be charged to it
 */
export type BranchMonthStatus = "active" | "before_open" | "not_started" | "after_close";

/** Where a branch's start month came from - shown on the branch-status screen. */
export type BranchStartSource = "manual_not_started" | "opened_at" | "first_data" | "none";

/** When a branch's book opens, and whether it has any income life in it yet. */
export interface BranchActivity {
  /** the opening date the owner set on the branch (n_branches.openedAt / legacy founded) */
  openedDate: string | null;
  openedMonth: string | null;
  /** the first month with any real data, used only when no opening date was set */
  firstDataMonth: string | null;
  /** the month every calculation starts from; null = the branch never started */
  startMonth: string | null;
  startSource: BranchStartSource;
  /** the owner marked this branch "not started yet" by hand - overrides any data in it */
  manuallyNotStarted: boolean;
  /** true when the owner set no opening date - the screens ask for one */
  missingOpenedAt: boolean;
  /** true when not one rental and not one income row was ever entered for this branch */
  noIncomeYet: boolean;
  /** the business closing date the owner set (n_branches.closedAt), not the technical deletedAt */
  closedDate: string | null;
  closedMonth: string | null;
  /** ready-made Hebrew badge for the screens, null when the branch is running normally */
  statusLabel: string | null;
}

export interface BranchMonth {
  branchId: string;
  month: string;
  status: BranchMonthStatus;
  income: number;
  expense: number;
  profit: number;
  margin: number;
  ownerIncome: number;
  ownerExpense: number;
  ownerProfit: number;
  /** net of the month's expense lines between owner and partner */
  expenseNet: number;
  /** what the partner transfers to the owner on the 1st (0 when there's no partner) */
  transferToOwner: number;
  /**
   * false = there is no transfer to compute, and the screens must show it blank rather than 0.
   * A branch that has not started yet still carries real costs (equipment already bought,
   * expenses already entered) but has no income to settle against, so "0 to transfer" would be
   * a made-up answer to a question that cannot be asked yet. Also false when there is no partner.
   */
  transferAvailable: boolean;
  /** the income half of `transferToOwner` - the owner's share of what the branch collected */
  transferIncomePart: number;
  /** labels of the expense lines that actually move money between owner and partner, so a screen
   *  can answer "the 300 ₪ - based on what?" without opening the full cost table */
  transferDrivers: string[];
  lines: CostLine[];
}

export interface OverviewMonthRow {
  month: string;
  mine: Bucket;
  rentals: Bucket;
  rooms: Bucket;
  branches: Bucket;
  transferToOwner: number;
}

export interface OverviewData {
  months: string[];
  branches: Branch[];
  myByMonth: Map<string, MyMonth>;
  branchMonths: Map<string, BranchMonth>;
  /** branchId -> when its book opens and whether it has started taking money in */
  activityByBranch: Map<string, BranchActivity>;
  /** branchId -> cumulative equipment investment, valued from the asset layer (שכבה 2) */
  investmentByBranch: Map<string, CostLine[]>;
  /** false while no purchase has been entered yet - the screens then ask for one */
  hasAssetLayer: boolean;
  /**
   * The two heavy loads this function already performed, handed back rather than thrown away.
   *
   * Every screen that shows the overview also needs one or both of them - the branch page for its
   * payback card, the overview page for its all-time strip - and re-loading them meant reading
   * every collection two or three more times in the SAME request. They cost nothing to return and
   * they are the single biggest reason the accounting screens were slow.
   */
  model: TransactionModel;
  assets: AssetsData;
  rows: OverviewMonthRow[];
}

const key = (branchId: string, month: string) => `${branchId}|${month}`;

/* ------------------------------------------------------------------ *
 * Splitting one expense between owner and partner
 * ------------------------------------------------------------------ */

function makeLine(
  input: Omit<CostLine, "ownerShare" | "partnerShare" | "netToOwner">,
  /** the owner's share, when it isn't the plain owner/partner/50-50 that `owedBy` encodes */
  ownerShareOverride?: number,
): CostLine {
  const ownerShare = ownerShareOverride ?? ownerExpenseBurden(input.total, input.owedBy);
  return {
    ...input,
    ownerShare,
    partnerShare: input.total - ownerShare,
    netToOwner: expenseNetToOwnerFromShares(input.total, ownerShare, input.paidBy),
  };
}

/* ------------------------------------------------------------------ *
 * Loader
 * ------------------------------------------------------------------ */

interface RawData {
  branches: Branch[];
  laptopsByBranch: Map<string, Laptop[]>;
  sticksByBranch: Map<string, Stick[]>;
  rentalsByBranch: Map<string, Rental[]>;
  branchIncomeByBranch: Map<string, BranchIncome[]>;
  fixedByBranch: Map<string, FixedExpense[]>;
  variableByBranch: Map<string, VariableExpense[]>;
  routesById: Map<string, CollectionRoute>;
  /** the unified transaction model - the flow book is derived from it, never stored */
  transactions: UnifiedTx[];
  model: TransactionModel;
  assets: AssetsData;
  /** שכבה 2: real per-branch investment, from where the items physically are */
  investmentByBranch: Map<string, LocationInvestment>;
  /** true once at least one real purchase exists - before that, there is nothing to show */
  hasAssetLayer: boolean;
}

function groupBy<T extends { branchId: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const arr = map.get(item.branchId) ?? [];
    arr.push(item);
    map.set(item.branchId, arr);
  }
  return map;
}

async function loadRaw(): Promise<RawData> {
  const db = getAdminFirestore();
  const [
    branchesSnap,
    laptopsSnap,
    sticksSnap,
    rentalsSnap,
    branchIncomeSnap,
    fixedSnap,
    variableSnap,
    routesSnap,
    model,
    assets,
  ] = await Promise.all([
    db.collection("n_branches").get(),
    db.collection("n_laptops").get(),
    db.collection("n_sticks").get(),
    db.collection("n_rentals").get(),
    db.collection("n_branch_income").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection("n_collection_routes").get(),
    loadTransactionModel(),
    loadAssets(),
  ]);

  const doc = <T>(d: QueryDocumentSnapshot) => ({ ...(d.data() as Omit<T, "id">), id: d.id }) as T;

  const routesById = new Map<string, CollectionRoute>();
  for (const d of routesSnap.docs) routesById.set(d.id, doc<CollectionRoute>(d));

  return {
    branches: branchesSnap.docs.map((d) => doc<Branch>(d)),
    laptopsByBranch: groupBy(laptopsSnap.docs.map((d) => doc<Laptop>(d))),
    sticksByBranch: groupBy(sticksSnap.docs.map((d) => doc<Stick>(d))),
    rentalsByBranch: groupBy(rentalsSnap.docs.map((d) => doc<Rental>(d))),
    branchIncomeByBranch: groupBy(branchIncomeSnap.docs.map((d) => doc<BranchIncome>(d))),
    fixedByBranch: groupBy(fixedSnap.docs.map((d) => doc<FixedExpense>(d))),
    variableByBranch: groupBy(variableSnap.docs.map((d) => doc<VariableExpense>(d))),
    routesById,
    transactions: model.transactions,
    model,
    assets,
    investmentByBranch: investmentByLocation(assets.items),
    hasAssetLayer: assets.items.length > 0,
  };
}

/* ------------------------------------------------------------------ *
 * Book 1 - the owner's own ledger ("שלי")
 * ------------------------------------------------------------------ */

const monthOf = (row: { month?: string; date?: string }) => row.month || (row.date ?? "").slice(0, 7);

/**
 * The flow book, derived from the transaction model instead of read out of n_ah_income /
 * n_ah_expenses.
 *
 * The difference is not cosmetic. Read from those two collections, this book only ever showed
 * rows the owner had typed there - which is exactly why a copy of every branch expense had to be
 * written into it (the mirror mechanism), why recurring expenses could not be copied at all, and
 * why several screens each added their own correction on top. Derived, it shows the owner's real
 * cash position from the movements themselves, with no copies and nothing to keep in sync.
 *
 * Capital and transfers are excluded on purpose: equipment is not an expense (כלל 7) and a
 * settlement is not income (כלל 8). Both are shown in their own right on the bottom-line screen.
 */
function buildMyLedger(months: string[], transactions: UnifiedTx[]): Map<string, MyMonth> {
  const map = new Map<string, MyMonth>();
  for (const m of months) {
    map.set(m, { month: m, income: [], expenses: [], incomeTotal: 0, expenseTotal: 0, profit: 0 });
  }

  for (const tx of transactions) {
    // Only money that physically moved through the owner's own hands.
    if ((tx.paidBy ?? "owner") !== "owner") continue;
    if (tx.nature !== "operating") continue;

    for (const m of months) {
      if (!chargesInMonth(tx, m)) continue;
      const bucket = map.get(m)!;
      // Income counts in full (it reached the owner); an expense counts only at the owner's own
      // share, since the rest is the partner's cost even when the owner fronted the cash.
      const amount = tx.direction === "in" ? tx.amount : tx.ownerShare;
      if (amount <= 0) continue;
      const entry: MyEntry = {
        id: `${tx.source}:${tx.id}:${m}`,
        date: tx.recurring?.from ? `${m}-01` : tx.date,
        label: tx.category || tx.desc || (tx.direction === "in" ? "הכנסה" : "הוצאה"),
        category: tx.category,
        amount,
      };
      if (tx.direction === "in") {
        bucket.income.push(entry);
        bucket.incomeTotal += amount;
      } else {
        bucket.expenses.push(entry);
        bucket.expenseTotal += amount;
      }
    }
  }

  for (const bucket of map.values()) {
    bucket.profit = bucket.incomeTotal - bucket.expenseTotal;
    bucket.income.sort((a, b) => b.amount - a.amount);
    bucket.expenses.sort((a, b) => b.amount - a.amount);
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * Book 2 - a branch's own operating book
 * ------------------------------------------------------------------ */

/**
 * When this branch's book opens.
 *
 * The opening date the owner set wins over everything: months before it are not calculated at all,
 * so a branch that opened in June is never billed for May. With no date set we fall back to the
 * first month that has a real data row in it.
 *
 * A branch with neither - no opening date and no data whatsoever - is NOT treated as "open since
 * forever". It gets no monthly price-list line and no partner transfer, because there is nothing
 * to base them on; the screens show it as "לא התחיל השכרות" until customers and rentals are
 * entered, and from that moment the calculation starts on its own.
 */
function computeBranchActivity(b: Branch, raw: RawData): BranchActivity {
  const openedDate = b.openedAt?.trim() || b.founded?.trim() || null;
  const openedMonth = openedDate && /^\d{4}-\d{2}/.test(openedDate) ? openedDate.slice(0, 7) : null;

  const rentals = raw.rentalsByBranch.get(b.id) ?? [];
  const incomeRows = raw.branchIncomeByBranch.get(b.id) ?? [];

  // With no opening date set, INCOME is what starts a branch's book - not expenses.
  // Buying equipment for a branch, or entering a cost against it, does not mean it is running.
  // Letting an expense start the book was charging branches that had never taken a shekel in:
  // the recurring price list (SIMs, advertising) was billed to them every month since that first
  // expense, and the offsets on those invented lines even produced a transfer owed to the owner
  // by a branch the screen itself labelled "לא התחיל השכרות".
  const candidates: string[] = [];
  for (const r of rentals) {
    if (r.returnDate) candidates.push(r.returnDate.slice(0, 7));
  }
  for (const i of incomeRows) candidates.push(monthOf(i));
  const valid = candidates.filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  const firstDataMonth = valid[0] ?? null;

  const noIncomeYet = rentals.length === 0 && incomeRows.length === 0;

  // The manual "hasn't started operating yet" mark wins over everything, including data that was
  // already entered into the branch - that's the whole point of it: a branch that exists on paper
  // but isn't working yet must not be charged for anything, whatever happens to sit in it.
  const manuallyNotStarted = b.notStarted === true;
  // An opening date that the owner typed IS the statement that the branch is open: from that
  // month on it has a book of its own, even before the first shekel comes in. That is the whole
  // reason the field exists - a branch that pays rent and SIMs from the day it opened must carry
  // those months itself, not sit in limbo until income appears. Only the manual
  // "עדיין לא התחיל לפעול" mark - which only the owner can set - holds a dated branch back.
  // Without a date we still need income before opening the book, since an expense alone says
  // nothing about whether the branch is running.
  // The business closing date, which is NOT `deletedAt`: a branch that closed on 15 July and was
  // only marked deleted in September must stop accruing from July, or it collects two months of
  // internet, filtering and advertising it never used - the exact failure `openedAt` already
  // fixed at the other end (פרק טו׳).
  const closedDate = b.closedAt?.trim() || null;
  const closedMonth = closedDate && /^\d{4}-\d{2}/.test(closedDate) ? closedDate.slice(0, 7) : null;

  const startMonth = manuallyNotStarted ? null : openedMonth ?? firstDataMonth;
  const startSource: BranchStartSource = manuallyNotStarted
    ? "manual_not_started"
    : !startMonth
      ? "none"
      : openedMonth
        ? "opened_at"
        : "first_data";

  let statusLabel: string | null = null;
  if (closedMonth) {
    statusLabel = `נסגר ב-${closedMonth}`;
  } else if (!startMonth) {
    statusLabel = b.branchType === "rentals" ? "לא התחיל השכרות" : "עדיין לא התחיל לפעול";
  } else if (noIncomeYet) {
    statusLabel = b.branchType === "rentals" ? "לא התחיל השכרות" : "עדיין אין הכנסות";
  }

  return {
    openedDate,
    openedMonth,
    firstDataMonth,
    startMonth,
    startSource,
    manuallyNotStarted,
    missingOpenedAt: !openedMonth,
    noIncomeYet,
    closedDate,
    closedMonth,
    statusLabel,
  };
}

function monthStatus(activity: BranchActivity, month: string): BranchMonthStatus {
  if (!activity.startMonth) return "not_started";
  if (activity.startMonth > month) return "before_open";
  // Months after the branch closed are calculated exactly like months before it opened: nothing.
  if (activity.closedMonth && month > activity.closedMonth) return "after_close";
  return "active";
}

/** An untouched month: the branch isn't open yet, so nothing is income, expense or owed. */
function emptyBranchMonth(branchId: string, month: string, status: BranchMonthStatus): BranchMonth {
  return {
    branchId,
    month,
    status,
    income: 0,
    expense: 0,
    profit: 0,
    margin: 0,
    ownerIncome: 0,
    ownerExpense: 0,
    ownerProfit: 0,
    expenseNet: 0,
    transferToOwner: 0,
    transferAvailable: false,
    transferIncomePart: 0,
    transferDrivers: [],
    lines: [],
  };
}

function branchIncomeLines(b: Branch, raw: RawData, month: string): RentalIncomeLine[] {
  const lines: RentalIncomeLine[] = [];
  if (b.branchType === "rentals") {
    for (const r of raw.rentalsByBranch.get(b.id) ?? []) {
      // same rule as lib/branch-accounting-data.ts: only money actually collected counts
      if (r.status !== "returned" || !r.returnDate || !r.paid) continue;
      if (r.returnDate.slice(0, 7) !== month) continue;
      const route = r.collectionRouteId ? raw.routesById.get(r.collectionRouteId) ?? null : null;
      lines.push({
        amount: r.finalPrice ?? r.calcPrice ?? 0,
        collectedByOwner: isCollectedByOwner(r.paymentMethod, route),
      });
    }
  }
  for (const i of raw.branchIncomeByBranch.get(b.id) ?? []) {
    if (monthOf(i) !== month) continue;
    lines.push({ amount: i.amount || 0, collectedByOwner: i.collectedByOwner ?? false });
  }
  return lines;
}

/**
 * A month for a branch that is not running yet.
 *
 * Costs the owner has genuinely already paid still count - an expense typed against the branch,
 * and equipment bought for it. What is NOT invented is the recurring price-list charge (rent,
 * SIMs, advertising for a branch that isn't open yet) and, above all, the transfer: with no
 * income there is nothing to settle, so `transferAvailable` is false and the screens leave that
 * line blank instead of showing a confident 0.
 */
/**
 * A month in which the branch is not running - either not open yet, or already closed.
 *
 * Costs the owner genuinely incurred still count (an expense typed against the branch, equipment
 * already bought), because they really happened. What is NOT invented is the recurring price-list
 * charge and, above all, the transfer: with no income there is nothing to settle, so
 * `transferAvailable` stays false and the screens leave the line blank rather than showing a
 * confident 0.
 */
function preOpenBranchMonth(b: Branch, raw: RawData, month: string, status: BranchMonthStatus): BranchMonth {
  const hasPartner = branchHasPartner(b);
  const lines: CostLine[] = [];

  // Hand-entered recurring costs count too - the owner typed them against this branch on purpose.
  // Only the PRICE-LIST lines are withheld, since those would be charges nobody actually made.
  for (const e of raw.fixedByBranch.get(b.id) ?? []) {
    if (!e.startDate || e.startDate.slice(0, 7) > month) continue;
    if (e.endDate && e.endDate.slice(0, 7) < month) continue;
    const amount = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
    if (!amount) continue;
    lines.push(
      makeLine({
        key: "fixed",
        label: e.name || "הוצאה קבועה",
        qty: 1,
        unitCost: amount,
        total: amount,
        owedBy: hasPartner ? ((e.owedBy as OwedBy) ?? "owner") : "owner",
        paidBy: hasPartner ? ((e.paidBy as PaidBy) ?? "owner") : "owner",
        kind: "monthly",
        source: "fixed",
        qtyNote: e.category || "הוצאה קבועה שהוזנה ידנית",
      }),
    );
  }

  for (const e of raw.variableByBranch.get(b.id) ?? []) {
    if (monthOf(e) !== month) continue;
    const amount = e.amount || 0;
    if (!amount) continue;
    lines.push(
      makeLine({
        key: "variable",
        label: e.desc || "הוצאה חד פעמית",
        qty: 1,
        unitCost: amount,
        total: amount,
        owedBy: hasPartner ? ((e.owedBy as OwedBy) ?? "owner") : "owner",
        paidBy: hasPartner ? ((e.paidBy as PaidBy) ?? "owner") : "owner",
        kind: "once",
        source: "variable",
        qtyNote: e.category || "הוצאה שהוזנה ידנית לפני פתיחת הסניף",
      }),
    );
  }

  const expense = lines.reduce((s, l) => s + l.total, 0);
  const ownerExpense = lines.reduce((s, l) => s + l.ownerShare, 0);
  return {
    ...emptyBranchMonth(b.id, month, status),
    expense,
    profit: -expense,
    ownerExpense,
    ownerProfit: -ownerExpense,
    expenseNet: lines.reduce((s, l) => s + l.netToOwner, 0),
    lines,
  };
}

function computeBranchMonth(b: Branch, raw: RawData, activity: BranchActivity, month: string): BranchMonth {
  const status = monthStatus(activity, month);
  // Not running yet (or already closed): real costs still count, the transfer does not.
  if (status !== "active") return preOpenBranchMonth(b, raw, month, status);

  const hasPartner = branchHasPartner(b);
  const ownerPct = branchOwnerPct(b);
  const lines: CostLine[] = [];

  // --- hand-entered branch expenses: always counted, they are the source of truth ---
  for (const e of raw.fixedByBranch.get(b.id) ?? []) {
    if (!e.startDate || e.startDate.slice(0, 7) > month) continue;
    if (e.endDate && e.endDate.slice(0, 7) < month) continue;
    const amount = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
    if (!amount) continue;
    lines.push(
      makeLine({
        key: "fixed",
        label: e.name || "הוצאה קבועה",
        qty: 1,
        unitCost: amount,
        total: amount,
        owedBy: hasPartner ? ((e.owedBy as OwedBy) ?? "owner") : "owner",
        paidBy: hasPartner ? ((e.paidBy as PaidBy) ?? "owner") : "owner",
        kind: "monthly",
        source: "fixed",
        qtyNote: e.category || "הוצאה קבועה שהוזנה ידנית",
      }),
    );
  }
  for (const e of raw.variableByBranch.get(b.id) ?? []) {
    if (monthOf(e) !== month) continue;
    const amount = e.amount || 0;
    if (!amount) continue;
    lines.push(
      makeLine({
        key: "variable",
        label: e.desc || "הוצאה חד פעמית",
        qty: 1,
        unitCost: amount,
        total: amount,
        owedBy: hasPartner ? ((e.owedBy as OwedBy) ?? "owner") : "owner",
        paidBy: hasPartner ? ((e.paidBy as PaidBy) ?? "owner") : "owner",
        kind: "once",
        source: "variable",
        qtyNote: e.category || "הוצאה חד פעמית שהוזנה ידנית",
      }),
    );
  }

  const incomeLines = branchIncomeLines(b, raw, month);
  const income = incomeLines.reduce((s, l) => s + l.amount, 0);
  const expense = lines.reduce((s, l) => s + l.total, 0);
  const ownerExpense = lines.reduce((s, l) => s + l.ownerShare, 0);
  const expenseNet = lines.reduce((s, l) => s + l.netToOwner, 0);
  const ownerIncome = (income * ownerPct) / 100;
  const transferIncomePart = hasPartner ? incomeShareToOwner(incomeLines, ownerPct) : 0;
  const transferDrivers = hasPartner
    ? lines.filter((l) => Math.abs(l.netToOwner) >= 1).map((l) => l.label)
    : [];

  return {
    branchId: b.id,
    month,
    status,
    income,
    expense,
    profit: income - expense,
    margin: income ? (income - expense) / income : 0,
    ownerIncome,
    ownerExpense,
    ownerProfit: ownerIncome - ownerExpense,
    expenseNet,
    transferToOwner: hasPartner ? transferIncomePart + expenseNet : 0,
    transferAvailable: hasPartner,
    transferIncomePart,
    transferDrivers,
    lines,
  };
}

/**
 * Cumulative equipment investment in a branch — from the asset layer, not from the price list.
 *
 * This used to multiply a flat estimate ("every computer costs 1,200 ₪") by a derived quantity,
 * which is why a real 15,000 ₪ invoice could never be reconciled against what the branches
 * showed. Now each line is the sum of what the units of that kind ACTUALLY cost on their own
 * invoices, summed over the units physically located in this branch. Equipment is capital, so
 * `owedBy` is always the owner and `netToOwner` is always 0: it never splits with a partner and
 * never enters the branch's operating book (כלל 7).
 */
function computeInvestment(b: Branch, raw: RawData): CostLine[] {
  const investment = raw.investmentByBranch.get(b.id);
  if (!investment) return [];
  const out: CostLine[] = [];
  for (const [kind, total] of Object.entries(investment.totalByKind)) {
    const qty = investment.countByKind[kind as keyof typeof investment.countByKind];
    if (!qty || !total) continue;
    out.push(
      makeLine({
        key: `item_${kind}`,
        label: ITEM_KIND_LABEL[kind as keyof typeof ITEM_KIND_LABEL],
        qty,
        unitCost: total / qty,
        total,
        owedBy: "owner",
        paidBy: "owner",
        kind: "once",
        source: "rate",
        qtyNote: "עלות אמיתית מחשבוניות הרכש, לפי הפריטים שנמצאים בסניף",
      }),
    );
  }
  return out.sort((a, b2) => b2.total - a.total);
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

export async function loadAccountingOverview(endMonth: string, monthCount = 12): Promise<OverviewData> {
  const raw = await loadRaw();
  const months = monthsEndingAt(endMonth, monthCount);

  const branches = raw.branches
    .filter(
      (b) =>
        !b.deleted &&
        (b.branchType === "rentals" || b.branchType === "computers" || b.branchType === "coworking"),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const myByMonth = buildMyLedger(months, raw.transactions);

  const activityByBranch = new Map<string, BranchActivity>();
  const branchMonths = new Map<string, BranchMonth>();
  for (const b of branches) {
    const activity = computeBranchActivity(b, raw);
    activityByBranch.set(b.id, activity);
    for (const m of months) {
      branchMonths.set(key(b.id, m), computeBranchMonth(b, raw, activity, m));
    }
  }

  const investmentByBranch = new Map<string, CostLine[]>();
  for (const b of branches) {
    investmentByBranch.set(b.id, computeInvestment(b, raw));
  }

  const rows: OverviewMonthRow[] = months.map((m) => {
    const my = myByMonth.get(m)!;
    const rentals = emptyBucket();
    const rooms = emptyBucket();
    let transferToOwner = 0;
    for (const b of branches) {
      const s = branchMonths.get(key(b.id, m))!;
      const bucket = b.branchType === "rentals" ? rentals : rooms;
      bucket.income += s.income;
      bucket.expense += s.expense;
      transferToOwner += s.transferToOwner;
    }
    rentals.profit = rentals.income - rentals.expense;
    rooms.profit = rooms.income - rooms.expense;
    return {
      month: m,
      mine: { income: my.incomeTotal, expense: my.expenseTotal, profit: my.profit },
      rentals,
      rooms,
      branches: {
        income: rentals.income + rooms.income,
        expense: rentals.expense + rooms.expense,
        profit: rentals.profit + rooms.profit,
      },
      transferToOwner,
    };
  });

  return {
    months,
    branches,
    hasAssetLayer: raw.hasAssetLayer,
    model: raw.model,
    assets: raw.assets,
    myByMonth,
    branchMonths,
    activityByBranch,
    investmentByBranch,
    rows,
  };
}

export function branchMonthOf(data: OverviewData, branchId: string, month: string): BranchMonth | undefined {
  return data.branchMonths.get(key(branchId, month));
}

export function branchActivityOf(data: OverviewData, branchId: string): BranchActivity | undefined {
  return data.activityByBranch.get(branchId);
}

/** Hebrew month label for a start/opening month, e.g. "06/2026". */
export function monthLabelLong(month: string): string {
  return `${month.slice(5)}/${month.slice(0, 4)}`;
}

/** Every month a branch has a row for, oldest first (used by the per-branch report). */
export function branchSeries(data: OverviewData, branchId: string): BranchMonth[] {
  return data.months
    .map((m) => data.branchMonths.get(key(branchId, m)))
    .filter((s): s is BranchMonth => Boolean(s));
}
