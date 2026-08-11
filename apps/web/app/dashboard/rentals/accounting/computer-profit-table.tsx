import { Check, Minus } from "lucide-react";
import type { ComputerProfitMonth } from "@/lib/branch-accounting";

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${m ?? ""}/${(y ?? "").slice(2)}`;
}

/** Mini Excel-style strip of the last months' profit-per-computer, green when it clears the
 *  150 ₪ + VAT target. Months run across as columns (not one row per month) so many months -
 *  and many of these tables stacked per branch - stay quick to scan without eating vertical space. */
export function ComputerProfitTable({ trend, compact }: { trend: ComputerProfitMonth[]; compact?: boolean }) {
  if (!trend || trend.length === 0) return null;
  const cell = compact ? "px-1.5 py-1" : "px-2 py-1.5";
  const textSize = compact ? "text-[10px]" : "text-xs";
  const labelCell = `${cell} sticky right-0 bg-[#f4f6f9] text-right font-bold text-muted whitespace-nowrap`;
  return (
    <div className="overflow-hidden rounded-lg border border-card-border">
      <div className="overflow-x-auto">
        <table className={`w-full border-collapse text-center ${textSize}`}>
          <thead>
            <tr className="bg-[#f4f6f9] font-bold uppercase tracking-wide text-muted">
              <th className={labelCell}>חודש</th>
              {trend.map((m) => (
                <th key={m.month} className={`${cell} whitespace-nowrap`}>
                  {formatMonthLabel(m.month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular-nums">
            <tr>
              <td className={labelCell}>רווח/מחשב</td>
              {trend.map((m) => (
                <td
                  key={m.month}
                  className={`${cell} whitespace-nowrap font-bold ${m.isHealthy ? "bg-emerald-50 text-teal-dark" : "text-red-600"}`}
                >
                  <span className="flex items-center justify-center gap-1">
                    {Math.round(m.profitPerComputer).toLocaleString("he-IL")}
                    {m.isHealthy ? (
                      <Check className="h-3 w-3 shrink-0" />
                    ) : (
                      <Minus className="h-3 w-3 shrink-0 text-muted" />
                    )}
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className={labelCell}>מחשבים</td>
              {trend.map((m) => (
                <td key={m.month} className={`${cell} whitespace-nowrap text-muted`}>
                  {m.computerCount}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
