import { Calculator, ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { loadBranchAccountingRawData, currentMonth } from "@/lib/branch-accounting-data";
import { buildBranchLedger, type BranchLedger, type LedgerMonthRow } from "@/lib/branch-ledger";
import { LedgerRowEditor } from "./ledger-row-editor";

function money(n: number) {
  return `${Math.round(Math.abs(n)).toLocaleString("he-IL")} ₪`;
}

function BalanceSummaryCard({ ledger }: { ledger: BranchLedger }) {
  const balance = ledger.currentBalance;
  const balanced = Math.abs(balance) < 1;
  return (
    <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
      <div className="text-sm font-extrabold text-ink">{ledger.branch.name}</div>
      {balanced ? (
        <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-muted">
          <CheckCircle2 className="h-4 w-4" />
          מאוזן - אין חוב
        </div>
      ) : balance > 0 ? (
        <div className="mt-2 flex items-center gap-1.5 text-lg font-black text-red-600">
          <ArrowDownLeft className="h-4 w-4" />
          {money(balance)}
          <span className="text-xs font-semibold text-muted">צריך להעביר אליי</span>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-1.5 text-lg font-black text-amber-600">
          <ArrowUpRight className="h-4 w-4" />
          {money(balance)}
          <span className="text-xs font-semibold text-muted">אני צריך להעביר אליו</span>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ row }: { row: LedgerMonthRow }) {
  const balanced = Math.abs(row.closingBalance) < 1;
  if (balanced) {
    return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">מאוזן</span>;
  }
  if (row.closingBalance > 0) {
    return <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-600">חוב אליי</span>;
  }
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">חוב ממני</span>;
}

function BranchLedgerTable({ ledger }: { ledger: BranchLedger }) {
  const thisMonth = currentMonth();
  const rows = [...ledger.rows].reverse(); // newest month first
  return (
    <details className="rounded-card border border-card-border bg-white shadow-card" open={Math.abs(ledger.currentBalance) >= 1}>
      <summary className="flex cursor-pointer items-center justify-between gap-2 p-4 text-sm font-extrabold text-ink">
        <span>{ledger.branch.name} - היסטוריה מלאה</span>
        <span className={`text-base font-black ${Math.abs(ledger.currentBalance) < 1 ? "text-muted" : ledger.currentBalance > 0 ? "text-red-600" : "text-amber-600"}`}>
          {Math.abs(ledger.currentBalance) < 1 ? "מאוזן" : money(ledger.currentBalance)}
        </span>
      </summary>
      <div className="overflow-x-auto border-t border-card-border">
        <table className="w-full min-w-[820px] border-collapse text-right text-[13px]">
          <thead>
            <tr className="bg-[#f4f6f9] text-[11px] font-bold uppercase tracking-wide text-muted">
              <th className="border border-card-border px-2 py-2">חודש</th>
              <th className="border border-card-border px-2 py-2">נטו לחודש</th>
              <th className="border border-card-border px-2 py-2">יתרה מחודש קודם</th>
              <th className="border border-card-border px-2 py-2">סה&quot;כ לתשלום</th>
              <th className="border border-card-border px-2 py-2">הועבר בפועל</th>
              <th className="border border-card-border px-2 py-2">יתרה נותרת</th>
              <th className="border border-card-border px-2 py-2">סטטוס</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((row, idx) => (
              <tr
                key={row.month}
                className={`${idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"} ${row.month === thisMonth ? "outline outline-2 -outline-offset-2 outline-teal/40" : ""}`}
              >
                <td className="border border-card-border px-2 py-1.5 font-bold text-ink">{row.month}</td>
                <td className={`border border-card-border px-2 py-1.5 ${row.netToOwner >= 0 ? "text-teal-dark" : "text-red-600"}`}>
                  {row.netToOwner >= 0 ? "+" : "-"}
                  {money(row.netToOwner)}
                </td>
                <td className={`border border-card-border px-2 py-1.5 text-muted`}>
                  {Math.abs(row.openingBalance) < 1 ? "-" : `${row.openingBalance >= 0 ? "+" : "-"}${money(row.openingBalance)}`}
                </td>
                <td className={`border border-card-border px-2 py-1.5 font-bold ${row.totalDue >= 0 ? "text-ink" : "text-amber-700"}`}>
                  {row.totalDue >= 0 ? "+" : "-"}
                  {money(row.totalDue)}
                </td>
                <td className="border border-card-border px-2 py-1.5">
                  <LedgerRowEditor branchId={ledger.branch.id} row={row} />
                </td>
                <td className={`border border-card-border px-2 py-1.5 font-bold ${Math.abs(row.closingBalance) < 1 ? "text-muted" : row.closingBalance > 0 ? "text-red-600" : "text-amber-600"}`}>
                  {Math.abs(row.closingBalance) < 1 ? "0 ₪" : `${row.closingBalance >= 0 ? "+" : "-"}${money(row.closingBalance)}`}
                </td>
                <td className="border border-card-border px-2 py-1.5">
                  <StatusBadge row={row} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11px] text-muted">
        + ירוק = הסניף/השותף חייב להעביר אליך. − כתום = אתה חייב להעביר לסניף/לשותף. לחיצה על עפרון ליד &quot;הועבר בפועל&quot; מאפשרת
        לעדכן כל חודש - גם עבר - כשמתבצעת העברה חלקית או מאוחרת.
      </p>
    </details>
  );
}

export default async function RentalsLedgerPage() {
  await requireOwner();
  const raw = await loadBranchAccountingRawData();
  const rentalsBranches = raw.branches
    .filter((b) => b.branchType === "rentals")
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const ledgers = rentalsBranches.map((b) => buildBranchLedger(b, raw));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Calculator className="h-5 w-5" />
          {"חישוב הנה\"ח"}
        </h1>
        <p className="text-sm text-muted">כמה כל סניף צריך להעביר אליך (או אתה אליו) - כולל היסטוריה מלאה וחוב מועבר מחודשים קודמים. מוצג לבעלים בלבד.</p>
      </div>

      {ledgers.length === 0 ? (
        <p className="rounded-card border border-card-border bg-white p-6 text-center text-sm text-muted">אין סניפי השכרות עדיין.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ledgers.map((l) => (
              <BalanceSummaryCard key={l.branch.id} ledger={l} />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            {ledgers.map((l) => (
              <BranchLedgerTable key={l.branch.id} ledger={l} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
