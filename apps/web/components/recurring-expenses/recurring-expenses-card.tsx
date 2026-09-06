import { Gauge, AlertTriangle } from "lucide-react";
import type { ExpenseScope, RecurringVariableExpense } from "@ultranet/shared-types";
import {
  buildReminders,
  currentMonth,
  expectedMonths,
  amountForMonth,
  missingMonths,
  totalToDate,
} from "@/lib/recurring-expenses";
import { countsToMain } from "@/lib/counts-to-main";
import { CountsToMainField, CountsToMainBadge } from "@/components/counts-to-main-field";
import {
  createRecurringVariableExpenseAction,
  setRecurringMonthAmountAction,
  deleteRecurringVariableExpenseAction,
} from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";
const BTN =
  "rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${(y ?? "").slice(2)}`;
}

/**
 * "הוצאות קבועות משתנות" — שורה אחת לכל הוצאה, ועמודה לכל חודש.
 *
 * התא הריק הוא הפיצ'ר: הוא לא אומר "אפס", הוא אומר "עוד לא עדכנת", והוא הדבר היחיד
 * שהמסך הזה באמת צריך לעשות — לעמוד מול הבעלים ב-1 לחודש ולשאול כמה היה החשמל.
 * הטופס הקטן בכל תא חסר הוא התשובה במקום, בלי לפתוח מסך אחר.
 */
export function RecurringExpensesCard({
  scope,
  branchId,
  expenses,
  canManage,
  monthsBack = 6,
  title = "הוצאות קבועות משתנות",
  subtitle = 'הוצאה שחוזרת כל חודש אבל הסכום שלה משתנה — חשמל, משכורת, מע"מ. המערכת מזכירה בכל חודש שלא עודכן.',
}: {
  scope: ExpenseScope;
  branchId?: string;
  expenses: RecurringVariableExpense[];
  canManage: boolean;
  monthsBack?: number;
  title?: string;
  subtitle?: string;
}) {
  const now = currentMonth();
  const reminders = buildReminders(expenses, now);

  // The visible window is the last `monthsBack` months of the widest expense, so a single
  // late row doesn't force the whole table wide.
  const allMonths = new Set<string>();
  for (const e of expenses) for (const m of expectedMonths(e, now)) allMonths.add(m);
  const months = [...allMonths].sort().slice(-monthsBack);

  const create = createRecurringVariableExpenseAction.bind(null, scope, branchId);

  return (
    <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-ink">
        <Gauge className="h-4 w-4" />
        {title}
      </h3>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">{subtitle}</p>

      {reminders.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            צריך עדכון ({reminders.length})
          </p>
          <ul className="mt-1 space-y-0.5 text-[11.5px] text-amber-900">
            {reminders.map((r) => (
              <li key={r.expense.id}>
                <b>{r.expense.name}</b> — חסרים {r.missing.length} חודשים, הכי ישן {monthLabel(r.oldestMissing)}
                {r.suggestedAmount > 0 && <span className="text-amber-700"> · אחרון שנרשם {money(r.suggestedAmount)}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {expenses.length === 0 ? (
        <p className="mb-3 text-sm text-muted">אין עדיין הוצאות קבועות משתנות</p>
      ) : (
        <div className="mb-3 overflow-x-auto">
          <table className="w-full border-collapse text-right text-[12px]">
            <thead>
              <tr className="bg-[#f4f6f9] text-[11px] font-bold uppercase tracking-wide text-muted">
                <th className="sticky right-0 bg-[#f4f6f9] px-2 py-1.5 text-right">הוצאה</th>
                {months.map((m) => (
                  <th key={m} className="whitespace-nowrap px-2 py-1.5 text-center">
                    {monthLabel(m)}
                  </th>
                ))}
                <th className="whitespace-nowrap px-2 py-1.5 text-center">{'סה"כ עד היום'}</th>
                {canManage && <th className="px-2 py-1.5" />}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {expenses.map((e) => {
                const missing = new Set(missingMonths(e, now));
                const expected = new Set(expectedMonths(e, now));
                const del = deleteRecurringVariableExpenseAction.bind(null, e.id);
                return (
                  <tr key={e.id} className="border-b border-card-border last:border-b-0">
                    <td className="sticky right-0 bg-white px-2 py-1.5">
                      <span className="flex items-center gap-1.5 font-bold text-ink">
                        {e.name}
                        <CountsToMainBadge on={countsToMain(e)} />
                      </span>
                      <span className="block text-[10.5px] text-muted">
                        {e.category || "ללא קטגוריה"} · מ-{e.startDate}
                        {e.endDate ? ` · הופסק ${e.endDate}` : ""}
                      </span>
                    </td>
                    {months.map((m) => {
                      const value = amountForMonth(e, m);
                      if (!expected.has(m)) {
                        return (
                          <td key={m} className="px-2 py-1.5 text-center text-muted">
                            —
                          </td>
                        );
                      }
                      if (value !== null) {
                        return (
                          <td key={m} className="whitespace-nowrap px-2 py-1.5 text-center font-semibold text-ink">
                            {money(value)}
                          </td>
                        );
                      }
                      if (!canManage) {
                        return (
                          <td key={m} className="px-2 py-1.5 text-center text-amber-700">
                            ?
                          </td>
                        );
                      }
                      const setAmount = setRecurringMonthAmountAction.bind(null, e.id);
                      return (
                        <td key={m} className={`px-1 py-1 text-center ${missing.has(m) ? "bg-amber-50" : ""}`}>
                          <form action={setAmount} className="flex items-center gap-1">
                            <input type="hidden" name="month" value={m} />
                            <input
                              name="amount"
                              type="number"
                              step="0.01"
                              placeholder="₪"
                              required
                              className="w-16 rounded border border-amber-300 bg-white px-1 py-0.5 text-center text-[11px] focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                            >
                              עדכן
                            </button>
                          </form>
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-2 py-1.5 text-center font-black text-red-600">
                      {money(totalToDate(e, now))}
                    </td>
                    {canManage && (
                      <td className="px-2 py-1.5 text-center">
                        <form action={del}>
                          <button
                            type="submit"
                            className="rounded-lg border border-red-200 px-2 py-0.5 text-[10px] font-medium text-red-600 transition hover:bg-red-50"
                          >
                            מחיקה
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage && (
        <form action={create} className="grid grid-cols-2 gap-2 border-t border-card-border pt-3 md:grid-cols-4">
          <div>
            <label className={LABEL}>שם ההוצאה</label>
            <input name="name" placeholder="חשמל / משכורת מזכירה" className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>קטגוריה</label>
            <input name="category" className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>מתחיל מתאריך</label>
            <input name="startDate" type="date" defaultValue={`${now}-01`} className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>סכום משוער (לא חובה)</label>
            <input name="defaultAmount" type="number" step="0.01" className={FIELD} />
          </div>
          <div className="col-span-2 md:col-span-4">
            <CountsToMainField />
          </div>
          <div className="col-span-2 md:col-span-4">
            <button type="submit" className={BTN}>
              + הוסף הוצאה קבועה משתנה
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
