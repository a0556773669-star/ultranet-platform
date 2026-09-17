import Link from "next/link";
import type { BranchTransferRow } from "@/lib/branch-transfer-rows";
import { sumBranchTransferRows } from "@/lib/branch-transfer-rows";
import { TransferMarkCell } from "./transfer-mark-cell";
import { ReceiptCheckbox } from "./receipt-checkbox";

function money(n: number) {
  return `${Math.round(Math.abs(n)).toLocaleString("he-IL")} ₪`;
}

/** Signed money for the settlement columns: + green = the branch owes you, − red = you owe them. */
function Signed({ value, strong = false }: { value: number; strong?: boolean }) {
  if (Math.abs(value) < 1) return <span className="text-muted">{strong ? "מאוזן" : "-"}</span>;
  return (
    <span className={`${strong ? "font-black" : "font-semibold"} ${value > 0 ? "text-emerald-700" : "text-red-600"}`}>
      {value > 0 ? "+" : "−"}
      {money(value)}
    </span>
  );
}

const TH = "px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-2.5 py-2 whitespace-nowrap";

/**
 * The owner's monthly partner-settlement table: one row per rentals branch for the selected
 * month, read right-to-left like an account statement - what was carried over, what went out,
 * what came in, and what therefore has to move between us.
 *
 * This is the WIDE view, opened from a button on /dashboard/accounting/mobile: the screen itself
 * carries the two numbers that get acted on (balance, amount due) and this one adds the columns
 * that explain how they came out that way.
 *
 * Deliberately NOT a profit-and-loss view: an expense the owner both paid and fully owes never
 * appears here, because nobody owes anybody for it. See settlementExpenseThisMonth.
 */
export function UnifiedBranchesTable({ rows, month }: { rows: BranchTransferRow[]; month: string }) {
  const totals = sumBranchTransferRows(rows);

  return (
    <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] border-collapse text-right text-[13px]">
          <thead>
            <tr className="border-b border-card-border bg-[#f4f6f9]">
              <th className={TH}>סניף</th>
              <th className={TH}>יתרה מחודש קודם</th>
              <th className={TH}>הוצאות</th>
              <th className={TH}>הכנסות</th>
              <th className={TH}>צריך להעביר</th>
              <th className={TH}>כולל חודש קודם</th>
              <th className={TH}>הועבר</th>
              <th className={TH}>הוצאנו קבלה</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-2.5 py-6 text-center text-sm text-muted">
                  אין סניפי השכרות פעילים
                </td>
              </tr>
            )}
            {rows.map((r, idx) => {
              const isChild = !!r.branch.parentBranchId;
              return (
                <tr key={r.branch.id} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                  <td className={`${TD} font-bold text-ink`}>
                    <Link
                      href={`/dashboard/rentals/accounting?month=${month}&branchId=${r.branch.id}#branch-history`}
                      className="hover:underline"
                      title="מעקב היסטוריה מלאה על הסניף הזה"
                    >
                      {isChild && <span className="ml-1 text-muted">↳</span>}
                      {r.branch.name}
                    </Link>
                  </td>
                  <td className={TD}>
                    <Signed value={r.opening} />
                  </td>
                  <td className={`${TD} font-semibold text-ink`}>{r.expenses > 0 ? money(r.expenses) : "-"}</td>
                  <td className={`${TD} font-semibold text-emerald-700`}>{r.income > 0 ? money(r.income) : "-"}</td>
                  <td className={TD}>
                    <Signed value={r.netToOwner} />
                  </td>
                  <td className={TD}>
                    <Signed value={r.totalDue} strong />
                  </td>
                  <td className={TD}>
                    <TransferMarkCell
                      // ראו ההערה ב-compact-transfers-table.tsx: המפתח תלוי בסכום כדי
                      // שסימון בטבלה השנייה יתפוס גם כאן.
                      key={`${r.branch.id}|${r.transferredAmount}`}
                      branchId={r.branch.id}
                      month={month}
                      netToOwner={r.netToOwner}
                      totalDue={r.totalDue}
                      transferredAmount={r.transferredAmount}
                    />
                  </td>
                  <td className={TD}>
                    <ReceiptCheckbox branchId={r.branch.id} month={month} receiptIssued={r.receiptIssued} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-card-border bg-[#f4f6f9] tabular-nums">
                <td className={`${TD} font-black text-ink`}>{"סה\"כ"}</td>
                <td className={TD}>
                  <Signed value={totals.opening} />
                </td>
                <td className={`${TD} font-black text-ink`}>{totals.expenses > 0 ? money(totals.expenses) : "-"}</td>
                <td className={`${TD} font-black text-emerald-700`}>
                  {totals.income > 0 ? money(totals.income) : "-"}
                </td>
                <td className={TD}>
                  <Signed value={totals.netToOwner} />
                </td>
                <td className={TD}>
                  <Signed value={totals.totalDue} strong />
                </td>
                <td className={TD} />
                <td className={TD} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="border-t border-card-border px-4 py-2.5 text-[11px] leading-relaxed text-muted">
        <span className="font-bold text-emerald-700">+ ירוק</span> = הסניף/השותף צריך להעביר אליך.{" "}
        <span className="font-bold text-red-600">− אדום</span> = אתה צריך להעביר אליו. &quot;יתרה מחודש קודם&quot; היא
        מה שנשאר לא מועבר מחודשים קודמים, ו&quot;כולל חודש קודם&quot; הוא השורה התחתונה. סימון התיבה
        ב&quot;הועבר&quot; מסמן את מלוא הסכום כמועבר (ניתן לערוך את הסכום ידנית להעברה חלקית) - וגם יוצר אוטומטית
        רשומת הכנסה בהנה&quot;ח הראשית ופר-סניף. &quot;הוצאנו קבלה&quot; הוא סימון עצמאי, לא קשור לסכום.
        <br />
        <span className="font-bold">מה נספר ב&quot;הוצאות&quot;:</span> רק הוצאות שיש עליהן התחשבנות בינך לבין הסניף -
        הוצאות משותפות, והוצאות שצד אחד שילם עבור השני (כולל הוצאות שהתחלקו בין כמה סניפים). הוצאה שאתה גם שילמת וגם
        כולה עליך אינה מופיעה כאן - זה חשבון מול שותפים, לא דו&quot;ח רווח והפסד. הוצאות שנרשמו תחת &quot;הוצאות
        משותפות (כל הסניפים)&quot; נספרות בספר שלך בלבד ולא מתחלקות לסניפים.
      </p>
    </div>
  );
}
