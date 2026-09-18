import type { ReactNode } from "react";
import { History, CheckCircle2, ChevronDown } from "lucide-react";
import { rentalTotals, type CoworkingClientStatus } from "@/lib/coworking";
import { markStationPaidAction, unmarkStationPaidAction, deleteRentalAction } from "./station-actions";
import { DeleteRentalButton } from "./delete-rental-button";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const FIELD =
  "w-24 rounded-lg border border-card-border bg-white px-2 py-1 text-[12px] focus:border-teal focus:outline-none";

/**
 * רשת העמודות של הטבלה. אותה רשת בדיוק לשורת הכותרת ולכל שורת השכרה — זה מה שהופך שורות
 * `<details>` לטבלה אמיתית שהעמודות שלה מיושרות, בלי לוותר על הפתיחה של שורה בודדת (שאותה
 * `<table>` לא יודעת לעשות בלי JavaScript).
 *
 * במסך צר נשארות שלוש העמודות שעונות על השאלה "מי ומה מצבו", והשאר יורדות.
 */
const ROW_GRID =
  "grid grid-cols-[1.6rem_minmax(5rem,1fr)_4.6rem] items-center gap-x-2.5 sm:grid-cols-[1.6rem_minmax(6.5rem,1.3fr)_4.6rem_minmax(8.5rem,1fr)_5.2rem_5.2rem_5.6rem]";
const HIDE_SM = "hidden sm:block";

/**
 * היסטוריית ההשכרות של העמדות — טבלה שנפתחת ונסגרת.
 *
 * השכרה שהסתיימה לא מפסיקה להיות רלוונטית: היא עדיין שאלה פתוחה של מי שילם ומי לא,
 * ובלי המסך הזה השוכר הקודם פשוט נעלם ברגע שנרשם לו תאריך סיום. לכן הטבלה מציגה את
 * **כל** ההשכרות - פעילות והיסטוריות באותה רשימה - וכל שורה נפתחת ללוח חודשים מלא,
 * שבו אפשר לסמן ולבטל תשלום גם לחודש שעבר מזמן.
 *
 * הסעיף כולו סגור כברירת מחדל: זו היסטוריה, ובמסך שהדבר החשוב בו הוא ארבע העמדות שמעליו
 * היא לא אמורה לדחוף אותן מעלה. פתיחה אחת מחזירה אותה במלואה.
 */
