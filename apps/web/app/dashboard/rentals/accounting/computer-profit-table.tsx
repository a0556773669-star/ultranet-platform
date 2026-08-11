import { Check, Minus } from "lucide-react";
import type { ComputerProfitMonth } from "@/lib/branch-accounting";

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${m ?? ""}/${(y ?? "").slice(2)}`;
}

/** Mini Excel-style table of the last months' profit-per-computer, green when it clears the 150 ₪ + VAT target. */
export function ComputerProfitTable({ trend, compact }: { trend: ComputerProfitMonth[]; compact?: boolean }) {
  if (!trend || trend.length === 0) return null;
  const rows = [...trend].reverse(); // newest month first
  const textSize = compact ? "text-[10px]" : "text-xs";
  return (
    <div className="overflow-hidden rounded-lg border border-card-border">
      <table className={`w-full border-collapse text-right ${textSize}`}>
        <thead>
          <tr className="bg-[#f4f6f9] font-bold uppercase tracking-wide text-muted">
            <th className={compact ? "px-1.5 py-1" : "px-2 py-1.5"}>חודש</th>
            <th className={compact ? "px-1.5 py-1" : "px-2 py-1.5"}>רווח פר מחשב</th>
            <th className={compact ? "px-1.5 py-1" : "px-2 py-1.5"}>מחשבים</th>
            <th className={compact ? "px-1.5 py-1" : "px-2 py-1.5"}>יעד</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((m) => (
            <tr key={m.month} className={m.isHealthy ? "bg-emerald-50" : "bg-white"}>
              <td className={`${compact ? "px-1.5 py-1" : "px-2 py-1.5"} font-semibold text-ink`}>{formatMonthLabel(m.month)}</td>
              <td className={`${compact ? "px-1.5 py-1" : "px-2 py-1.5"} font-bold ${m.isHealthy ? "text-teal-dark" : "text-red-600"}`}>
                {Math.round(m.profitPerComputer).toLocaleString("he-IL")} ₪
              </td>
              <td className={`${compact ? "px-1.5 py-1" : "px-2 py-1.5"} text-muted`}>{m.computerCount}</td>
              <td className={compact ? "px-1.5 py-1" : "px-2 py-1.5"}>
                {m.isHealthy ? (
                  <Check className="h-3.5 w-3.5 text-teal-dark" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-muted" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
