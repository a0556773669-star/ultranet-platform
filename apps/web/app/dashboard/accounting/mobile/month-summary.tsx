import type { LaptopBranchTracking, TrackingCell } from "@/lib/laptop-branch-tracking";

function fmt(n: number) {
  return Math.round(n).toLocaleString("he-IL");
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

type Status = "good" | "below" | "na";

function statusOf(c: TrackingCell | undefined): Status {
  if (!c || c.profitPerComputer === null) return "na";
  return c.isHealthy ? "good" : "below";
}

const STATUS_LABEL: Record<Status, string> = { good: "עומד ביעד", below: "מתחת ליעד", na: "לא ניתן לחשב" };

/**
 * רווחיות החודש האחרון שהסתיים (אפיון שדרוג v2, סעיף 6; מסמך המשך 1, סעיפים 21 ו-23):
 * טבלה קצרה — סניף, מחשבים, רווח נטו שלי, נטו למחשב ומול החודש הקודם — ממוינת כך שמה שדורש
 * טיפול עולה למעלה. **אותם נתונים בדיוק** של טבלת המעקב (`buildLaptopBranchTracking`), בלי
 * חישוב נוסף; ההשוואה מוצגת רק כששני החודשים ניתנים לחישוב, אחרת "אין השוואה". החודש הנוכחי
 * מסומן "בתהליך". חודש סגור קלנדרית אינו הוכחה שכל נתוניו הוזנו.
 */
export function MonthSummary({ tracking }: { tracking: LaptopBranchTracking }) {
  const [prevMonth, closedMonth, currentMonth] = tracking.months as [string, string, string];
  const rows = tracking.rows
    .map((row) => {
      const byMonth = new Map(row.cells.map((c) => [c.month, c]));
      const cur = byMonth.get(closedMonth);
      const prev = byMonth.get(prevMonth);
      const live = byMonth.get(currentMonth);
      const comparable = cur?.profitPerComputer != null && prev?.profitPerComputer != null;
      return {
        row,
        cur,
        live,
        status: statusOf(cur),
        delta: comparable ? cur!.profitPerComputer! - prev!.profitPerComputer! : null,
      };
    })
    .filter((r) => r.cur?.existed || r.live?.existed)
    // מה שדורש טיפול קודם: מתחת ליעד (מהנמוך לגבוה), אחר כך "לא ניתן לחשב", ובסוף מי שעומד ביעד.
    .sort((a, b) => {
      const rank: Record<Status, number> = { below: 0, na: 1, good: 2 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return (a.cur?.profitPerComputer ?? 0) - (b.cur?.profitPerComputer ?? 0);
    });

  return (
    <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-card-border px-4 py-2.5">
        <div className="text-sm font-extrabold text-ink">{`רווחיות ${monthLabel(closedMonth)} — החודש האחרון שהסתיים`}</div>
        <div className="text-[11px] text-muted">{`יעד: ${tracking.target} ₪ נטו למחשב · ממוין לפי צורך בטיפול`}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f4f6f9] text-muted">
            <tr>
              <th className="px-3 py-2 text-right text-[11px] font-bold">סניף</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold">מחשבים שקולים</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold">רווח נטו שלי</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold">נטו למחשב</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold">{`מול ${monthLabel(prevMonth)}`}</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold">{`${monthLabel(currentMonth)} (בתהליך)`}</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map(({ row, cur, live, status, delta }) => (
              <tr key={row.branch.id} className="border-t border-card-border">
                <td className="px-3 py-2 font-bold text-ink">{row.branch.name}</td>
                <td className="px-3 py-2">{cur?.existed ? (Number.isInteger(cur.computerCount) ? cur.computerCount : cur.computerCount.toFixed(1)) : "—"}</td>
                <td className="px-3 py-2">{cur?.existed ? `${fmt(cur.netProfit)} ₪` : "—"}</td>
                <td className="px-3 py-2">
                  {status === "na" ? (
                    <span className="text-muted">{STATUS_LABEL.na}</span>
                  ) : (
                    <span className={`font-bold ${status === "good" ? "text-teal-dark" : "text-red-600"}`}>
                      {`${fmt(cur!.profitPerComputer!)} ₪ · ${STATUS_LABEL[status]}`}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {delta === null ? (
                    <span className="text-muted">אין השוואה</span>
                  ) : (
                    <span className={delta >= 0 ? "text-teal-dark" : "text-red-600"}>
                      {`${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta))} ₪`}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted">
                  {live?.profitPerComputer != null ? `${fmt(live.profitPerComputer)} ₪` : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted">
                  אין סניפים פעילים בחודשים האלה
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-card-border px-4 py-2 text-[11px] text-muted">
        &quot;לא ניתן לחשב&quot; = לא היו מחשבים בסניף באותו חודש (מכנה אפס) — לא אפס ולא ירוק. ההיסטוריה המלאה וההשוואה
        בין חודשים — בטבלת המעקב למטה.
      </p>
    </div>
  );
}