export function RentalHistory({
  statuses,
  month,
  canDelete,
  title = "היסטוריית השכרות",
  intro = "כל מי שהשכיר עמדה — פעיל והיסטורי. לחיצה על שורה פותחת את לוח החודשים, ומאפשרת לסמן תשלום בדיעבד או למחוק את ההשכרה.",
  emptyText = "עדיין לא נרשמה אף השכרה בעמדות.",
  hideWhenEmpty = false,
  defaultOpen = false,
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
  /** סעיף שהוא התראה ולא ארכיון (השכרות יתומות) נפתח מעצמו — אין טעם להתריע מאחורי קיפול. */
  defaultOpen?: boolean;
  tone?: "default" | "warn";
  /** תוכן נוסף בראש הפתיחה של כל שורה — למשל טופס התיקון של השכרה יתומה. */
  extra?: (status: CoworkingClientStatus) => ReactNode;
}) {
  const frame =
    tone === "warn"
      ? "overflow-hidden rounded-card border border-amber-300 bg-amber-50"
      : "overflow-hidden rounded-card border border-card-border bg-white shadow-card";

  if (statuses.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <section className={frame}>
        <div className="p-4">
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <History className="h-4 w-4" />
            {title}
          </h2>
          <p className="text-[12.5px] text-muted">{emptyText}</p>
        </div>
      </section>
    );
  }

  // החדשה ביותר למעלה: מי שהתחיל אחרון הוא מה שמחפשים כשנכנסים לכאן.
  const sorted = [...statuses].sort((a, b) => {
    const byStart = (b.client.startDate ?? "").localeCompare(a.client.startDate ?? "");
    return byStart !== 0 ? byStart : (a.client.name ?? "").localeCompare(b.client.name ?? "", "he");
  });

  const open = sorted.filter((s) => s.active).length;
  const debtors = sorted.filter((s) => rentalTotals(s).debt > 0).length;

  return (
    <details open={defaultOpen} className="group">
      <summary className={`${frame} flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 p-4`}>
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <History className="h-4 w-4" />
          {title}
        </h2>
        <span className="rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10.5px] font-extrabold text-muted">
          {sorted.length} השכרות · {open} פעילות
        </span>
        {debtors > 0 && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10.5px] font-extrabold text-red-600">
            {debtors} עם חוב
          </span>
        )}
        <span className="mr-auto flex items-center gap-1 text-[11.5px] font-bold text-teal">
          <span className="group-open:hidden">פתיחה</span>
          <span className="hidden group-open:inline">סגירה</span>
          <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
        </span>
      </summary>

      <div className={`${frame} mt-2`}>
        <p className="border-b border-card-border px-4 pb-2.5 pt-3 text-[11.5px] text-muted">{intro}</p>

        {/* שורת הכותרת של הטבלה */}
        <div
          className={`${ROW_GRID} border-b border-card-border bg-[#f9fafb] px-4 py-2 text-[10.5px] font-bold uppercase tracking-wide text-muted`}
        >
          <span>#</span>
          <span>שוכר</span>
          <span>סטטוס</span>
          <span className={HIDE_SM}>תקופה</span>
          <span className={`${HIDE_SM} text-left`}>לחיוב</span>
          <span className={`${HIDE_SM} text-left`}>שולם</span>
          <span className={`${HIDE_SM} text-left`}>חוב</span>
        </div>

        {sorted.map((s) => {
          const { rows, billed, paid, debt } = rentalTotals(s);
          // "הסתיימה" לפי אותה הגדרה שהמסך משתמש בה לעמדה: סיום עתידי הוא עדיין השכרה פעילה.
          const ended = !s.active;
          return (
            <details key={s.client.id} className="border-b border-card-border last:border-b-0 open:bg-[#f9fafb]">
              <summary className={`${ROW_GRID} cursor-pointer list-none px-4 py-2 transition hover:bg-[#f4f6f9]`}>
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-[11px] font-black text-ink shadow-card">
                  {s.client.stationNumber || s.station?.name || "?"}
                </span>
                <span className="truncate text-[12.5px] font-extrabold text-ink">{s.client.name}</span>
                <span
                  className={`justify-self-start rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold ${
                    ended ? "bg-[#f4f6f9] text-muted" : "bg-teal-bg text-teal-dark"
                  }`}
                >
                  {ended ? "הסתיימה" : "פעילה"}
                </span>
                <span className={`${HIDE_SM} text-[11px] tabular-nums text-muted`}>
                  {s.client.startDate} — {s.client.endDate ?? "ממשיך"}
                </span>
                <span className={`${HIDE_SM} text-left text-[11.5px] font-bold tabular-nums text-ink`}>
                  {money(billed)}
                </span>
                <span className={`${HIDE_SM} text-left text-[11.5px] font-bold tabular-nums text-emerald-600`}>
                  {money(paid)}
                </span>
                <span className={HIDE_SM}>
                  {debt > 0 ? (
                    <span className="block text-left text-[11.5px] font-extrabold tabular-nums text-red-600">
                      {money(debt)}
                    </span>
                  ) : (
                    <span className="flex items-center justify-end gap-1 text-[11px] font-extrabold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      אין חוב
                    </span>
                  )}
                </span>
              </summary>

              <div className="border-t border-card-border bg-white p-3">
                {/* במסך צר הכסף לא נכנס לשורה עצמה, ולכן הוא נפתח כאן — אחרת "חוב" היה
                    קיים רק במסך רחב, וזו השאלה היחידה שבגללה פותחים שורה. */}
                <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[#f9fafb] px-2.5 py-1.5 text-[11.5px] sm:hidden">
                  <span className="text-muted">
                    {s.client.startDate} — {s.client.endDate ?? "ממשיך"}
                  </span>
                  <span className="text-muted">
                    לחיוב <b className="text-ink">{money(billed)}</b>
                  </span>
                  <span className="text-muted">
                    שולם <b className="text-emerald-600">{money(paid)}</b>
                  </span>
                  {debt > 0 && <span className="font-extrabold text-red-600">חוב {money(debt)}</span>}
                </div>

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
    </details>
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
