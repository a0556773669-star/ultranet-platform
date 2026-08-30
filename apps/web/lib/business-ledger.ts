/**
 * The three layers, read back as the numbers the owner actually looks at.
 *
 * THE TWO BOOKS, RENAMED (פרק ד׳)
 * They used to be called "שלי" and "הסניפים". Both names sound like "income", so the mind keeps
 * trying to add them and keeps feeling a duplication that isn't there. Renamed, the reason they
 * must never be summed is in the names themselves:
 *
 *   תזרים — how much money actually passed through my hands and my account.
 *   מחזור — how much the business generated across all branches, whatever pocket it passed through.
 *
 * Same shekel, two questions. Adding them answers neither (כלל 6).
 *
 * THE CAPITAL MEMO (פרק י״ג)
 * Equipment appears in full - every shekel, with its invoice - but BELOW the bottom line, not
 * inside it, because it is capital and not expense. That is the whole resolution of "I want every
 * expense recorded" versus "I don't want anything double counted": both hold, in full, at once.
 */
import type { Branch } from "@ultranet/shared-types";
import { WAREHOUSE_LOCATION, paybackStatus, type PaybackStatus } from "./assets";
import { loadAssets, type AssetsData } from "./assets-data";
import { affectsBranchBook, branchSlices, ownerShareOfSlice, chargesInMonth } from "./tx";
import { loadTransactionModel, type TransactionModel, type UnifiedTx } from "./tx-data";

export const FLOW_LABEL = "תזרים";
export const FLOW_HELP = "כמה כסף באמת עבר דרך הידיים והחשבון שלי";
export const TURNOVER_LABEL = "מחזור";
export const TURNOVER_HELP = "כמה העסק ייצר בפועל בכל הסניפים, בלי קשר לכיס שדרכו זה עבר";

/* ------------------------------------------------------------------ *
 * תזרים — the owner's cash flow (שכבה 1)
 * ------------------------------------------------------------------ */

export interface FlowMonth {
  month: string;
  /** operating money in, the owner's own share */
  income: number;
  /** operating money out, the owner's own share */
  expense: number;
  profit: number;
  /** capital out this month - shown separately, never inside `profit` (כלל 7) */
  capital: number;
  /** settlements in/out; neither income nor expense (כלל 8) */
  transfersIn: number;
  transfersOut: number;
}

function emptyFlowMonth(month: string): FlowMonth {
  return { month, income: 0, expense: 0, profit: 0, capital: 0, transfersIn: 0, transfersOut: 0 };
}

/**
 * The owner's cash book, derived - not stored.
 *
 * This function is the whole point of שלב 2: the ledger used to be a collection that had to be
 * kept in sync with the branch books by writing a second "mirror" row for every branch expense.
 * Here it is a query - `paidBy === "owner"`, summing `ownerShare` - so there is nothing to keep
 * in sync, nothing to re-create on edit, and nothing that can drift.
 */
export function buildFlow(transactions: UnifiedTx[], months: string[]): Map<string, FlowMonth> {
  const map = new Map(months.map((m) => [m, emptyFlowMonth(m)]));
  for (const tx of transactions) {
    // Money the partner fronted never left the owner's account; it settles at month end instead.
    if ((tx.paidBy ?? "owner") !== "owner") continue;
    for (const month of months) {
      if (!chargesInMonth(tx, month)) continue;
      const bucket = map.get(month)!;
      if (tx.nature === "capital") {
        if (tx.direction === "out") bucket.capital += tx.ownerShare;
        continue;
      }
      if (tx.nature === "transfer") {
        if (tx.direction === "in") bucket.transfersIn += tx.amount;
        else bucket.transfersOut += tx.ownerShare;
        continue;
      }
      if (tx.direction === "in") bucket.income += tx.amount;
      else bucket.expense += tx.ownerShare;
    }
  }
  for (const bucket of map.values()) bucket.profit = bucket.income - bucket.expense;
  return map;
}

/** All-time totals of the flow book, with no month window at all. */
export interface FlowTotals {
  income: number;
  expense: number;
  balance: number;
  capital: number;
  transfersIn: number;
}

