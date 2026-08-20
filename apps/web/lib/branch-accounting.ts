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

/**
 * The amount that should actually hit the owner's cash ledger (n_ah_expenses) for an expense.
 * Only counts when the owner physically paid it (paidBy === "owner") - if the partner fronted
 * the cash, the owner never had a real cash outflow; whatever the owner owes for it instead
 * nets out of the partner's month-end settlement transfer (expenseNetToOwner/computeMonthlySettlement),
 * so recording it again here as a separate expense would double-count it.
 */
export function ownerLedgerExpenseAmount(amount: number, paidBy?: string, owedBy?: string): number {
  if (paidBy === "partner") return 0;
  return ownerExpenseBurden(amount, owedBy);
}

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

export interface ComputerProfitMonth {
  month: string; // YYYY-MM
  netProfit: number;
  computerCount: number;
  profitPerComputer: number;
  isHealthy: boolean;
}

/** Israel standard VAT rate, used to gross up the ₪150/computer target below. */
export const VAT_RATE = 0.18;
/** Target: 150 ₪ + VAT per computer per month. */
export const PROFIT_PER_COMPUTER_TARGET = Math.round(150 * (1 + VAT_RATE));

/**
 * Computer count active in a given YYYY-MM month, based on each computer's addedDate.
 * A computer counts for a month if it was added on/before the last day of that month.
 * (No end-date handling here since computers aren't currently "removed" from a branch in the data model;
 * if that's added later, filter out here too.)
 */
export function computersActiveInMonth(addedDates: (string | undefined)[], month: string): number {
  const monthEnd = `${month}-31`; // safe upper bound for string comparison of YYYY-MM-DD
  return addedDates.filter((d) => !d || d <= monthEnd).length;
}

/**
 * Builds the per-computer profit trend for a branch across a list of months, given each month's
 * owner net profit (already computed via ownerMonthlyProfit) and the computer addedDates for that branch.
 */
export function buildComputerProfitTrend(
  monthlyNetProfits: { month: string; netProfit: number }[],
  addedDates: (string | undefined)[]
): ComputerProfitMonth[] {
  return monthlyNetProfits.map(({ month, netProfit }) => {
    // Do NOT fall back to 1 when there are no registered computers yet - that fabricates a
    // computer that doesn't exist and can show a fake "1 מחשב" / healthy status for a branch
    // with none registered at all. With 0 computers the per-computer metric is meaningless.
    const computerCount = computersActiveInMonth(addedDates, month);
    const profitPerComputer = computerCount > 0 ? netProfit / computerCount : 0;
    return {
      month,
      netProfit,
      computerCount,
      profitPerComputer,
      isHealthy: computerCount > 0 && profitPerComputer >= PROFIT_PER_COMPUTER_TARGET,
    };
  });
}


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
