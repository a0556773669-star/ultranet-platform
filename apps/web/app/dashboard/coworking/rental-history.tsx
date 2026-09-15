import type { ReactNode } from "react";
import { History, CheckCircle2 } from "lucide-react";
import { rentalTotals, type CoworkingClientStatus } from "@/lib/coworking";
import { markStationPaidAction, unmarkStationPaidAction, deleteRentalAction } from "./station-actions";
import { DeleteRentalButton } from "./delete-rental-button";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const FIELD =
  "w-24 rounded-lg border border-card-border bg-white px-2 py-1 text-[12px] focus:border-teal focus:outline-none";

/**
 * היסטוריית ההשכרות של העמדות.
 *
 * השכרה שהסתיימה לא מפסיקה להיות רלוונטית: היא עדיין שאלה פתוחה של מי שילם ומי לא,
 * ובלי המסך הזה השוכר הקודם פשוט נעלם ברגע שנרשם לו תאריך סיום. לכן הטבלה מציגה את
 * **כל** ההשכרות - פעילות והיסטוריות באותה רשימה - וכל שורה נפתחת ללוח חודשים מלא,
 * שבו אפשר לסמן ולבטל תשלום גם לחודש שעבר מזמן.
 */
export function RentalHistory({
  statuses,
  month,
  canDelete,
  title = "היסטוריית השכרות",
  intro = "כל מי שהשכיר עמדה — פעיל והיסטורי. לחיצה על שורה פותחת את לוח החודשים, ומאפשרת לסמן תשלום בדיעבד או למחוק את ההשכרה.",
  emptyText = "עדיין לא נרשמה אף השכרה בעמדות.",
  hideWhenEmpty = false,
  tone = "default",
  extra,
}: {
  statuses: CoworkingClientStatus[];
  month: string;
  canDelete: boolean;
  title?: string;
  intro?: string;
  emptyText?: string;
  /** רשימה ריקה = אין מה לספר, ולכן אין סעיף. בשימוש בסעיף ההשכרות היתומות, שקיים רק כשיש כאלה. */
  hideWhenEmpty?: boolean;
  tone?: "default" | "warn";
  /** תוכן נוסף בראש הפתיחה של כל שורה — למשל טופס התיקון של השכרה יתומה. */
  extra?: (status: CoworkingClientStatus) => ReactNode;
}) {
  const frame =
    tone === "warn" ? "rounded-card border border-amber-300 bg-amber-50 p-4" : "rounded-card border border-card-border bg-white p-4 shadow-card";

  if (statuses.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <section className={frame}>
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <History className="h-4 w-4" />
          {title}
        </h2>
        <p className="text-[12.5px] text-muted">{emptyText}</p>
      </section>
    );
  }

  // החדשה ביותר למעלה: מי שהתחיל אחרון הוא מה שמחפשים כשנכנסים לכאן.
  const sorted = [...statuses].sort((a, b) => {
    const byStart = (b.client.startDate ?? "").localeCompare(a.client.startDate ?? "");
    return byStart !== 0 ? byStart : (a.client.name ?? "").localeCompare(b.client.name ?? "", "he");
  });

  return (
    <section className={frame}>
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-extrabold text-ink">
        <History className="h-4 w-4" />
        {title}
      </h2>
      <p className="mb-3 text-[11.5px] text-muted">{intro}</p>

      <div className="flex flex-col gap-2">
        {sorted.map((s) => {
          const { rows, billed, paid, debt } = rentalTotals(s);
          // "הסתיימה" לפי אותה הגדרה שהמסך משתמש בה לעמדה: סיום עתידי הוא עדיין השכרה פעילה.
          const ended = !s.active;
          return (
            <details key={s.client.id} className="rounded-lg border border-card-border bg-[#f9fafb]">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-white text-[12px] font-black text-ink">
                  {s.client.stationNumber || s.station?.name || "?"}
                </span>
                <span className="text-[13px] font-extrabold text-ink">{s.client.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                    ended ? "bg-[#f4f6f9] text-muted" : "bg-teal-bg text-teal-dark"
                  }`}
                >
                  {ended ? "הסתיימה" : "פעילה"}
                </span>
                <span className="text-[11.5px] text-muted">
                  {s.client.startDate} — {s.client.endDate ?? "ממשיך"}
                </span>
                <span className="mr-auto flex flex-wrap items-center gap-2 text-[11.5px]">
                  <span className="text-muted">
                    לחיוב <b className="text-ink">{money(billed)}</b>
                  </span>
                  <span className="text-muted">
                    שולם <b className="text-emerald-600">{money(paid)}</b>
                  </span>
                  {debt > 0 ? (
                    <span className="font-extrabold text-red-600">חוב {money(debt)}</span>
                  ) : (
                    <span className="flex items-center gap-1 font-extrabold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      אין חוב
                    </span>
                  )}
                </span>
              </summary>

              <div className="border-t border-card-border p-3">
                {extra?.(s)}
                {rows.length === 0 ? (
                  <p className="text-[12px] text-muted">אין עדיין חודשים לחיוב בהשכרה הזו.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {rows.map((r) => (
                      <MonthRow key={r.month} clientId={s.client.id} row={r} isCurrent={r.month === month} />
                    ))}
                  </ul>
                )}

                {canDelete && (
                  <form
                    action={deleteRentalAction.bind(null, s.client.id)}
                    className="mt-2.5 flex items-center justify-end border-t border-card-border pt-2.5"
                  >
                    <DeleteRentalButton name={s.client.name} paymentCount={(s.client.payments ?? []).length} />
                  </form>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}

function MonthRow({
  clientId,
  row,
  isCurrent,
}: {
  clientId: string;
  row: { month: string; expected: number; payment?: { amount: number; date: string } };
  isCurrent: boolean;
}) {
  const markPaid = markStationPaidAction.bind(null, clientId, row.month);
  const unmark = unmarkStationPaidAction.bind(null, clientId, row.month);
  const paid = row.payment;

  return (
    <li
      className={`flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
        paid ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <span className="w-[72px] text-[12.5px] font-extrabold text-ink">{row.month}</span>
      {isCurrent && (
        <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-muted">החודש</span>
      )}

      {paid ? (
        <>
          <span className="text-[12px] font-bold text-emerald-700">שולם {money(paid.amount)}</span>
          <span className="text-[11px] text-emerald-700">נרשם ב-{paid.date}</span>
          <form action={unmark} className="mr-auto">
            <button
              type="submit"
              className="rounded-lg border border-card-border bg-white px-2 py-0.5 text-[11px] font-bold text-muted transition hover:border-red-200 hover:text-red-600"
            >
              ביטול סימון
            </button>
          </form>
        </>
      ) : (
        <>
          <span className="text-[12px] font-bold text-amber-900">לא שולם</span>
          <form action={markPaid} className="mr-auto flex items-center gap-1.5">
            <input
              name="amount"
              type="number"
              step="0.01"
              defaultValue={row.expected || undefined}
              required
              className={FIELD}
            />
            <button
              type="submit"
              className="rounded-lg bg-gradient-to-br from-teal to-teal-light px-2.5 py-1 text-[11px] font-bold text-white transition hover:opacity-90"
            >
              סמן כשולם
            </button>
          </form>
        </>
      )}
    </li>
  );
}
