"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { LaptopBranchTracking } from "@/lib/laptop-branch-tracking";

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${(y ?? "").slice(2)}`;
}

function fmt(n: number) {
  return Math.round(n).toLocaleString("he-IL");
}

type Mode = "perComputer" | "total";

/**
 * חודשים לרוחב, סניפים לאורך. תא ריק = הסניף לא היה קיים באותו חודש, ולכן הוא באמת ריק
 * ולא אפס — ההבדל בין "לא היה" ל"היה ולא הרוויח" הוא כל מה שהמסך הזה בא להראות.
 *
 * שתי תצוגות לאותם נתונים: **למחשב** (המדד מול היעד) ו**כולל** — כמה הרווחתי מהסניף באותו
 * חודש, בשקלים. השאלה "כמה הרווחתי מכל סניף החודש" נשאלת בכולל; "האם הסניף עומד ביעד" — למחשב.
 */
export function TrackingTable({ tracking }: { tracking: LaptopBranchTracking }) {
  const { months, rows, target } = tracking;
  const [mode, setMode] = useState<Mode>("perComputer");

  const monthTotals = months.map((_, i) =>
    rows.reduce((sum, r) => {
      const c = r.cells[i];
      return c && c.existed ? sum + c.netProfit : sum;
    }, 0),
  );

  return (
    <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
      <div className="flex items-center gap-1.5 border-b border-card-border bg-[#fafbfc] px-3 py-2">
        <span className="text-[11px] font-bold text-muted">תצוגה:</span>
        {(
          [
            ["perComputer", "רווח למחשב"],
            ["total", "רווח כולל מהסניף"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
              mode === key ? "bg-teal text-white" : "border border-card-border bg-white text-ink hover:border-teal"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-center text-[12px]">
          <thead>
            <tr className="bg-[#f4f6f9] text-[11px] font-bold uppercase tracking-wide text-muted">
              <th className="sticky right-0 z-10 bg-[#f4f6f9] px-2.5 py-2 text-right">סניף</th>
              {months.map((m) => (
                <th key={m} className="whitespace-nowrap px-2 py-2">
                  {monthLabel(m)}
                </th>
              ))}
              <th className="whitespace-nowrap px-2.5 py-2">ממוצע</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.length === 0 && (
              <tr>
                <td colSpan={months.length + 2} className="px-2.5 py-6 text-sm text-muted">
                  אין סניפי ניידים
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={row.branch.id} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                <td
                  className={`sticky right-0 z-10 px-2.5 py-1.5 text-right font-bold text-ink ${
                    idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"
                  }`}
                >
                  {row.branch.name}
                  {row.isMineBranch && <span className="mr-1.5 text-[10px] font-bold text-teal-dark">(שלי)</span>}
                </td>
                {row.cells.map((c) => {
                  const empty = mode === "perComputer" ? c.profitPerComputer === null : !c.existed;
                  if (empty) {
                    return (
                      <td key={c.month} className="px-2 py-1.5 text-muted">
                        &nbsp;
                      </td>
                    );
                  }
                  const title =
                    `${c.computerCount} מחשבים · רווח ${fmt(c.netProfit)} ₪` +
                    (c.saleIncome > 0 ? ` · מכירות ${fmt(c.saleIncome)} ₪ (לא כלול)` : "");
                  const good = mode === "perComputer" ? c.isHealthy : c.netProfit >= 0;
                  return (
                    <td
                      key={c.month}
                      title={title}
                      className={`whitespace-nowrap px-2 py-1.5 font-bold ${
                        good ? "bg-emerald-50 text-teal-dark" : "text-red-600"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-0.5">
                        {mode === "perComputer" ? fmt(c.profitPerComputer ?? 0) : fmt(c.netProfit)}
                        {mode === "perComputer" && c.isHealthy && <Check className="h-3 w-3 shrink-0" />}
                      </span>
                      <span className="block text-[9.5px] font-normal text-muted">
                        {c.computerCount} מח׳
                        {c.saleIncome > 0 && <span className="mr-1 font-bold text-sky-700">+מכירה</span>}
                      </span>
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-2.5 py-1.5 font-black text-ink">
                  {mode === "perComputer"
                    ? row.average === null
                      ? "-"
                      : fmt(row.average)
                    : row.averageTotal === null
                      ? "-"
                      : fmt(row.averageTotal)}
                </td>
              </tr>
            ))}
          </tbody>
          {mode === "total" && rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-card-border bg-[#f4f6f9] tabular-nums">
                <td className="sticky right-0 z-10 bg-[#f4f6f9] px-2.5 py-1.5 text-right font-black text-ink">
                  {'סה"כ'}
                </td>
                {monthTotals.map((t, i) => (
                  <td
                    key={months[i]}
                    className={`whitespace-nowrap px-2 py-1.5 font-black ${t >= 0 ? "text-teal-dark" : "text-red-600"}`}
                  >
                    {fmt(t)}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="border-t border-card-border px-4 py-2.5 text-[11px] leading-relaxed text-muted">
        <b>רווח כולל</b> = הרווח התפעולי שלי מהסניף באותו חודש: החלק שלי בהכנסות מהשכרות, פחות החלק שלי
        בהוצאות, פחות האחוזים שאני מעביר. <b>רווח למחשב</b> = אותו מספר מחולק במספר המחשבים שהיו בסניף
        באותו חודש (מחשב נספר מהחודש שנוסף ועד החודש שנמכר/הוצא בו). ירוק = עומד ביעד של {target} ₪ למחשב
        לחודש (150 ₪ + מע&quot;מ). תא ריק = הסניף עדיין לא היה קיים (או כבר נסגר).
        <br />
        <b>מה לא נספר כאן:</b> רכש — עלות הוספת מחשבים, והוצאה חד-פעמית שאני שילמתי והחוב כולו עליי (בסניף
        שלי: רק כשסווגה &quot;ציוד ותחזוקה&quot;). זו השקעה בסניף, לא עלות תפעול. גם מכירת מחשב לא נכנסת
        לרווח התפעולי — היא מסומנת &quot;+מכירה&quot; בתא. הוצאות קבועות נספרות תמיד.
      </p>
    </div>
  );
}
