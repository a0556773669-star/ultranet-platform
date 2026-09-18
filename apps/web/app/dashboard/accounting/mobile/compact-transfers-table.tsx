import Link from "next/link";
import type { BranchTransferRow } from "@/lib/branch-transfer-rows";
import { sumBranchTransferRows } from "@/lib/branch-transfer-rows";
import { TransferMarkCell } from "./transfer-mark-cell";

function money(n: number) {
  return `${Math.round(Math.abs(n)).toLocaleString("he-IL")} ₪`;
}

function Signed({ value, strong = false }: { value: number; strong?: boolean }) {
  if (Math.abs(value) < 1) return <span className="text-muted">{strong ? "מאוזן" : "-"}</span>;
  return (
    <span className={`${strong ? "font-black" : "font-semibold"} ${value > 0 ? "text-emerald-700" : "text-red-600"}`}>
      {value > 0 ? "+" : "−"}
      {money(value)}
    </span>
  );
}

const TH = "px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-2 py-1.5 whitespace-nowrap";

/**
 * ההעברות של החודש בארבע עמודות: מי, מה נגרר, כמה בסך הכל, והאם הועבר.
 *
 * הטבלה המלאה (`UnifiedBranchesTable`) לא נמחקה — היא נפתחת מכאן בכפתור. ההפרדה היא לפי
 * מה עושים ומה מבררים: ההחלטה היומית היא "כמה להעביר והאם העברתי", וההוצאות, ההכנסות
 * וההתחשבנות של החודש עצמו הן ההסבר מאחוריה. ההסבר לא צריך לתפוס חצי מסך כל יום, ולכן
 * הוא נמצא במרחק לחיצה אחת ולא פרוש כאן.
 *
 * שתי הטבלאות קוראות את אותן שורות מ-`lib/branch-transfer-rows.ts`, כדי שלא ייתכן מצב
 * שהמצומצמת והרחבה מראות שני סכומים לאותו סניף.
 */
export function CompactTransfersTable({ rows, month }: { rows: BranchTransferRow[]; month: string }) {
  const totals = sumBranchTransferRows(rows);

  return (
    <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-right text-[13px]">
          <thead>
            <tr className="border-b border-card-border bg-[#f4f6f9]">
              <th className={TH}>סניף</th>
              <th className={TH}>יתרה</th>
              <th className={TH}>צריך להעביר</th>
              <th className={TH}>הועבר</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-2.5 py-6 text-center text-sm text-muted">
                  אין סניפי השכרות פעילים
                </td>
              </tr>
            )}
            {rows.map((r, idx) => (
              <tr key={r.branch.id} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                <td className={`${TD} font-bold text-ink`}>
                  <Link
                    href={`/dashboard/rentals/accounting?month=${month}&branchId=${r.branch.id}#branch-history`}
                    className="hover:underline"
                    title="מעקב היסטוריה מלאה על הסניף הזה"
                  >
                    {r.branch.parentBranchId && <span className="ml-1 text-muted">↳</span>}
                    {r.branch.name}
                  </Link>
                </td>
                <td className={TD}>
                  <Signed value={r.opening} />
                </td>
                <td className={TD}>
                  <Signed value={r.totalDue} strong />
                </td>
                <td className={TD}>
                  <TransferMarkCell
                    // שתי הטבלאות — המצומצמת וזו שבחלון — מציגות את אותה שורה, וכל אחת
                    // מחזיקה את מצב התיבה אצלה. בלי מפתח שתלוי בסכום, סימון בטבלה אחת היה
                    // משאיר את השנייה עם הערך הישן עד רענון מלא של העמוד.
                    key={`${r.branch.id}|${r.transferredAmount}`}
                    branchId={r.branch.id}
                    month={month}
                    netToOwner={r.netToOwner}
                    totalDue={r.totalDue}
                    transferredAmount={r.transferredAmount}
                  />
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-card-border bg-[#f4f6f9] tabular-nums">
                <td className={`${TD} font-black text-ink`}>{"סה\"כ"}</td>
                <td className={TD}>
                  <Signed value={totals.opening} />
                </td>
                <td className={TD}>
                  <Signed value={totals.totalDue} strong />
                </td>
                <td className={TD} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="border-t border-card-border px-3 py-2 text-[11px] leading-relaxed text-muted">
        <span className="font-bold text-emerald-700">+ ירוק</span> = צריכים להעביר אליך.{" "}
        <span className="font-bold text-red-600">− אדום</span> = אתה צריך להעביר.
        &quot;יתרה&quot; = מה שנשאר לא מועבר מחודשים קודמים; &quot;צריך להעביר&quot; כולל אותה.
        סימון התיבה רושם את מלוא הסכום (ניתן להקליד סכום חלקי) ויוצר רשומת הכנסה בהנה&quot;ח.
        ההוצאות, ההכנסות והקבלות של אותו חודש נמצאים בטבלה הרחבה.
      </p>
    </div>
  );
}
