/**
 * הוצאה שמתחלקת בין כמה סניפים - הכללה של מודל אזורי הפרסום (lib/ad-areas.ts) לכל הוצאה
 * חד-פעמית במודול ההשכרות.
 *
 * The rule, in the owner's own words:
 *   הוצאה על כמה סניפים, ואני בוחר כמה אני משלם ->
 *   1,000 ₪ על 4 סניפים, 40% עליי = 400 ₪, והסניפים מתחלקים ב-600 הנותרים = 150 לכל סניף.
 *
 * In each branch's own book that lands as ONE line worth `amount / branchCount` (250 ₪ in the
 * example) - the branch's slice of the expense - of which the owner carries `ownerPct`%
 * (100 ₪) and the branch/partner the rest (150 ₪). Summed over the branches that is exactly
 * the expense again: 4 × 250 = 1,000, of which the owner 4 × 100 = 400.
 *
 * Pure module on purpose (no firebase-admin import): the add-expense form is a client component
 * and imports splitMultiBranchExpense() straight from here for its live preview - the same
 * split ad-areas.ts uses. Loading n_multi_branch_expenses lives in branch-accounting-data.ts.
 */
import type { MultiBranchExpense } from "@ultranet/shared-types";

export const MULTI_BRANCH_EXPENSES_COLLECTION = "n_multi_branch_expenses";
export const DEFAULT_MULTI_BRANCH_OWNER_PCT = 50;

export interface MultiBranchSplit {
  amount: number;
  ownerPct: number;
  /** how many branches the non-owner part is divided between (never below 1) */
  branchCount: number;
  /** what the owner carries of the whole expense */
  ownerTotal: number;
  /** what the branches carry together */
  branchesTotal: number;
  /** what ONE branch actually carries out of pocket */
  perBranch: number;
  /** one branch's slice of the expense as it appears in that branch's book
   *  (perBranch + the owner's part of that same slice) */
  perBranchLineTotal: number;
  /** the owner's part inside that one branch line */
  perBranchOwnerShare: number;
}

export function splitMultiBranchExpense(amount: number, ownerPct: number, branchCount: number): MultiBranchSplit {
  const total = Math.max(0, amount || 0);
  const pct = Math.min(100, Math.max(0, ownerPct ?? DEFAULT_MULTI_BRANCH_OWNER_PCT));
  const count = Math.max(1, Math.floor(branchCount) || 1);
  const ownerTotal = (total * pct) / 100;
  const branchesTotal = total - ownerTotal;
  return {
    amount: total,
    ownerPct: pct,
    branchCount: count,
    ownerTotal,
    branchesTotal,
    perBranch: branchesTotal / count,
    perBranchLineTotal: total / count,
    perBranchOwnerShare: ownerTotal / count,
  };
}

export function splitOf(expense: Pick<MultiBranchExpense, "amount" | "ownerPct" | "branchIds">): MultiBranchSplit {
  return splitMultiBranchExpense(expense.amount, expense.ownerPct, expense.branchIds.length);
}

/** The one-line explanation shown next to a multi-branch expense wherever it's listed. */
export function multiBranchExpenseNote(split: MultiBranchSplit): string {
  return `${Math.round(split.amount).toLocaleString("he-IL")} ₪ ל-${split.branchCount} סניפים · ${
    split.ownerPct
  }% על הבעלים · ${Math.round(split.perBranch).toLocaleString("he-IL")} ₪ לכל סניף`;
}
