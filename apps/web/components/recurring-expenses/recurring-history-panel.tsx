import { History, Save, Wand2 } from "lucide-react";
import type { RecurringVariableExpense } from "@ultranet/shared-types";
import {
  RECURRING_FREQUENCY_LABELS,
  amountForMonth,
  coveredMonths,
  cycleMonths,
  currentMonth,
  dueMonths,
  frequencyOf,
  isSpread,
  missingMonths,
} from "@/lib/recurring-expenses";
import { CountsToMainField } from "@/components/counts-to-main-field";
import {
  clearRecurringMonthAction,
  fillRecurringHistoryAction,
  setRecurringMonthAmountAction,
  updateRecurringVariableExpenseAction,
} from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${(y ?? "").slice(2)}`;
}

/**
 * עריכת ההיסטוריה המלאה של הוצאה קבועה משתנה.
 *
 * הטבלה בכרטיס מראה חלון של כמה חודשים אחרונים, וזה נכון לעבודה היומיומית ושגוי לגמרי
 * ברגע שרושמים במערכת הוצאה שקיימת כבר שנה: החודשים החסרים פשוט לא נמצאים על המסך, אז
 * ההתראה מתלוננת על מה שאי אפשר לתקן. כאן נפתחים **כל** החודשים מיום ההתחלה, כל אחד
 * עם הסכום שלו לעריכה, ולא רק החסרים - טעות הקלדה מלפני חצי שנה היא בדיוק אותו צורך.
 *
 * `<details>` ולא סטייט: זה נשאר Server Component, בלי JS בצד הלקוח, וכל טופס כאן הוא
 * Server Action בפני עצמו.
 */
export function RecurringHistoryPanel({
  expense,
  upto = currentMonth(),
}: {
  expense: RecurringVariableExpense;
  upto?: string;
}) {
  const months = coveredMonths(expense, upto);
  const due = new Set(dueMonths(expense, upto));
  const missing = new Set(missingMonths(expense, upto));
  const cycle = cycleMonths(expense);
  const spread = isSpread(expense);
  const firstDue = expense.startDate.slice(0, 7);

  const byYear = new Map<string, string[]>();
  for (const m of months) {
    const year = m.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), m]);
  }

  const update = updateRecurringVariableExpenseAction.bind(null, expense.id);
  const fill = fillRecurringHistoryAction.bind(null, expense.id);
  const setAmount = setRecurringMonthAmountAction.bind(null, expense.id);
  const clear = clearRecurringMonthAction.bind(null, expense.id);

  return (
    <details className="rounded-lg border border-card-border bg-[#fbfcfe]">
      <summary className="cursor-pointer select-none px-3 py-2 text-[12px] font-bold text-ink">
        <span className="inline-flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          {expense.name} — היסטוריה מלאה והגדרות
          {missing.size > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
              {missing.size} חודשים חסרים
            </span>
          )}
          <span className="rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10px] font-bold text-muted">
            {RECURRING_FREQUENCY_LABELS[frequencyOf(expense)]}
            {spread ? ` · פרוס ל-${cycle} חודשים` : ""}
          </span>
        </span>
      </summary>

      <div className="flex flex-col gap-3 border-t border-card-border p-3">
        <form action={update} className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <div>
            <label className={LABEL}>שם ההוצאה</label>
            <input name="name" defaultValue={expense.name} className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>קטגוריה</label>
            <input name="category" defaultValue={expense.category ?? ""} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>תדירות</label>
            <select name="frequency" defaultValue={frequencyOf(expense)} className={FIELD}>
              {Object.entries(RECURRING_FREQUENCY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>חלוקת העלות</label>
            <select name="spread" defaultValue={expense.spread === false ? "false" : "true"} className={FIELD}>
              <option value="true">לפרוס על חודשי המחזור</option>
              <option value="false">הכל בחודש התשלום</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>מתחיל מתאריך</label>
            <input name="startDate" type="date" defaultValue={expense.startDate} className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>הופסק בתאריך</label>
            <input name="endDate" type="date" defaultValue={expense.endDate ?? ""} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>סכום משוער</label>
            <input
              name="defaultAmount"
              type="number"
              step="0.01"
              defaultValue={expense.defaultAmount ?? ""}
              className={FIELD}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-3 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
            >
              <Save className="h-3.5 w-3.5" />
              שמירת הגדרות
            </button>
          </div>
          <div className="col-span-2 md:col-span-4">
            <CountsToMainField defaultChecked={expense.countsToMain === true} />
          </div>
        </form>

        <form action={fill} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-teal/30 bg-teal-bg/40 p-2.5 md:grid-cols-5">
          <p className="col-span-2 text-[11px] leading-snug text-muted md:col-span-5">
            <b className="text-ink">מילוי מהיר של היסטוריה</b> — כשההוצאה קיימת כבר שנה ונרשמה במערכת רק עכשיו.
            הסכום נכתב לכל חודש חיוב בטווח; חודשים שכבר הוזנו נשארים כמו שהם אלא אם מסמנים דריסה.
          </p>
          <div>
            <label className={LABEL}>מחודש</label>
            <input name="from" type="month" defaultValue={firstDue} max={upto} className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>עד חודש</label>
            <input name="to" type="month" defaultValue={upto} max={upto} className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>סכום לכל חודש</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              defaultValue={expense.defaultAmount ?? ""}
              className={FIELD}
              required
            />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 pb-2 text-[11px] font-semibold text-ink">
            <input type="checkbox" name="overwrite" className="h-3.5 w-3.5 accent-teal" />
            לדרוס חודשים קיימים
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-teal bg-white px-3 py-2 text-xs font-bold text-teal-dark transition hover:bg-teal-bg"
          >
            <Wand2 className="h-3.5 w-3.5" />
            מילוי הטווח
          </button>
        </form>

        {[...byYear.entries()]
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([year, yearMonths]) => (
            <div key={year}>
              <p className="mb-1.5 text-[11px] font-extrabold text-muted">{year}</p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                {yearMonths.map((m) => {
                  const value = amountForMonth(expense, m);
                  const isDue = due.has(m);
                  return (
                    <div
                      key={m}
                      className={`rounded-lg border px-2 py-1.5 ${
                        !isDue
                          ? "border-card-border bg-[#f4f6f9]"
                          : missing.has(m)
                            ? "border-amber-300 bg-amber-50"
                            : "border-card-border bg-white"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-[10.5px] font-bold text-muted">
                        <span>{monthLabel(m)}</span>
                        {!isDue && <span className="text-[9.5px] font-medium">אין חיוב</span>}
                        {isDue && missing.has(m) && <span className="text-[9.5px] text-amber-700">חסר</span>}
                      </div>
                      {isDue ? (
                        <div className="flex items-center gap-1">
                          <form action={setAmount} className="flex flex-1 items-center gap-1">
                            <input type="hidden" name="month" value={m} />
                            <input
                              name="amount"
                              type="number"
                              step="0.01"
                              defaultValue={value ?? ""}
                              placeholder="₪"
                              required
                              className="w-full rounded border border-card-border bg-white px-1.5 py-0.5 text-center text-[11px] tabular-nums focus:border-teal focus:outline-none"
                            />
                            <button
                              type="submit"
                              className="rounded bg-teal px-1.5 py-0.5 text-[10px] font-bold text-white"
                            >
                              שמור
                            </button>
                          </form>
                          {value !== null && (
                            <form action={clear}>
                              <input type="hidden" name="month" value={m} />
                              <button
                                type="submit"
                                title="ניקוי החודש"
                                className="rounded border border-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-600 transition hover:bg-red-50"
                              >
                                ✕
                              </button>
                            </form>
                          )}
                        </div>
                      ) : (
                        <p className="text-center text-[11px] text-muted">—</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </details>
  );
}
