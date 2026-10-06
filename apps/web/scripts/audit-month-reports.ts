/**
 * READ-ONLY audit of a month's rentals-branch reports. Never writes to Firestore: only .get()
 * calls (loadBranchAccountingRawData() and a select() of document timestamps) and pure functions.
 * Run from apps/web:  npx tsx --tsconfig tsconfig.json scripts/audit-month-reports.ts [YYYY-MM]
 *
 * "AS SENT" rebuilds the report from the documents that already existed when it was mailed
 * (Firestore createTime <= reportSentAt). Documents edited after the send keep their current
 * values, so a second line shows the report without them when that changes the bottom line.
 * Deleted documents can't be seen at all.
 */
import { getAdminFirestore } from "../lib/firebase-admin";
import { loadBranchAccountingRawData, type BranchAccountingRawData } from "../lib/branch-accounting-data";
import { buildBranchMonthReport } from "../lib/branch-month-report";
import { buildBranchLedger } from "../lib/branch-ledger";

const MONTH = process.argv[2] ?? "2026-09";
const r0 = (n: number) => Math.round(n);
const STAMPED = ["n_rentals", "n_var_expenses", "n_fixed_expenses", "n_branch_income", "n_branch_transfers", "n_laptops"];

(async () => {
  const raw = await loadBranchAccountingRawData();
  const created = new Map<string, string>();
  const updated = new Map<string, string>();
  for (const c of STAMPED) {
    const snap = await getAdminFirestore().collection(c).select().get();
    for (const d of snap.docs) {
      created.set(`${c}/${d.id}`, d.createTime.toDate().toISOString());
      updated.set(`${c}/${d.id}`, d.updateTime.toDate().toISOString());
    }
  }
  const existed = (c: string, id: string, at: string) => (created.get(`${c}/${id}`) ?? "") <= at;
  const editedAfter = (c: string, id: string, at: string) => (updated.get(`${c}/${id}`) ?? "") > at;

  function rawAsOf(at: string, dropEditedRentals: boolean): BranchAccountingRawData {
    const keep = <X extends { id: string }>(m: Map<string, X[]>, c: string, also?: (x: X) => boolean) =>
      new Map([...m].map(([k, v]) => [k, v.filter((x) => existed(c, x.id, at) && (!also || also(x)))]));
    return {
      ...raw,
      rentalsByBranch: keep(raw.rentalsByBranch, "n_rentals", (r) => !(dropEditedRentals && editedAfter("n_rentals", r.id, at))),
      variableByBranch: keep(raw.variableByBranch, "n_var_expenses"),
      fixedByBranch: keep(raw.fixedByBranch, "n_fixed_expenses"),
      branchIncomeByBranch: keep(raw.branchIncomeByBranch, "n_branch_income"),
      laptopsByBranch: keep(raw.laptopsByBranch, "n_laptops"),
      transfersByBranchMonth: new Map([...raw.transfersByBranchMonth].filter(([, t]) => existed("n_branch_transfers", t.id, at))),
    };
  }

  const show = (label: string, rep: ReturnType<typeof buildBranchMonthReport>) =>
    console.log(`  ${label}: opening=${r0(rep.openingBalance)} month=${r0(rep.netToOwner)} BOTTOM=${r0(rep.outstanding)}` +
      (rep.previousTransfer ? ` prevTransfer(${rep.previousTransfer.month})=${r0(rep.previousTransfer.amount)}` : "") +
      ` income=${r0(rep.income)} rentals=${rep.rentalCount} expenses=${r0(rep.expenseTotal)} sales=${r0(rep.salesTotal)}`);

  const branches = raw.branches.filter((b) => b.branchType === "rentals" && !b.deleted);
  console.log(`rentals branches: ${branches.length}\n`);

  for (const b of branches) {
    const laptops = (raw.laptopsByBranch.get(b.id) ?? []).length;
    const sentAt = raw.transfersByBranchMonth.get(`${b.id}|${MONTH}`)?.reportSentAt;
    console.log(`=== ${b.name} (${b.id}) partner=${b.partnerName ?? "-"} isMine=${b.isMine} closedAt=${b.closedAt ?? "-"} myPct=${b.myPct} partnerPct=${b.partnerPct} laptops=${laptops}`);
    if (b.myPct != null && b.partnerPct != null && b.myPct + b.partnerPct !== 100) console.log(`  ! myPct + partnerPct = ${b.myPct + b.partnerPct}`);
    console.log(`  reportSentAt(${MONTH}): ${sentAt ?? "NOT SENT"}`);

    const transfers = [...raw.transfersByBranchMonth.values()].filter((t) => t.branchId === b.id).sort((a, c) => a.month.localeCompare(c.month));
    for (const t of transfers) {
      const amt = t.transferredAmount ?? (t.transferred ? t.netToOwner : 0);
      console.log(`  transfer month=${t.month} amount=${r0(amt)} recorded=${created.get(`n_branch_transfers/${t.id}`)} transferredAt=${t.transferredAt ?? "-"} sent=${t.reportSentAt ?? ""}`);
    }

    if (sentAt) {
      const asSent = buildBranchMonthReport(b, rawAsOf(sentAt, false), MONTH);
      show("AS SENT", asSent);
      const strict = buildBranchMonthReport(b, rawAsOf(sentAt, true), MONTH);
      if (r0(strict.outstanding) !== r0(asSent.outstanding)) show("AS SENT if rentals edited later were not paid yet", strict);
    }
    show("NOW", buildBranchMonthReport(b, raw, MONTH));

    const ledger = buildBranchLedger(b, raw);
    for (const row of ledger.rows.slice(-4))
      console.log(`  ledger ${row.month}: open=${r0(row.openingBalance)} net=${r0(row.netToOwner)} due=${r0(row.totalDue)} paid=${r0(row.transferredAmount)} close=${r0(row.closingBalance)}`);
    console.log(`  CURRENT BALANCE (incl. open month): ${r0(ledger.currentBalance)}`);

    // --- anomalies ---
    const rentals = raw.rentalsByBranch.get(b.id) ?? [];
    for (const r of rentals.filter((r) => r.status === "returned" && !r.paid && (r.returnDate ?? "") >= "2026-07"))
      console.log(`  ! returned NOT paid: ${r.id} return=${r.returnDate} price=${r.finalPrice ?? r.calcPrice}`);
    for (const r of rentals.filter((r) => r.status === "returned" && !r.returnDate))
      console.log(`  ! returned without returnDate (never counted): ${r.id} price=${r.finalPrice ?? r.calcPrice}`);
    for (const r of rentals.filter((r) => r.startDate && r.startDate < "2020"))
      console.log(`  ! bad startDate: ${r.id} start=${r.startDate}`);
    const prices = rentals.map((r) => r.finalPrice ?? r.calcPrice).filter((p) => p > 0).sort((a, c) => a - c);
    const med = prices[Math.floor(prices.length / 2)] ?? 0;
    for (const r of rentals) {
      const p = r.finalPrice ?? r.calcPrice;
      if (med && (p > med * 5 || p < 0)) console.log(`  ! odd rental price ${p} (median ${med}): ${r.id} ${r.startDate}..${r.returnDate ?? ""}`);
    }

    const vars = raw.variableByBranch.get(b.id) ?? [];
    const seen = new Map<string, string>();
    for (const e of vars) {
      // same month, amount, text AND date: weekly ads on different dates are not duplicates
      const key = `${e.month}|${e.date ?? ""}|${e.amount}|${(e.desc ?? "").trim()}`;
      if (seen.has(key)) console.log(`  ! duplicate variable expense: ${e.month} ${e.amount} "${e.desc}" (${seen.get(key)} / ${e.id})`);
      else seen.set(key, e.id);
      if (e.date && e.month && e.date.slice(0, 7) !== e.month) console.log(`  ! var expense month≠date: ${e.id} date=${e.date} month=${e.month} ${e.amount} "${e.desc}"`);
      if (Math.abs(e.amount) >= 5000 || e.amount <= 0) console.log(`  ! large/odd var expense: ${e.id} ${e.month} ${e.amount} "${e.desc}"`);
    }
    const fixed = raw.fixedByBranch.get(b.id) ?? [];
    const copies = new Map<string, number>();
    for (const e of fixed) {
      const amt = e.amount ?? e.lastAmount ?? 0;
      if (!e.endDate || e.endDate >= `${MONTH}-01`) copies.set(`${(e.name ?? "").trim()}|${amt}`, (copies.get(`${(e.name ?? "").trim()}|${amt}`) ?? 0) + 1);
      if (e.endDate && e.endDate < e.startDate) console.log(`  ! fixed end<start: ${e.id} "${e.name}" ${e.startDate}..${e.endDate}`);
      if (e.startDate > "2026-10-31" || e.startDate < "2020-01-01") console.log(`  ! fixed odd startDate: ${e.id} "${e.name}" ${e.startDate}`);
      if (amt <= 0 || amt >= 5000) console.log(`  ! fixed odd amount: ${e.id} "${e.name}" ${amt} variable=${!!e.variableAmount}`);
      if (b.closedAt && !e.endDate) console.log(`  ! fixed with no endDate on closed branch: ${e.id} "${e.name}"`);
    }
    // identical recurring lines are normal for one SIM per computer - only odd when they outnumber the computers
    for (const [key, n] of copies)
      if (n > 1 && n > laptops) console.log(`  ! ${n} identical live fixed expenses "${key}" but only ${laptops} computers`);
    console.log("");
  }
})().catch((e) => { console.error("ERR", e); process.exit(1); });
