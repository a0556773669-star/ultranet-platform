/**
 * רשימת סקירה — לא שער אישור (פרק יד׳).
 *
 * THE EXPOSURE THIS CLOSES
 * A branch manager can enter an expense and it immediately reduces what he owes the owner. With
 * one branch that is fine. With thirty it is a mechanism nobody is looking at.
 *
 * THE SHAPE OF THE FIX
 * Not a gate - a list. An approval step would mean the manager waits for the owner, which is
 * exactly the friction the whole design exists to avoid, and it would push people back to
 * WhatsApp. So:
 *
 *  - the expense counts from the moment it is entered, with zero friction for the manager
 *  - the owner gets ONE screen: "expenses the branches entered - not reviewed", one tick each
 *  - a row is flagged automatically when something is unusual, and flagged rows sort to the top
 *
 * In an ordinary month the list is nearly empty and takes a minute. That is the difference
 * between control and bureaucracy.
 */
import type { Transaction, TxFlag } from "@ultranet/shared-types";
import { chargesInMonth } from "./tx";
import type { UnifiedTx } from "./tx-data";

export const TX_FLAG_LABEL: Record<TxFlag, string> = {
  spike: "פי 2 מהממוצע של הסניף בקטגוריה הזו",
  new_category: "קטגוריה שלא הייתה בסניף הזה מעולם",
  no_receipt: "אין קבלה מצורפת",
  closed_month: "נרשמה לחודש שכבר נסגרה עליו העברה",
};

export const TX_FLAG_WHY: Record<TxFlag, string> = {
  spike: "קפיצה אמיתית או טעות הקלדה — שווה שנייה של מבט",
  new_category: "הוצאה חדשה שאולי לא סוכמה",
  no_receipt: "גם רואה החשבון ישאל על זה",
  closed_month: "משנה יתרה שכבר סוכמה מול השותף",
};

/** Above this amount, a row with no receipt attached is worth a look. */
export const RECEIPT_REQUIRED_ABOVE = 400;
/** How many months back the branch's own average is computed from. */
const AVERAGE_MONTHS = 3;
/** A row is a "spike" at more than this multiple of that average. */
const SPIKE_MULTIPLE = 2;

export interface FlagContext {
  /** every operating expense already in the model, used to build the branch's own baseline */
  history: UnifiedTx[];
  /** months whose settlement with the partner has already been recorded: `${branchId}|${month}` */
  settledMonths: Set<string>;
}

/**
 * The branch's own average for one category over the last few months.
 *
 * Deliberately the branch's OWN baseline and not a cross-branch one: a branch that legitimately
 * pays triple the rent of another would otherwise be flagged every single month, and a list that
 * cries wolf is a list nobody opens.
 */
export function branchCategoryAverage(
  history: UnifiedTx[],
  branchId: string,
  category: string,
  uptoMonth: string,
): { average: number; monthsSeen: number } {
  const months = previousMonths(uptoMonth, AVERAGE_MONTHS);
  let total = 0;
  let seen = 0;
  for (const month of months) {
    let monthTotal = 0;
    let has = false;
    for (const tx of history) {
      if (tx.direction !== "out" || tx.nature !== "operating") continue;
      if (tx.node.branchId !== branchId) continue;
      if ((tx.category ?? "") !== category) continue;
      if (!chargesInMonth(tx, month)) continue;
      monthTotal += tx.amount;
      has = true;
    }
    if (has) {
      total += monthTotal;
      seen += 1;
    }
  }
  return { average: seen > 0 ? total / seen : 0, monthsSeen: seen };
}

function previousMonths(month: string, count: number): string[] {
  const [y0, m0] = month.split("-").map(Number);
  if (!y0 || !m0) return [];
  const out: string[] = [];
  let y = y0;
  let m = m0;
  for (let i = 0; i < count; i++) {
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

export interface FlagInput {
  branchId: string;
  month: string;
  amount: number;
  category: string;
  hasReceipt: boolean;
}

/**
 * Which flags a newly entered branch expense earns. Computed once at entry time and stored on the
 * row, so the review list stays a cheap read and the reason a row was surfaced does not silently
 * change later when the branch's average moves.
 */
export function flagsForEntry(input: FlagInput, context: FlagContext): TxFlag[] {
  const flags: TxFlag[] = [];

  const { average, monthsSeen } = branchCategoryAverage(
    context.history,
    input.branchId,
    input.category,
    input.month,
  );

  if (monthsSeen === 0) {
    // Never seen at this branch. Only interesting if the branch has any history at all -
    // otherwise every row of a brand-new branch would be flagged, which is noise, not signal.
    const hasAnyHistory = context.history.some(
      (t) => t.node.branchId === input.branchId && t.direction === "out",
    );
    if (hasAnyHistory) flags.push("new_category");
  } else if (average > 0 && input.amount > average * SPIKE_MULTIPLE) {
    flags.push("spike");
  }

  if (!input.hasReceipt && input.amount > RECEIPT_REQUIRED_ABOVE) flags.push("no_receipt");
  if (context.settledMonths.has(`${input.branchId}|${input.month}`)) flags.push("closed_month");

  return flags;
}

/** Rows still awaiting the owner's eye, flagged ones first, then newest. */
export function sortForReview(rows: Transaction[]): Transaction[] {
  return [...rows].sort((a, b) => {
    const fa = (a.flags?.length ?? 0) > 0 ? 0 : 1;
    const fb = (b.flags?.length ?? 0) > 0 ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return (b.date ?? "").localeCompare(a.date ?? "");
  });
}
