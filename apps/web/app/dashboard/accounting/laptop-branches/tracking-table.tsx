import { Check } from "lucide-react";
import type { LaptopBranchTracking } from "@/lib/laptop-branch-tracking";

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${(y ?? "").slice(2)}`;
}

/**
 * חודשים לרוחב, סניפים לאורך. תא ריק = הסניף לא היה קיים באותו חודש, ולכן הוא באמת ריק
 * ולא אפס — ההבדל בין "לא היה" ל"היה ולא הרוויח" הוא כל מה שהמסך הזה בא להראות.
 */
export function TrackingTable({ tracking }: { tracking: LaptopBranchTracking }) {
  const { months, rows, target } = tracking;

  return (
    <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
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
                  if (c.profitPerComputer === null) {
                    return (
                      <td key={c.month} className="px-2 py-1.5 text-muted">
                        &nbsp;
                      </td>
                    );
                  }
                  return (
                    <td
                      key={c.month}
                      title={`${c.computerCount} מחשבים · רווח ${Math.round(c.netProfit).toLocaleString("he-IL")} ₪`}
                      className={`whitespace-nowrap px-2 py-1.5 font-bold ${
                        c.isHealthy ? "bg-emerald-50 text-teal-dark" : "text-red-600"
                      }`}
                    >
                      <span className="flex items-center justify-center gap-0.5">
                        {Math.round(c.profitPerComputer).toLocaleString("he-IL")}
                        {c.isHealthy && <Check className="h-3 w-3 shrink-0" />}
                      </span>
                      <span className="block text-[9.5px] font-normal text-muted">{c.computerCount} מח׳</span>
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-2.5 py-1.5 font-black text-ink">
                  {row.average === null ? "-" : Math.round(row.average).toLocaleString("he-IL")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-card-border px-4 py-2.5 text-[11px] leading-relaxed text-muted">
        המספר בתא = הרווח הנקי שלי מהסניף באותו חודש, מחולק במספר המחשבים שהיו בו באותו חודש (מחשב
        שנוסף באמצע נספר רק מהחודש שנוסף בו). ירוק = עומד ביעד של {target} ₪ למחשב לחודש (150 ₪ +
        מע&quot;מ). תא ריק = הסניף עדיין לא היה קיים.
      </p>
    </div>
  );
}
