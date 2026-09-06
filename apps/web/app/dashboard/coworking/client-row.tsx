import { User, Check } from "lucide-react";
import type { CoworkingClientStatus } from "@/lib/coworking";
import { countsToMain } from "@/lib/counts-to-main";
import { CountsToMainField, CountsToMainBadge } from "@/components/counts-to-main-field";
import { addPaymentAction, endCoworkingClientAction, reopenCoworkingClientAction } from "./actions";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * לקוח אחד: הפרטים שהבעלים ביקש לראות (תאריך התחלה, מספר עמדה, תאריך סיום, עלות חודשית),
 * ולידם רישום התשלום של החודש.
 *
 * הצ'קבוקס "לחשבן בהנה"ח הראשית" יושב על התשלום ולא על הלקוח, כי זו החלטה פר-תשלום:
 * חודש שנגבה דרך העסק וחודש ששולם ישירות הם שני דברים שונים, גם אצל אותו לקוח.
 */
export function ClientRow({
  status,
  month,
  showBranch,
}: {
  status: CoworkingClientStatus;
  month: string;
  showBranch: boolean;
}) {
  const { client, station, cost, payDay, unpaidMonths } = status;
  const addPayment = addPaymentAction.bind(null, client.id);
  const endClient = endCoworkingClientAction.bind(null, client.id);
  const reopen = reopenCoworkingClientAction.bind(null, client.id);
  const suggestedMonth = unpaidMonths[0] ?? month;
  const paidThisMonth = (client.payments ?? []).find((p) => p.month === month);

  return (
    <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="inline-flex items-center gap-1.5 font-extrabold text-ink">
            <User className="h-4 w-4" />
            {client.name}
          </span>
          <span className="mr-2 text-[12.5px] text-muted">
            עמדה {client.stationNumber || station?.name || "-"}
            {showBranch ? ` · ${status.branchName}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
          <span>
            התחיל <b className="text-ink">{client.startDate}</b>
          </span>
          {client.endDate && (
            <span>
              הפסיק <b className="text-ink">{client.endDate}</b>
            </span>
          )}
          <span>
            עלות חודשית <b className="text-ink">{money(cost)}</b>
          </span>
          <span>
            תשלום ב-<b className="text-ink">{payDay}</b> לחודש
          </span>
          <span>
            שולם עד היום <b className="text-emerald-700">{money(status.paidToDate)}</b>
          </span>
        </div>
      </div>

      {unpaidMonths.length > 0 ? (
        <p className="mb-2.5 rounded-lg bg-amber-50 px-3 py-1.5 text-[12px] font-bold text-amber-900">
          חסרים תשלומים: {unpaidMonths.join(", ")}
        </p>
      ) : (
        <p className="mb-2.5 flex items-center gap-1.5 text-[12px] font-bold text-teal-dark">
          <Check className="h-3.5 w-3.5" />
          מעודכן — אין חודשים פתוחים
        </p>
      )}

      {paidThisMonth && (
        <p className="mb-2.5 flex items-center gap-1.5 text-[11.5px] text-muted">
          תשלום {month}: {money(paidThisMonth.amount)}
          <CountsToMainBadge on={countsToMain(paidThisMonth)} />
        </p>
      )}

      <form action={addPayment} className="flex flex-wrap items-end gap-3">
        <div>
          <label className={LABEL}>חודש</label>
          <input name="month" type="month" defaultValue={suggestedMonth} required className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>סכום</label>
          <input name="amount" type="number" min={0} required defaultValue={cost} className={`w-28 ${FIELD}`} />
        </div>
        <div>
          <label className={LABEL}>אמצעי תשלום</label>
          <input name="paymentMethod" className={FIELD} />
        </div>
        <div className="min-w-[260px] flex-1">
          <CountsToMainField />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-1.5 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          רישום תשלום
        </button>
      </form>

      <div className="mt-2.5 border-t border-card-border pt-2">
        {client.endDate ? (
          <form action={reopen}>
            <button type="submit" className="text-[11px] font-bold text-teal underline">
              החזר ללקוחות פעילים
            </button>
          </form>
        ) : (
          <form action={endClient} className="flex items-center gap-2">
            <input name="endDate" type="date" className="rounded border border-card-border px-2 py-0.5 text-[11px]" />
            <button type="submit" className="text-[11px] font-bold text-muted underline hover:text-red-600">
              סמן שהפסיק
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
