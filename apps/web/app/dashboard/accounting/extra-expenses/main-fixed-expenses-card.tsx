import { CalendarClock } from "lucide-react";
import type { AccountingFixedExpense } from "@ultranet/shared-types";
import { countsToMain } from "@/lib/counts-to-main";
import { CountsToMainField, CountsToMainBadge } from "@/components/counts-to-main-field";
import {
  currentMonth,
  isMainFixedExpenseActive,
  mainFixedExpenseAccrued,
  mainFixedExpenseMonths,
  mainFixedMonthlyTotal,
} from "@/lib/main-fixed-expenses";
import { DeleteEntryButton } from "../delete-entry-button";
import { createMainFixedExpenseAction, deleteMainFixedExpenseAction } from "../actions";
import { EndMainFixedExpenseControl } from "./main-fixed-expense-controls";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";
const BTN =
  "rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90";

const BUSINESS_LABELS: Record<AccountingFixedExpense["business"], string> = {
  general: "כללי",
  computers: "חדרי מחשבים",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
};

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * "הוצאות קבועות" של העסק עצמו — הסוג השלישי בהוצאות נוספות.
 *
 * ההבדל מהכרטיס שמעליו הוא שאלה אחת: האם הסכום ידוע מראש. שכירות משרד היא 3,000 ₪ כל
 * חודש ואין מה לשאול עליה ב-1 לחודש, ולכן היא שורה אחת עם סכום — ולא הוצאה קבועה משתנה
 * שתבקש עדכון לנצח, ולא רכישה חד-פעמית שתיכתב מחדש בכל חודש.
 *
 * הצבירה מחושבת ולא מוקלדת (`mainFixedExpenseAccrued`), ולכן הספר הראשי מקבל שורה לכל
 * חודש שההוצאה הייתה פעילה בו — כולל החודש הנוכחי.
 */
export function MainFixedExpensesCard({ expenses }: { expenses: AccountingFixedExpense[] }) {
  const now = currentMonth();
  const today = new Date().toISOString().slice(0, 10);
  const active = expenses.filter((e) => isMainFixedExpenseActive(e, now));
  const ended = expenses.filter((e) => !isMainFixedExpenseActive(e, now));
  const monthly = mainFixedMonthlyTotal(active, now);
  const monthlyToMain = mainFixedMonthlyTotal(
    active.filter((e) => countsToMain(e)),
    now,
  );

  return (
    <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <CalendarClock className="h-4 w-4" />
          הוצאות קבועות
        </h3>
        <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-[11px] font-bold text-ink">
          {money(monthly)} לחודש
          {monthlyToMain !== monthly && <span className="text-muted"> · {money(monthlyToMain)} לראשי</span>}
        </span>
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
        הוצאה של העסק שחוזרת כל חודש ב<b>אותו</b> סכום — שכירות משרד, רואה חשבון, מנוי תוכנה.
        נרשמת פעם אחת ונצברת לבד מחודש ההתחלה והלאה, בלי לרשום אותה מחדש בכל חודש. הוצאה שהסכום
        שלה משתנה כל חודש שייכת לכרטיס &quot;הוצאות קבועות משתנות&quot; שמעל.
      </p>

      <div className="flex flex-col gap-2">
        {active.length === 0 && <p className="text-sm text-muted">אין עדיין הוצאות קבועות פעילות</p>}
        {active.map((e) => {
          const del = deleteMainFixedExpenseAction.bind(null, e.id);
          return (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-card-border bg-[#f9fafb] p-3"
            >
              <div>
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink">
                  {e.name} — {money(e.amount || 0)}/חודש
                  <CountsToMainBadge on={countsToMain(e)} />
                </p>
                <p className="text-[11px] text-muted">
                  {e.category || "ללא קטגוריה"} · {BUSINESS_LABELS[e.business] ?? BUSINESS_LABELS.general} · מתחיל{" "}
                  {e.startDate} · נצבר עד היום {money(mainFixedExpenseAccrued(e, now))} (
                  {mainFixedExpenseMonths(e, now).length} חודשים)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <EndMainFixedExpenseControl id={e.id} />
                <DeleteEntryButton
                  confirmText="למחוק את ההוצאה הקבועה? היא תיעלם מכל החודשים למפרע — להוצאה שפשוט נגמרה השתמש ב'הפסקה'."
                  action={del}
                  successText="ההוצאה נמחקה"
                />
              </div>
            </div>
          );
        })}
      </div>

      {ended.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-bold text-muted">
            הוצאות קבועות שהופסקו ({ended.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {ended.map((e) => {
              const del = deleteMainFixedExpenseAction.bind(null, e.id);
              return (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-card-border bg-[#f4f6f9] p-3 opacity-75"
                >
                  <div>
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-ink">
                      {e.name} — {money(e.amount || 0)}/חודש
                      <CountsToMainBadge on={countsToMain(e)} />
                    </p>
                    <p className="text-[11px] text-muted">
                      {e.startDate} – {e.endDate} · סה&quot;כ {money(mainFixedExpenseAccrued(e, now))}
                    </p>
                  </div>
                  <DeleteEntryButton
                    confirmText="למחוק את ההוצאה הקבועה? היא תיעלם מהספר הראשי גם לחודשים שהיא כן הייתה פעילה בהם."
                    action={del}
                    successText="ההוצאה נמחקה"
                  />
                </div>
              );
            })}
          </div>
        </details>
      )}

      <form action={createMainFixedExpenseAction} className="mt-3 grid grid-cols-2 gap-2 border-t border-card-border pt-3 md:grid-cols-4">
        <div>
          <label className={LABEL}>שם ההוצאה</label>
          <input name="name" placeholder="שכירות משרד / רואה חשבון" className={FIELD} required />
        </div>
        <div>
          <label className={LABEL}>סכום חודשי</label>
          <input name="amount" type="number" min={0} step="0.01" className={FIELD} required />
        </div>
        <div>
          <label className={LABEL}>מתחיל מתאריך</label>
          <input name="startDate" type="date" defaultValue={today} className={FIELD} required />
        </div>
        <div>
          <label className={LABEL}>קטגוריה</label>
          <input name="category" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>שייך לתחום</label>
          <select name="business" defaultValue="general" className={FIELD}>
            {Object.entries(BUSINESS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 md:col-span-3">
          <CountsToMainField defaultChecked />
        </div>
        <div className="col-span-2 md:col-span-4">
          <button type="submit" className={BTN}>
            + הוסף הוצאה קבועה
          </button>
        </div>
      </form>
    </div>
  );
}
