import Link from "next/link";
import { ArrowLeft, BellRing } from "lucide-react";
import type { ExpenseScope, RecurringVariableExpense } from "@ultranet/shared-types";
import {
  RECURRING_FREQUENCY_LABELS,
  buildReminders,
  currentMonth,
  frequencyOf,
} from "@/lib/recurring-expenses";
import { setRecurringMonthAmountAction } from "./actions";

const SCOPE_LABELS: Record<ExpenseScope, string> = {
  computers: "חדרי מחשבים",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
  main: 'הנה"ח ראשית',
};

function scopeHref(expense: RecurringVariableExpense): string {
  switch (expense.scope) {
    case "computers":
      return expense.branchId ? `/dashboard/expenses/${expense.branchId}` : "/dashboard/expenses";
    case "rentals":
      return expense.branchId ? `/dashboard/rentals/expenses/${expense.branchId}` : "/dashboard/rentals/expenses";
    case "coworking":
      return "/dashboard/coworking/accounting";
    default:
      return "/dashboard/accounting/extra-expenses";
  }
}

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${y}`;
}

/**
 * תזכורת התשלומים החודשית בדף הבית.
 *
 * ההתראה על חשמל שלא עודכן חיה עד היום רק בתוך מסך ההוצאות של הסניף, כלומר במקום שנכנסים
 * אליו כשכבר זוכרים. תזכורת שצריך לזכור לחפש אותה אינה תזכורת — ולכן היא כאן, בעמוד
 * שנפתח ממילא בכל בוקר, עם שדה הסכום במקום כדי שהעדכון יקרה בלי לעזוב את הדף.
 *
 * הסכום המוצע הוא האחרון שנרשם: אף אחד לא מקליד את חשבון החשמל מאפס, הוא מתקן את של
 * החודש שעבר.
 */
export function HomeRecurringReminders({
  expenses,
  canManage,
}: {
  expenses: RecurringVariableExpense[];
  canManage: boolean;
}) {
  const now = currentMonth();
  const reminders = buildReminders(expenses, now);
  if (reminders.length === 0) return null;

  const dueNow = reminders.filter((r) => r.dueNow).length;

  return (
    <div className="card border-amber-300 bg-amber-50">
      <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-amber-800">
        <span className="flex items-center gap-1.5">
          <BellRing className="h-4 w-4" />
          {`הוצאות קבועות לתשלום — ${monthLabel(now)}`}
        </span>
        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 normal-case text-amber-900">
          {dueNow > 0 ? `${dueNow} לחודש הזה` : `${reminders.length} חסרים`}
        </span>
      </div>

      {reminders.map((r) => {
        const setAmount = setRecurringMonthAmountAction.bind(null, r.expense.id);
        return (
          <div key={r.expense.id} className="border-b border-amber-200 py-2 last:border-b-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              <span className={`h-2 w-2 shrink-0 rounded-full ${r.dueNow ? "bg-red-500" : "bg-amber-500"}`} />
              <span className="font-bold text-ink">{r.expense.name}</span>
              <span className="text-[11px] text-muted">
                {SCOPE_LABELS[r.expense.scope]} · {RECURRING_FREQUENCY_LABELS[frequencyOf(r.expense)]}
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
              <form action={setAmount} className="mt-1.5 flex items-center gap-1.5">
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
                  href={scopeHref(r.expense)}
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
