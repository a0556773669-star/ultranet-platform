/**
 * Core (pure, testable) calculations for the branch/partner accounting (הנה"ח) module.
 * Sign convention throughout: positive = amount owed FROM the partner TO the owner.
 * Negative = amount owed FROM the owner TO the partner.
 */

export type PaidBy = "owner" | "partner" | undefined;
export type OwedBy = "owner" | "partner" | "shared" | undefined;

/**
 * Net amount owed TO the owner for a single expense line.
 * Mirrors the existing netToOwner() logic already used in
 * apps/web/app/dashboard/rentals/expenses/branch-expenses.tsx, kept in sync intentionally.
 */
export function expenseNetToOwner(amount: number, paidBy?: string, owedBy?: string): number {
  const p = paidBy === "partner" ? "partner" : "owner";
  const o = owedBy === "partner" ? "partner" : owedBy === "shared" ? "shared" : "owner";
  if (o === "shared") return p === "owner" ? amount / 2 : -amount / 2;
  if (o === p) return 0;
  return p === "owner" ? amount : -amount;
}

/**
 * Same question as expenseNetToOwner(), but for a split that `owedBy` can't express - the owner's
 * share is handed in directly instead of being derived from owner/partner/50-50 (used by the
 * shared advertising areas, where the owner's cut is any percentage). Whoever fronted the cash
 * is owed back the other side's share:
 *   paid by the owner   -> the partner owes their own share  (total - ownerShare)
 *   paid by the partner -> the owner owes their share        (-ownerShare)
 * Feeding it ownerExpenseBurden(amount, owedBy) reproduces expenseNetToOwner() exactly.
 */
export function expenseNetToOwnerFromShares(total: number, ownerShare: number, paidBy?: string): number {
  return paidBy === "partner" ? -ownerShare : total - ownerShare;
}

/**
 * The owner's true economic share of an expense's cost, regardless of who fronted the cash.
 * Used for real profit calculations (not cash-settlement direction).
 */
export function ownerExpenseBurden(amount: number, owedBy?: string): number {
  if (owedBy === "partner") return 0;
  if (owedBy === "shared") return amount / 2;
  return amount; // undefined/"owner" -> fully the owner's cost
}

/*
 * ownerLedgerExpenseAmount() used to live here: "how much of this expense should be copied into
 * the owner's cash ledger". It is gone together with the copying itself - the flow book is
 * derived from the transactions now (lib/business-ledger.ts), and the rule it encoded is stated
 * there once, as a filter on `paidBy` and a sum of `ownerShare`, instead of being applied at
 * every write site.
 */

export interface RentalIncomeLine {
  amount: number;
  /** true if this specific payment already sits with the owner directly (e.g. direct Nedarim charge,
   *  or a collection route configured with depositsTo === "owner") rather than with the partner. */
  collectedByOwner: boolean;
}

/**
 * Amount owed TO the owner from a set of rental income lines for one branch/month.
 * Default assumption: the partner holds the cash, so the owner is owed ownerPct% of it.
 * For lines the owner already collected directly, that flips: the owner owes the partner
 * partnerPct% of that specific line instead.
 */
export function incomeShareToOwner(lines: RentalIncomeLine[], ownerPct: number): number {
  const partnerPct = 100 - ownerPct;
  let total = 0;
  for (const line of lines) {
    if (line.collectedByOwner) {
      total -= (line.amount * partnerPct) / 100;
    } else {
      total += (line.amount * ownerPct) / 100;
    }
  }
  return total;
}

export function isCollectedByOwner(
  paymentMethod: string | undefined,
  route: { depositsTo?: string } | null | undefined
): boolean {
  if (paymentMethod === "nedarim") return true; // direct owner-gateway charge, never touches the partner
  if (route && route.depositsTo === "owner") return true;
  return false;
}

export interface ExpenseLine {
  amount: number;
  paidBy?: string;
  owedBy?: string;
}

export interface MonthlySettlement {
  incomeShareToOwner: number;
  expenseNetToOwner: number;
  /** positive => partner should transfer this to owner; negative => owner should transfer |amount| to partner */
  netToOwner: number;
}

export function computeMonthlySettlement(
  incomeLines: RentalIncomeLine[],
  ownerPct: number,
  expenses: ExpenseLine[]
): MonthlySettlement {
  const incomeShare = incomeShareToOwner(incomeLines, ownerPct);
  const expenseNet = expenses.reduce((sum, e) => sum + expenseNetToOwner(e.amount, e.paidBy, e.owedBy), 0);
  return {
    incomeShareToOwner: incomeShare,
    expenseNetToOwner: expenseNet,
    netToOwner: incomeShare + expenseNet,
  };
}

/**
 * The owner's true monthly profit from a branch: owner's revenue share minus the owner's
 * real economic expense burden (independent of who physically paid). This is what feeds
 * the per-computer 150-per-month profit target, not the cash-settlement figure above.
 */
export function ownerMonthlyProfit(incomeLines: RentalIncomeLine[], ownerPct: number, expenses: ExpenseLine[]): number {
  const incomeShare = incomeShareToOwner(incomeLines, ownerPct);
  const expenseBurden = expenses.reduce((sum, e) => sum + ownerExpenseBurden(e.amount, e.owedBy), 0);
  return incomeShare - expenseBurden;
}

/** Israel standard VAT rate, used to gross up the ₪150/computer target below. */
export const VAT_RATE = 0.18;
/** Target: 150 ₪ + VAT per computer per month. */
export const PROFIT_PER_COMPUTER_TARGET = Math.round(150 * (1 + VAT_RATE));

/**
 * Computer count active in a given YYYY-MM month, based on each computer's addedDate.
 * A computer counts for a month if it was added on/before the last day of that month.
 * (No end-date handling here since computers aren't currently "removed" from a branch in the data
 * model; if that's added later, filter out here too.)
 */
export function computersActiveInMonth(addedDates: (string | undefined)[], month: string): number {
  const monthEnd = `${month}-31`; // safe upper bound for string comparison of YYYY-MM-DD
  return addedDates.filter((d) => !d || d <= monthEnd).length;
}

/*
 * buildComputerProfitTrend() ו-ComputerProfitMonth חיו כאן: רצועת רווח-פר-מחשב לסניף בודד.
 * הם נמחקו כשהשאלה עברה למסך אחד שמציג את כל הסניפים יחד (lib/laptop-branch-tracking.ts).
 * הכלל היחיד שנשמר מהם, וחשוב: computersActiveInMonth יכולה להחזיר 0 (סניף בלי אף מחשב
 * רשום), ואסור להחליף את זה ב-1 - זה היה באג שהראה "1 מחשב" לסניף בלי אף מחשב אמיתי.
 */

/** The partner's true economic share of an expense's cost (mirror of ownerExpenseBurden). */
export function partnerExpenseBurden(amount: number, owedBy?: string): number {
  return amount - ownerExpenseBurden(amount, owedBy);
}

/** Iterates YYYY-MM month strings from start to end inclusive. */
export function monthsBetween(start: string, end: string): string[] {
  const s = start.slice(0, 7);
  const e = end.slice(0, 7);
  const [sy, sm] = s.split("-").map(Number);
  const [ey, em] = e.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return [];
  const months: string[] = [];
  let y: number = sy;
  let m: number = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}
