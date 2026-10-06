/**
 * READ-ONLY audit of the September rentals-branch reports. Never writes to Firestore:
 * only loadBranchAccountingRawData() (all .get()) and pure functions are used.
 * Run from apps/web:  npx tsx --tsconfig tsconfig.json scripts/audit-month-reports.ts [YYYY-MM]
 */
import { loadBranchAccountingRawData, type BranchAccountingRawData } from "../lib/branch-accounting-data";
import { buildBranchMonthReport } from "../lib/branch-month-report";
import { buildBranchLedger } from "../lib/branch-ledger";

const MONTH = process.argv[2] ?? "2026-09";
const r0 = (n: number) => Math.round(n);

function rawAsOf(raw: BranchAccountingRawData, iso: string): BranchAccountingRawData {
  // Transfers recorded after the report was mailed could not have been in it.
  const t = new Map(raw.transfersByBranchMonth);
  for (const [k, v] of t) {
    if (v.transferredAt && v.transferredAt > iso) t.set(k, { ...v, transferredAmount: 0, transferred: false });
  }
  return { ...raw, transfersByBranchMonth: t };
}

(async () => {
  const raw = await loadBranchAccountingRawData();
  const branches = raw.branches.filter((b) => b.branchType === "rentals" && !b.deleted);
  console.log(`rentals branches: ${branches.length}\n`);

  for (const b of branches) {
    const tSep = raw.transfersByBranchMonth.get(`${b.id}|${MONTH}`);
    const sentAt = tSep?.reportSentAt;
    console.log(`=== ${b.name} (${b.id}) partner=${b.partnerName ?? "-"} isMine=${b.isMine} closedAt=${b.closedAt ?? "-"} notStarted=${!!b.notStarted}`);
    console.log(`  reportSentAt(${MONTH}): ${sentAt ?? "NOT SENT"}`);

    const transfers = [...raw.transfersByBranchMonth.values()].filter((t) => t.branchId === b.id).sort((a, c) => a.month.localeCompare(c.month));
    for (const t of transfers) {
      const amt = t.transferredAmount ?? (t.transferred ? t.netToOwner : 0);
      const flag = t.transferredAt && t.transferredAt.slice(0, 7) <= t.month && Math.abs(amt) > 0.5 ? "  <-- recorded on/before its own month" : "";
      console.log(`  transfer month=${t.month} amount=${r0(amt)} transferredAt=${t.transferredAt ?? "-"} note=${t.note ?? ""} sent=${t.reportSentAt ?? ""}${flag}`);
    }

    const show = (label: string, rep: ReturnType<typeof buildBranchMonthReport>) =>
      console.log(`  ${label}: opening=${r0(rep.openingBalance)} month=${r0(rep.netToOwner)} total=${r0(rep.totalDue)} transferred=${r0(rep.transferredAmount)} BOTTOM=${r0(rep.outstanding)}` +
        (rep.previousTransfer ? ` prevTransfer(${rep.previousTransfer.month})=${r0(rep.previousTransfer.amount)}` : "") +
        ` income=${r0(rep.income)} rentals=${rep.rentalCount} expenses=${r0(rep.expenseTotal)} sales=${r0(rep.salesTotal)}`);
    if (sentAt) show("AS SENT (approx)", buildBranchMonthReport(b, rawAsOf(raw, sentAt), MONTH));
    show("NOW", buildBranchMonthReport(b, raw, MONTH));

    const ledger = buildBranchLedger(b, raw);
    for (const row of ledger.rows.slice(-4))
      console.log(`  ledger ${row.month}: open=${r0(row.openingBalance)} net=${r0(row.netToOwner)} due=${r0(row.totalDue)} paid=${r0(row.transferredAmount)} close=${r0(row.closingBalance)}`);
    console.log(`  CURRENT BALANCE (incl. open month): ${r0(ledger.currentBalance)}`);

    // --- anomalies ---
    const rentals = raw.rentalsByBranch.get(b.id) ?? [];
    const unpaid = rentals.filter((r) => r.status === "returned" && !r.paid && (r.returnDate ?? "") >= "2026-07");
    for (const r of unpaid) console.log(`  ! returned NOT paid: ${r.id} return=${r.returnDate} price=${r.finalPrice ?? r.calcPrice}`);
    const noDate = rentals.filter((r) => r.status === "returned" && !r.returnDate);
    for (const r of noDate) console.log(`  ! returned without returnDate (never counted): ${r.id} price=${r.finalPrice ?? r.calcPrice}`);
    const prices = rentals.map((r) => r.finalPrice ?? r.calcPrice).filter((p) => p > 0).sort((a, c) => a - c);
    const med = prices[Math.floor(prices.length / 2)] ?? 0;
    for (const r of rentals) { const p = r.finalPrice ?? r.calcPrice; if (med && (p > med * 5 || p < 0)) console.log(`  ! odd rental price ${p} (median ${med}): ${r.id} ${r.returnDate ?? r.startDate}`); }

    const vars = raw.variableByBranch.get(b.id) ?? [];
    const seen = new Map<string, string>();
    for (const e of vars) {
      const key = `${e.month}|${e.amount}|${(e.desc ?? "").trim()}`;
      if (seen.has(key)) console.log(`  ! duplicate variable expense: ${e.month} ${e.amount} "${e.desc}" (${seen.get(key)} / ${e.id})`);
      else seen.set(key, e.id);
      if (e.date && e.month && e.date.slice(0, 7) !== e.month) console.log(`  ! var expense month≠date: ${e.id} date=${e.date} month=${e.month} ${e.amount} "${e.desc}"`);
      if (Math.abs(e.amount) >= 5000 || e.amount <= 0) console.log(`  ! large/odd var expense: ${e.id} ${e.month} ${e.amount} "${e.desc}"`);
    }
    const fixed = raw.fixedByBranch.get(b.id) ?? [];
    const fseen = new Map<string, string>();
    for (const e of fixed) {
      const amt = e.amount ?? e.lastAmount ?? 0;
      const live = !e.endDate || e.endDate >= `${MONTH}-01`;
      const key = `${(e.name ?? "").trim()}|${amt}`;
      if (live && fseen.has(key)) console.log(`  ! duplicate live fixed expense: "${e.name}" ${amt} (${fseen.get(key)} / ${e.id})`);
      else if (live) fseen.set(key, e.id);
      if (e.endDate && e.endDate < e.startDate) console.log(`  ! fixed end<start: ${e.id} "${e.name}" ${e.startDate}..${e.endDate}`);
      if (e.startDate > "2026-10-31" || e.startDate < "2020-01-01") console.log(`  ! fixed odd startDate: ${e.id} "${e.name}" ${e.startDate}`);
      if (amt <= 0 || amt >= 5000) console.log(`  ! fixed odd amount: ${e.id} "${e.name}" ${amt} variable=${!!e.variableAmount}`);
      if (b.closedAt && !e.endDate) console.log(`  ! fixed with no endDate on closed branch: ${e.id} "${e.name}"`);
    }
    console.log("");
  }
})().catch((e) => { console.error("ERR", e); process.exit(1); });