export function flowTotals(transactions: UnifiedTx[]): FlowTotals {
  let income = 0;
  let expense = 0;
  let capital = 0;
  let transfersIn = 0;
  for (const tx of transactions) {
    if ((tx.paidBy ?? "owner") !== "owner") continue;
    // A recurring charge counts once per month it has been active, not once in total.
    const times = tx.recurring?.from ? monthCount(tx.recurring.from, tx.recurring.to) : 1;
    if (tx.nature === "capital") {
      if (tx.direction === "out") capital += tx.ownerShare * times;
      continue;
    }
    if (tx.nature === "transfer") {
      if (tx.direction === "in") transfersIn += tx.amount * times;
      continue;
    }
    if (tx.direction === "in") income += tx.amount * times;
    else expense += tx.ownerShare * times;
  }
  return { income, expense, balance: income - expense, capital, transfersIn };
}

function monthCount(from: string, to?: string): number {
  const end = to && to < currentMonth() ? to : currentMonth();
  if (end < from) return 0;
  const [fy, fm] = from.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  if (!fy || !fm || !ey || !em) return 1;
  return (ey - fy) * 12 + (em - fm) + 1;
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/* ------------------------------------------------------------------ *
 * מחזור — what the branches generated (שכבה 3)
 * ------------------------------------------------------------------ */

export interface TurnoverMonth {
  month: string;
  /** full branch income, before any owner/partner split */
  income: number;
  /** full branch operating cost, before any split */
  expense: number;
  profit: number;
}

/**
 * The operating book at 100%, per month. Capital and transfers are simply not here: equipment
 * never enters a branch's operating book (כלל 7) and a settlement is not a business event
 * (כלל 8). Nothing has to be filtered out downstream because nothing wrong ever gets in.
 */
export function buildTurnover(transactions: UnifiedTx[], months: string[]): Map<string, TurnoverMonth> {
  const map = new Map(months.map((m) => [m, { month: m, income: 0, expense: 0, profit: 0 }]));
  for (const tx of transactions) {
    if (!affectsBranchBook(tx)) continue;
    for (const month of months) {
      if (!chargesInMonth(tx, month)) continue;
      const bucket = map.get(month)!;
      if (tx.direction === "in") bucket.income += tx.amount;
      else bucket.expense += tx.amount;
    }
  }
  for (const bucket of map.values()) bucket.profit = bucket.income - bucket.expense;
  return map;
}

/* ------------------------------------------------------------------ *
 * עץ מרכזי הרווח — one balance line for the whole business (פרק ה׳)
 * ------------------------------------------------------------------ */

export interface NodeTotals {
  income: number;
  expense: number;
  profit: number;
  ownerExpense: number;
}

/**
 * Totals per node of the profit-centre tree, over a set of months.
 *
 * A shekel hangs on exactly ONE node, so summing a branch of the tree can never count it twice -
 * that is the entire anti-duplication argument for the hierarchy, and it needs no bookkeeping.
 * A transaction with an explicit split contributes each slice to its own branch node; one without
 * contributes its whole amount to its own node, including when that node is a parent
 * (`shared` / `hq`), which is a correct answer and not a missing one.
 */
export function totalsByNode(transactions: UnifiedTx[], months: Set<string>): Map<string, NodeTotals> {
  const map = new Map<string, NodeTotals>();
  const add = (nodeId: string, patch: Partial<NodeTotals>) => {
    const cur = map.get(nodeId) ?? { income: 0, expense: 0, profit: 0, ownerExpense: 0 };
    cur.income += patch.income ?? 0;
    cur.expense += patch.expense ?? 0;
    cur.ownerExpense += patch.ownerExpense ?? 0;
    cur.profit = cur.income - cur.expense;
    map.set(nodeId, cur);
  };

  for (const tx of transactions) {
    if (!affectsBranchBook(tx)) continue;
    let charges = 0;
    for (const month of months) if (chargesInMonth(tx, month)) charges += 1;
    if (charges === 0) continue;

    for (const slice of branchSlices(tx)) {
      const ownerPart = ownerShareOfSlice(tx, slice) * charges;
      const amount = slice.amount * charges;
      if (tx.direction === "in") add(slice.branchId, { income: amount });
      else add(slice.branchId, { expense: amount, ownerExpense: ownerPart });
    }
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * כרטיס הסניף — investment, profit, and how much has come back (פרק ז׳)
 * ------------------------------------------------------------------ */

export interface BranchCard {
  branch: Branch;
  /** Σ unitCost of the items physically at this branch (שכבה 2) */
  invested: number;
  itemCount: number;
  laptopCount: number;
  stickCount: number;
  /** the branch's operating net this month, at 100% (שכבה 3) */
  netThisMonth: number;
  /** the owner's share of that net */
  ownerShareThisMonth: number;
  /** the owner's cumulative share of the branch's net, since it opened */
  ownerShareToDate: number;
  payback: PaybackStatus;
}

/* ------------------------------------------------------------------ *
 * השורה התחתונה (פרק י״ג)
 * ------------------------------------------------------------------ */

export interface BottomLine {
  /** מחזור כל היחידות */
  turnover: number;
  /** פחות הוצאות תפעול */
  operatingExpense: number;
  /** רווח תפעולי */
  operatingProfit: number;
  /** פחות חלק השותפים */
  partnersShare: number;
  /** הרווח שלי מהתפעול */
  ownerOperatingProfit: number;
  /** פחות הוצאות מטה */
  hqExpense: number;
  /** הרווח הנקי שלי */
  ownerNetProfit: number;
  /** --- מזכר הוני, מתחת לשורה התחתונה --- */
  capitalInvested: number;
  capitalReturned: number;
  capitalRemaining: number;
  warehouseHolding: number;
}

/**
 * The single balance line for all of Ultranet, with the capital memo underneath it.
 *
 * Headquarters costs are separated from branch costs by the node they hang on, not by a
 * category guess: `hq` is a node in the tree like any other, so "פחות הוצאות מטה" is a subtotal
 * of the tree rather than a second classification anyone has to maintain.
 */
export function buildBottomLine(
  transactions: UnifiedTx[],
  months: Set<string>,
  assets: AssetsData,
  capitalReturned: number,
): BottomLine {
  let turnover = 0;
  let operatingExpense = 0;
  let ownerExpense = 0;
  let ownerIncome = 0;
  let hqExpense = 0;

  for (const tx of transactions) {
    if (!affectsBranchBook(tx)) continue;
    let charges = 0;
    for (const month of months) if (chargesInMonth(tx, month)) charges += 1;
    if (charges === 0) continue;

    const amount = tx.amount * charges;
    const ownerPart = tx.ownerShare * charges;
    const isHq = tx.node.branchId === "hq";

    if (tx.direction === "in") {
      turnover += amount;
      ownerIncome += ownerPart;
      continue;
    }
    if (isHq) {
      hqExpense += ownerPart;
      continue;
    }
    operatingExpense += amount;
    ownerExpense += ownerPart;
  }

  const operatingProfit = turnover - operatingExpense;
  const ownerOperatingProfit = ownerIncome - ownerExpense;
  const capitalInvested = assets.totalPurchased;
  const warehouse = assets.investmentByLocation.get(WAREHOUSE_LOCATION)?.total ?? 0;

  return {
    turnover,
    operatingExpense,
    operatingProfit,
    // Whatever of the operating profit is not the owner's, is the partners' - derived, so it can
    // never disagree with the per-branch splits it comes from.
    partnersShare: operatingProfit - ownerOperatingProfit,
    ownerOperatingProfit,
    hqExpense,
    ownerNetProfit: ownerOperatingProfit - hqExpense,
    capitalInvested,
    capitalReturned,
    capitalRemaining: Math.max(0, capitalInvested - capitalReturned),
    warehouseHolding: warehouse,
  };
}

/* ------------------------------------------------------------------ *
 * Loading everything at once
 * ------------------------------------------------------------------ */

export interface LayeredData {
  model: TransactionModel;
  assets: AssetsData;
}

export async function loadLayeredData(): Promise<LayeredData> {
  const [model, assets] = await Promise.all([loadTransactionModel(), loadAssets()]);
  return { model, assets };
}

export { paybackStatus };

/* ------------------------------------------------------------------ *
 * The home dashboard's money strip
 * ------------------------------------------------------------------ */

export interface FlowSnapshot {
  todayIncome: number;
  todayExpenses: number;
  monthIncome: number;
  monthExpenses: number;
  /** capital out this month, kept out of `monthExpenses` on purpose (כלל 7) */
  monthCapital: number;
}

/**
 * Today's and this month's cash movement, derived from the same model the accounting screens
 * read. Derived rather than summed out of n_ah_income / n_ah_expenses, so the home page and the
 * entry screen can no longer disagree - which they did, because each added the recurring
 * expenses and the room setup costs back in by hand, in its own way.
 */
export function flowSnapshot(transactions: UnifiedTx[], todayISO: string): FlowSnapshot {
  const month = todayISO.slice(0, 7);
  const snap: FlowSnapshot = {
    todayIncome: 0,
    todayExpenses: 0,
    monthIncome: 0,
    monthExpenses: 0,
    monthCapital: 0,
  };

  for (const tx of transactions) {
    if ((tx.paidBy ?? "owner") !== "owner") continue;
    if (tx.nature === "transfer") continue;
    const inMonth = chargesInMonth(tx, month);
    // A recurring charge has no single date, so it never counts as "today" - only as this month.
    const isToday = !tx.recurring?.from && tx.date === todayISO;
    if (!inMonth && !isToday) continue;

    if (tx.nature === "capital") {
      if (tx.direction === "out" && inMonth) snap.monthCapital += tx.ownerShare;
      continue;
    }
    if (tx.direction === "in") {
      if (inMonth) snap.monthIncome += tx.amount;
      if (isToday) snap.todayIncome += tx.amount;
    } else {
      if (inMonth) snap.monthExpenses += tx.ownerShare;
      if (isToday) snap.todayExpenses += tx.ownerShare;
    }
  }
  return snap;
}

/* ------------------------------------------------------------------ *
 * "מתחילת הדרך" — every month the books actually have life in
 * ------------------------------------------------------------------ */

/**
 * Every month any transaction charges, up to `uptoMonth`.
 *
 * A one-off contributes its own month; a recurring one contributes every month it is active in,
 * which is what makes an all-time total of a recurring charge come out right instead of counting
 * it once. Used as the month scope for the all-time views.
 */
export function allActiveMonths(transactions: UnifiedTx[], uptoMonth: string): Set<string> {
  const out = new Set<string>();
  for (const tx of transactions) {
    if (!tx.recurring?.from) {
      if (tx.month && tx.month <= uptoMonth) out.add(tx.month);
      continue;
    }
    const end = tx.recurring.to && tx.recurring.to < uptoMonth ? tx.recurring.to : uptoMonth;
    for (const m of txMonthsBetween(tx.recurring.from, end)) out.add(m);
  }
  return out;
}

function txMonthsBetween(from: string, to: string): string[] {
  if (to < from) return [];
  const out: string[] = [];
  const [fy, fm] = from.split("-").map(Number);
  if (!fy || !fm) return [];
  let y = fy;
  let m = fm;
  while (`${y}-${String(m).padStart(2, "0")}` <= to) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * One branch's card (פרק ז׳): what was invested in it, what it earns, and how much has come back.
 *
 * The three figures come from three different layers and are never subtracted from one another -
 * the investment is compared against the profit, not deducted from it. That is what lets a branch
 * be the most profitable one and still the furthest from paying for itself, which is exactly the
 * management signal a monthly profit figure alone cannot give.
 */
export async function loadBranchCard(branchId: string, uptoMonth: string): Promise<BranchCard | null> {
  const { model, assets } = await loadLayeredData();
  const branch = model.branchById.get(branchId);
  if (!branch) return null;

  const months = allActiveMonths(model.transactions, uptoMonth);
  const totals = totalsByNode(model.transactions, months).get(branchId);
  const inv = assets.investmentByLocation.get(branchId);

  const net = (totals?.income ?? 0) - (totals?.expense ?? 0);
  const ownerNet = (totals?.income ?? 0) - (totals?.ownerExpense ?? 0);
  const monthsRun = Math.max(1, months.size);

  return {
    branch,
    invested: inv?.total ?? 0,
    itemCount: inv?.itemCount ?? 0,
    laptopCount: inv?.countByKind.laptop ?? 0,
    stickCount: inv?.countByKind.stick ?? 0,
    netThisMonth: net,
    ownerShareThisMonth: ownerNet,
    ownerShareToDate: ownerNet,
    payback: paybackStatus(inv?.total ?? 0, Math.max(0, ownerNet), Math.max(0, ownerNet) / monthsRun),
  };
}
