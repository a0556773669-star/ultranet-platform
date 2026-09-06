import type { PartnerPayoutSummary } from "@/lib/partner-payouts";
import { PayoutMarkCell } from "./payout-mark-cell";

const TH = "px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-2.5 py-1.5 whitespace-nowrap";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${(y ?? "").slice(2)}`;
}

/**
 * יתרת שותפי המחשבים החיצוניים (למשל 15% מהברוטו של מחשבים מסוימים).
 *
 * מוצגים רק חודשים שיש בהם משהו - סכום שמגיע או תשלום שנרשם. חודש שקט לא מקבל שורה,
 * כי שורה של אפס לא אומרת כלום ורק מרחיקה את המספר שכן חשוב: היתרה בסוף.
 */
export function PartnerPayoutTable({
  summaries,
  currentMonth,
}: {
  summaries: PartnerPayoutSummary[];
  currentMonth: string;
}) {
  if (summaries.length === 0) {
    return (
      <div className="rounded-card border border-card-border bg-white p-5 text-center text-sm text-muted shadow-card">
        אין שותפי מחשבים עם יתרה. שותף מוגדר על המחשב עצמו (עמוד &quot;מחשבים&quot;): מסמנים
        &quot;שותפות&quot;, שם השותף ואחוז.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {summaries.map((s) => {
        const rows = s.rows.filter((r) => Math.abs(r.due) > 0.5 || Math.abs(r.paid) > 0.5);
        return (
          <div key={s.partnerName} className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border bg-[#f4f6f9] px-4 py-2.5">
              <span className="text-sm font-extrabold text-ink">{s.partnerName}</span>
              <span className="text-[12px] text-muted">
                הצטבר {money(s.totalDue)} · הועבר {money(s.totalPaid)} ·{" "}
                <b className={s.outstanding > 0.5 ? "text-red-600" : "text-teal-dark"}>
                  {s.outstanding > 0.5 ? `נותר להעביר ${money(s.outstanding)}` : "מסולק"}
                </b>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-right text-[13px]">
                <thead>
                  <tr className="border-b border-card-border">
                    <th className={TH}>חודש</th>
                    <th className={TH}>מחשבים</th>
                    <th className={TH}>ברוטו</th>
                    <th className={TH}>אחוז</th>
                    <th className={TH}>מגיע לו</th>
                    <th className={TH}>הועבר</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-2.5 py-5 text-center text-sm text-muted">
                        אין תנועה בחודשים האחרונים
                      </td>
                    </tr>
                  )}
                  {rows.map((r) => (
                    <tr key={r.month} className={r.month === currentMonth ? "bg-teal-bg/40" : ""}>
                      <td className={`${TD} font-bold text-ink`}>{monthLabel(r.month)}</td>
                      <td className={`${TD} text-muted`}>{r.computerNames.join(", ") || "-"}</td>
                      <td className={`${TD} text-muted`}>{r.totalRevenue > 0 ? money(r.totalRevenue) : "-"}</td>
                      <td className={`${TD} text-muted`}>{r.pct > 0 ? `${r.pct}%` : "-"}</td>
                      <td className={`${TD} font-bold text-red-600`}>{r.due > 0 ? money(r.due) : "-"}</td>
                      <td className={TD}>
                        <PayoutMarkCell partnerName={s.partnerName} month={r.month} due={r.due} paid={r.paid} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-card-border px-4 py-2 text-[11px] leading-relaxed text-muted">
              חודש שלא סומן כמועבר נשאר ביתרה ומצטבר לחודש הבא. סימון התיבה רושם את מלוא הסכום; אפשר
              גם להקליד סכום חלקי.
            </p>
          </div>
        );
      })}
    </div>
  );
}
