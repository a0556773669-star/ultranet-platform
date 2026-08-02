/**
 * Full month-by-month settlement history (ledger) for a single rentals branch, owner-only.
 * Builds on top of computeBranchFinancials (branch-accounting-data.ts) which already knows how
 * to compute the settlement amount owed for a single month; this module chains those months
 * together into a running balance, folding in whatever the owner has actually recorded as
 * transferred (n_branch_transfers) so unpaid amounts visibly carry over month to month.
 */
import type { Branch } from "@ultranet/shared-types";
import { monthsBetween } from "./branch-accounting";
import { computeBranchFinancials, currentMonth, type BranchAccountingRawData } from "./branch-accounting-data";

export interface LedgerMonthRow {
  month: string;
  /** This month's computed settlement (positive: branch/partner owes owner; negative: owner owes branch/partner). */
  netToOwner: number;
  /** Balance carried in from all prior months, before this month's netToOwner is added. */
  openingBalance: number;
  /** openingBalance + netToOwner - what's actually due once this month is included. */
  totalDue: number;
  /** What the owner has recorded as actually transferred for this month (same sign convention). */
  transferredAmount: number;
  hasRecordedTransfer: boolean;
  transferNote?: string;
  transferredAt?: string;
  /** totalDue - transferredAmount - carries forward as next month's openingBalance. */
  closingBalance: number;
}

export interface BranchLedger {
  branch: Branch;
  rows: LedgerMonthRow[];
  /** closingBalance of the most recent month = what's owed right now. */
  currentBalance: number;
}

function earliestActivityMonth(branch: Branch, raw: BranchAccountingRawData): string | null {
  const months: string[] = [];
  for (const r of raw.rentalsByBranch.get(branch.id) ?? []) {
    if (r.status === "returned" && r.returnDate) months.push(r.returnDate.slice(0, 7));
  }
  for (const e of raw.fixedByBranch.get(branch.id) ?? []) {
    if (e.startDate) months.push(e.startDate.slice(0, 7));
  }
  for (const e of raw.variableByBranch.get(branch.id) ?? []) {
    if (e.month) months.push(e.month);
  }
  for (const i of raw.branchIncomeByBranch.get(branch.id) ?? []) {
    if (i.date) months.push(i.date.slice(0, 7));
  }
  if (months.length === 0) return null;
  return months.sort()[0] ?? null;
}

export function buildBranchLedger(branch: Branch, raw: BranchAccountingRawData): BranchLedger {
  const now = currentMonth();
  const start = earliestActivityMonth(branch, raw) ?? now;
  const months = monthsBetween(start, now);

  let balance = 0;
  const rows: LedgerMonthRow[] = months.map((month) => {
    const netToOwner = computeBranchFinancials(branch, raw, month).settlementNetToOwner;
    const opening = balance;
    const totalDue = opening + netToOwner;

    const transfer = raw.transfersByBranchMonth.get(`${branch.id}|${month}`);
    const transferredAmount = transfer
      ? (transfer.transferredAmount ?? (transfer.transferred ? transfer.netToOwner : 0))
      : 0;

    const closing = totalDue - transferredAmount;
    balance = closing;

    return {
      month,
      netToOwner,
      openingBalance: opening,
      totalDue,
      transferredAmount,
      hasRecordedTransfer: !!transfer && (transfer.transferred || !!transfer.transferredAmount),
      transferNote: transfer?.note,
      transferredAt: transfer?.transferredAt,
      closingBalance: closing,
    };
  });

  return { branch, rows, currentBalance: balance };
}
