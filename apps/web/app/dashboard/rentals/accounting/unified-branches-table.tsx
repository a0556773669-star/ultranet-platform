import Link from "next/link";
import type { Branch } from "@ultranet/shared-types";
import { computeBranchFinancials, type BranchAccountingRawData } from "@/lib/branch-accounting-data";
import { buildBranchLedger } from "@/lib/branch-ledger";
import { TransferMarkCell } from "./transfer-mark-cell";

function money(n: number) {
  return `${Math.round(Math.abs(n)).toLocaleString("he-IL")} ₪`;
}

const TH = "px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-2.5 py-2 whitespace-nowrap";

/** Owner's unified הנה"ח table for the current month: one row per branch, merging what used to be
 *  two separate views (הנה"ח + חישוב הנה"ח) - the month's expense/income split plus the running
 *  balance-to-transfer, editable in place. */
export function UnifiedBranchesTable({
  branches,
  raw,
  month,
}: {
  branches: Branch[];
  raw: BranchAccountingRawData;
  month: string;
}) {
  const sorted = [...branches].sort((a, b) => {
    if (!a.parentBranchId && b.parentBranchId === a.id) return -1;
    if (!b.parentBranchId && a.parentBranchId === b.id) return 1;
    const aKey = a.parentBranchId ? `${a.parentBranchId}~${a.name}` : `${a.id}~`;
    const bKey = b.parentBranchId ? `${b.parentBranchId}~${b.name}` : `${b.id}~`;
    return aKey.localeCompare(bKey, "he");
  });

  const rows = sorted.map((branch) => {
    const f = computeBranchFinancials(branch, raw, month);
    const ledger = buildBranchLedger(branch, raw);
    const monthRow = ledger.rows.find((r) => r.month === month);
    return { branch, f, monthRow };
  });

  return (
    <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] border-collapse text-right text-[13px]">
          <thead>
            <tr className="border-b border-card-border bg-[#f4f6f9]">
              <th className={TH}>סניף</th>
              <th className={TH}>חודש</th>
              <th className={TH}>הוצאות שלי</th>
              <th className={TH}>הוצאות שלו</th>
              <th className={TH}>הכנסות החודש</th>
              <th className={TH}>יתרה מחודש קודם</th>
              <th className={TH}>להעברה</th>
              <th className={TH}>הועבר</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map(({ branch, f, monthRow }, idx) => {
              const totalDue = monthRow?.totalDue ?? f.settlementNetToOwner;
              const opening = monthRow?.openingBalance ?? 0;
              const transferredAmount = monthRow?.transferredAmount ?? 0;
              const isChild = !!branch.parentBranchId;
              return (
                <tr key={branch.id} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                  <td className={`${TD} font-bold text-ink`}>
                    <Link href={`/dashboard/rentals/accounting?branchId=${branch.id}`} className="hover:underline">
                      {isChild && <span className="ml-1 text-muted">↳</span>}
                      {branch.name}
                    </Link>
                  </td>
                  <td className={`${TD} text-muted`}>{month}</td>
                  <td className={`${TD} font-semibold text-ink`}>{f.myExpenseThisMonth > 0 ? money(f.myExpenseThisMonth) : "-"}</td>
                  <td className={`${TD} font-semibold text-ink`}>{f.hisExpenseThisMonth > 0 ? money(f.hisExpenseThisMonth) : "-"}</td>
                  <td className={`${TD} font-semibold text-emerald-700`}>{f.grossIncomeThisMonth > 0 ? money(f.grossIncomeThisMonth) : "-"}</td>
                  <td className={`${TD} text-muted`}>{Math.abs(opening) < 1 ? "-" : `${opening >= 0 ? "+" : "-"}${money(opening)}`}</td>
                  <td className={`${TD} font-black ${totalDue >= 0 ? "text-teal-dark" : "text-red-600"}`}>
                    {Math.abs(totalDue) < 1 ? "מאוזן" : `${totalDue >= 0 ? "+" : "-"}${money(totalDue)}`}
                  </td>
                  <td className={TD}>
                    <TransferMarkCell
                      branchId={branch.id}
                      month={month}
                      netToOwner={f.settlementNetToOwner}
                      totalDue={totalDue}
                      transferredAmount={transferredAmount}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-card-border px-4 py-2.5 text-[11px] text-muted">
        + ירוק ב&quot;להעברה&quot; = הסניף/השותף חייב להעביר אליך. − אדום = אתה חייב להעביר אליו. &quot;יתרה מחודש קודם&quot; היא מה
        שנשאר לא מועבר מחודשים קודמים. סימון התיבה ב&quot;הועבר&quot; מסמן את מלוא הסכום כמועבר; ניתן לערוך את הסכום ידנית להעברה חלקית.
      </p>
    </div>
  );
}
