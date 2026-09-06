import Link from "next/link";
import { Building2, Layers } from "lucide-react";
import type { Branch } from "@ultranet/shared-types";

const TH = "px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-2.5 py-1.5 whitespace-nowrap";

export interface BranchExpenseRow {
  branch: Branch;
  fixedCount: number;
  variableCount: number;
  /** סה"כ ההוצאות של הסניף עד היום (קבועות נצברות + חד-פעמיות) */
  total: number;
  /** כמה מתוכן מסומנות כמתחשבנות בהנה"ח הראשית */
  toMain: number;
}

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * רשימת הסניפים במסך ההוצאות — טבלה, לא קוביות.
 *
 * הקוביות שהיו כאן החזיקו שם וחץ בגובה של שורת טקסט וחצי כל אחת, כך שעם עשרה סניפים
 * חצי מהמסך היה רווח לבן וצריך היה לגלול כדי לראות מי בכלל קיים. אותה כמות מידע נכנסת
 * לטבלה בשליש מהגובה, ומרוויחה שתי עמודות שלא היו שם קודם: כמה יצא בסניף עד היום, וכמה
 * מזה בכלל מגיע להנה"ח הראשית.
 */
export function BranchExpenseTable({
  rows,
  hrefFor,
  sharedHref,
  sharedLabel,
}: {
  rows: BranchExpenseRow[];
  hrefFor: (branchId: string) => string;
  sharedHref?: string;
  sharedLabel?: string;
}) {
  const totals = rows.reduce(
    (acc, r) => ({ total: acc.total + r.total, toMain: acc.toMain + r.toMain }),
    { total: 0, toMain: 0 },
  );

  return (
    <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-right text-[13px]">
          <thead>
            <tr className="border-b border-card-border bg-[#f4f6f9]">
              <th className={TH}>סניף</th>
              <th className={TH}>סוג</th>
              <th className={TH}>קבועות</th>
              <th className={TH}>חד פעמיות</th>
              <th className={TH}>{'סה"כ עד היום'}</th>
              <th className={TH}>{'מזה לראשי'}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {sharedHref && (
              <tr className="border-b border-dashed border-card-border bg-[#f8fafc]">
                <td className={`${TD} font-bold text-ink`} colSpan={6}>
                  <Link href={sharedHref} className="flex items-center gap-1.5 hover:underline">
                    <Layers className="h-4 w-4 text-muted" />
                    {sharedLabel ?? "הוצאות על כל הסניפים יחד"}
                  </Link>
                </td>
              </tr>
            )}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2.5 py-6 text-center text-sm text-muted">
                  אין עדיין סניפים
                </td>
              </tr>
            )}
            {rows.map((r, idx) => (
              <tr key={r.branch.id} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                <td className={`${TD} font-bold text-ink`}>
                  <Link href={hrefFor(r.branch.id)} className="flex items-center gap-1.5 hover:underline">
                    <Building2 className="h-3.5 w-3.5 text-muted" />
                    {r.branch.name}
                  </Link>
                </td>
                <td className={`${TD} text-muted`}>{r.branch.isMine === false ? "שותפות" : "קלאסי"}</td>
                <td className={`${TD} text-muted`}>{r.fixedCount}</td>
                <td className={`${TD} text-muted`}>{r.variableCount}</td>
                <td className={`${TD} font-semibold text-red-600`}>{r.total > 0 ? money(r.total) : "-"}</td>
                <td className={`${TD} font-semibold text-teal-dark`}>{r.toMain > 0 ? money(r.toMain) : "-"}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-card-border bg-[#f4f6f9]">
                <td className={`${TD} font-black text-ink`} colSpan={4}>
                  {'סה"כ'}
                </td>
                <td className={`${TD} font-black text-red-600`}>{money(totals.total)}</td>
                <td className={`${TD} font-black text-teal-dark`}>{money(totals.toMain)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
