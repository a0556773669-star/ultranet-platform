import { UserCog } from "lucide-react";
import type { Branch } from "@ultranet/shared-types";
import type { BranchRevenueShare } from "@/lib/revenue-shares";
import type { PartnerPayoutSummary } from "@/lib/partner-payouts";
import { monthLabel } from "@/lib/branch-month-report";
import { PayoutMarkCell } from "./payout-mark-cell";

const TH = "px-2.5 py-1.5 text-[11px] font-bold text-muted whitespace-nowrap";
const TD = "px-2.5 py-1.5 whitespace-nowrap";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/** "2026-08-23" → "23/08/26" */
function shortDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${(y ?? "").slice(2)}`;
}

/**
 * הסדר אחוזים פר-סניף (30% מהסניף הראשי לאלישבע רומנו) — חודש אחרי חודש מתאריך ההתחלה.
 *
 * עד עכשיו הכרטיס הזה הציג מספר אחד: הברוטו והאחוז של החודש שבסוף חלון המעקב, שהוא כברירת
 * מחדל **החודש הנוכחי, שעוד לא נגמר**. בתחילת חודש זה היה סכום קטן שנראה כמו טעות, ולא היה
 * לו שום קשר למה שבאמת צריך להעביר. כאן כל חודש מקבל שורה, עם סימון "העברתי" לידה, והשורה
 * העליונה אומרת כמה נשאר. הנתונים הם בדיוק אלה של טבלת האחוזים בצד ההעברות
 * (`loadPartnerPayouts`) — אותה רשומה ב-`n_partner_payouts`, כך שסימון באחד מופיע בשני.
 */
export function BranchShareCard({
  shares,
  payouts,
  currentMonth,
}: {
  shares: { share: BranchRevenueShare; branch: Branch }[];
  payouts: PartnerPayoutSummary[];
  currentMonth: string;
}) {
  return (
    <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-extrabold text-ink">
        <UserCog className="h-4 w-4" />
        אחוזים מהברוטו של הסניף
      </h3>
      <p className="text-[11.5px] leading-relaxed text-muted">
        מי שמתפעל את המחשבים של הסניף מקבל אחוז מהברוטו שלו — כל השכרה שהוחזרה ושולמה מתאריך
        ההתחלה. הסכום <b>כבר ירד</b> מהרווח שבטבלה למעלה, ואין צורך לרשום אותו שוב כהוצאה. מסמנים
        כאן כל חודש שהועבר; חודש שלא סומן נשאר ביתרה.
      </p>

      <div className="mt-2.5 flex flex-col gap-3">
        {shares.map(({ share, branch }) => {
          const summary = payouts.find((p) => p.partnerName === share.personName);
          const fromMonth = share.startDate.slice(0, 7);
          const rows = (summary?.rows ?? []).filter(
            (r) => r.month >= fromMonth && (Math.abs(r.due) > 0.5 || Math.abs(r.paid) > 0.5),
          );
          const outstanding = summary?.outstanding ?? 0;
          // מה שנשאר להעביר על חודשים **שנסגרו** - החודש הנוכחי עוד גדל, ולכן הוא לא "חוב" עדיין.
          const closedOutstanding = rows
            .filter((r) => r.month < currentMonth)
            .reduce((s, r) => s + (r.due - r.paid), 0);
          return (
            <div key={`${share.personName}|${branch.id}`} className="overflow-hidden rounded-lg border border-card-border">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border bg-[#f4f6f9] px-3 py-2 text-[13px]">
                <span>
                  <b className="text-ink">{share.personName}</b>{" "}
                  <span className="text-muted">
                    · {share.pct}% מ<b className="text-ink">{branch.name}</b> · החל מ-{shortDate(share.startDate)}
                  </span>
                </span>
                <span className="text-[12px] text-muted">
                  הצטבר {money(summary?.totalDue ?? 0)} · הועבר {money(summary?.totalPaid ?? 0)} ·{" "}
                  <b className={outstanding > 0.5 ? "text-red-600" : "text-teal-dark"}>
                    {outstanding > 0.5 ? `נותר להעביר ${money(outstanding)}` : "מסולק"}
                  </b>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[460px] border-collapse text-right text-[13px]">
                  <thead>
                    <tr className="border-b border-card-border">
                      <th className={TH}>חודש</th>
                      <th className={TH}>ברוטו הסניף</th>
                      <th className={TH}>מגיע לה ({share.pct}%)</th>
                      <th className={TH}>הועבר?</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-2.5 py-4 text-center text-sm text-muted">
                          עוד אין השכרות שנספרות להסדר
                        </td>
                      </tr>
                    )}
                    {rows.map((r) => (
                      <tr key={r.month} className={`border-b border-card-border/60 ${r.month === currentMonth ? "bg-teal-bg/40" : ""}`}>
                        <td className={`${TD} font-bold text-ink`}>
                          {monthLabel(r.month)}
                          {r.month === fromMonth && share.startDate.slice(8) !== "01" && (
                            <span className="ms-1 text-[10.5px] font-normal text-muted">(מ-{shortDate(share.startDate)})</span>
                          )}
                          {r.month === currentMonth && (
                            <span className="ms-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                              חודש פתוח
                            </span>
                          )}
                        </td>
                        <td className={`${TD} text-muted`}>{r.totalRevenue > 0 ? money(r.totalRevenue) : "-"}</td>
                        <td className={`${TD} font-bold text-red-600`}>{r.due > 0 ? money(r.due) : "-"}</td>
                        <td className={TD}>
                          <PayoutMarkCell partnerName={share.personName} month={r.month} due={r.due} paid={r.paid} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {closedOutstanding > 0.5 && (
                <p className="border-t border-card-border bg-red-50 px-3 py-1.5 text-[11.5px] text-ink">
                  על חודשים שכבר נסגרו נשאר להעביר <b className="text-red-600">{money(closedOutstanding)}</b>.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
