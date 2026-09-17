import Link from "next/link";
import { ArrowLeft, BellRing } from "lucide-react";
import type { RecurringVariableExpense } from "@ultranet/shared-types";
import {
  RECURRING_FREQUENCY_LABELS,
  buildReminders,
  currentMonth,
  frequencyOf,
} from "@/lib/recurring-expenses";
import { setRecurringMonthAmountAction } from "@/components/recurring-expenses/actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

/**
 * ההוצאות הקבועות-המשתנות שחסר להן חודש — חשמל, ארנונה, מים.
 *
 * זו רשימת המטלות של המסך: לא היסטוריה ולא סיכום, אלא בדיוק השורות שממתינות להקלדה
 * היום. השורה נושאת את שם הסניף ואת שם ההוצאה יחד, כי "חשמל" לבדו אינו אומר של מי, ואת
 * שדה הסכום במקום — כדי שהעדכון לא ידרוש מעבר למסך אחר. ברגע שהחודש האחרון שחסר הוקלד
 * השורה נעלמת מעצמה: `buildReminders` מחזיר רק הוצאות שבאמת חסר להן חודש שנסגר.
 */
export function PendingRecurringRows({
  expenses,
  branchNameById,
  canManage,
}: {
  expenses: RecurringVariableExpense[];
  branchNameById: ReadonlyMap<string, string>;
  canManage: boolean;
}) {
  const now = currentMonth();
  const reminders = buildReminders(expenses, now);
  if (reminders.length === 0) {
    return (
      <div className="rounded-card border border-card-border bg-white p-4 text-center text-[13px] text-muted shadow-card">
        כל ההוצאות הקבועות-המשתנות מעודכנות — אין שורה שממתינה לעדכון.
      </div>
    );
  }

  const dueNow = reminders.filter((r) => r.dueNow).length;

  return (
    <div className="rounded-card border border-amber-300 bg-amber-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-amber-800">
        <span className="flex items-center gap-1.5">
          <BellRing className="h-4 w-4" />
          {`שורות שדורשות עדכון — ${monthLabel(now)}`}
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 normal-case text-amber-900">
          {dueNow > 0 ? `${dueNow} לחודש הזה` : `${reminders.length} חסרים`}
        </span>
      </div>

      {reminders.map((r) => {
        const setAmount = setRecurringMonthAmountAction.bind(null, r.expense.id);
        const branchLabel = r.expense.branchId
          ? (branchNameById.get(r.expense.branchId) ?? "כל הסניפים")
          : "כל הסניפים";
        return (
          <div key={r.expense.id} className="border-b border-amber-200 py-2 last:border-b-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              <span className={`h-2 w-2 shrink-0 rounded-full ${r.dueNow ? "bg-red-500" : "bg-amber-500"}`} />
              <span className="font-bold text-ink">
                {branchLabel} — {r.expense.name}
              </span>
              <span className="text-[11px] text-muted">
                {r.expense.category ? `${r.expense.category} · ` : ""}
                {RECURRING_FREQUENCY_LABELS[frequencyOf(r.expense)]}
              </span>
              <span className="text-[11px] font-bold text-amber-900">
                {r.dueNow ? "לתשלום החודש" : `הכי ישן שחסר ${monthLabel(r.oldestMissing)}`}
                {r.overdue > 0 && ` · ${r.overdue} חודשים קודמים חסרים`}
              </span>
              {r.suggestedAmount > 0 && (
                <span className="text-[11px] text-muted">אחרון שנרשם {money(r.suggestedAmount)}</span>
              )}
            </div>
            {canManage && (
              <form action={setAmount} className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <input type="hidden" name="month" value={r.oldestMissing} />
                <span className="text-[11px] font-semibold text-muted">{monthLabel(r.oldestMissing)}</span>
                <input
                  name="amount"
                  type="number"
                  step="0.01"
                  defaultValue={r.suggestedAmount || ""}
                  placeholder="סכום ₪"
                  required
                  className="w-24 rounded border border-amber-300 bg-white px-1.5 py-0.5 text-center text-[12px] tabular-nums focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white transition hover:opacity-90"
                >
                  שולם — עדכן
                </button>
                <Link
                  href={r.expense.branchId ? `/dashboard/expenses/${r.expense.branchId}` : "/dashboard/expenses"}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:underline"
                >
                  לכל ההיסטוריה
                  <ArrowLeft className="h-3 w-3" />
                </Link>
              </form>
            )}
          </div>
        );
      })}
    </div>
  );
}
