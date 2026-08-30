/**
 * The owner's own book ("תזרים") and the data-source / permissions explainer.
 * Only rendered for the owner - a branch manager never sees either of these.
 */
import type { MyMonth } from "@/lib/accounting-overview";
import { ACCOUNTING_EXPENSE_CATEGORIES, ACCOUNTING_INCOME_CATEGORIES } from "@/lib/accounting-categories";
import { addMyExpenseAction, addMyIncomeAction } from "./actions";
import { money, mLabel } from "./ui";

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const HEAD = "flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3";
const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-[11.5px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";

function EntryRows({ rows, color }: { rows: MyMonth["income"]; color: string }) {
  if (rows.length === 0) {
    return <p className="py-2 text-xs text-muted">לא הוזנו שורות לחודש הזה</p>;
  }
  return (
    <>
      {rows.map((r) => (
        <div
          key={r.id}
          className="flex items-baseline justify-between gap-2.5 border-b border-dashed border-[#eef1f6] py-1 last:border-b-0"
        >
          <span className="text-[12.5px] font-bold text-ink">{r.label}</span>
          <span className={`text-[13.5px] font-extrabold tabular-nums ${color}`}>{money(r.amount)}</span>
        </div>
      ))}
    </>
  );
}

export function MyLedgerCard({
  my,
  runningBalance,
  defaultDate,
}: {
  my: MyMonth;
  runningBalance: number;
  defaultDate: string;
}) {
  return (
    <section className={CARD}>
      <div className={HEAD}>
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">תזרים — {mLabel(my.month)}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            כמה כסף באמת עבר דרך הידיים והחשבון שלי. ספר נפרד מה&quot;מחזור&quot; — שתי שאלות שונות על אותו
            שקל, ולכן הם לא נסכמים.
          </p>
        </div>
        <span className="rounded-full bg-teal-bg px-2.5 py-1 text-[11px] font-extrabold text-teal-dark">
          הזנה ידנית
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto]">
        <div className="px-4 py-3">
          <h3 className="mb-1.5 text-[11px] font-extrabold tracking-wide text-muted">הכנסות שהזנתי</h3>
          <EntryRows rows={my.income} color="text-emerald-600" />
          <div className="mt-2 flex items-baseline justify-between gap-2.5 border-t border-card-border pt-2 text-xs font-extrabold text-muted">
            <span>סה&quot;כ הכנסות</span>
            <b className="text-[15px] tabular-nums text-emerald-600">{money(my.incomeTotal)}</b>
          </div>
          <form action={addMyIncomeAction} className="mt-2.5 grid grid-cols-[1fr_78px_auto] gap-1.5">
            <select name="category" defaultValue={ACCOUNTING_INCOME_CATEGORIES[0]} className={FIELD}>
              {ACCOUNTING_INCOME_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input name="amount" type="number" min={1} step="1" placeholder="סכום" required className={FIELD} />
            <input type="hidden" name="date" value={defaultDate} />
            <button
              type="submit"
              className="whitespace-nowrap rounded-lg bg-teal px-2.5 py-1.5 text-[11.5px] font-extrabold text-white transition hover:bg-teal-dark"
            >
              הוספה
            </button>
          </form>
        </div>

        <div className="border-t border-card-border px-4 py-3 lg:border-r lg:border-t-0">
          <h3 className="mb-1.5 text-[11px] font-extrabold tracking-wide text-muted">הוצאות שהזנתי</h3>
          <EntryRows rows={my.expenses} color="text-red-600" />
          <div className="mt-2 flex items-baseline justify-between gap-2.5 border-t border-card-border pt-2 text-xs font-extrabold text-muted">
            <span>סה&quot;כ הוצאות</span>
            <b className="text-[15px] tabular-nums text-red-600">{money(my.expenseTotal)}</b>
          </div>
          <form action={addMyExpenseAction} className="mt-2.5 grid grid-cols-[1fr_78px_auto] gap-1.5">
            <select name="category" defaultValue={ACCOUNTING_EXPENSE_CATEGORIES[0]} className={FIELD}>
              {ACCOUNTING_EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input name="amount" type="number" min={1} step="1" placeholder="סכום" required className={FIELD} />
            <input type="hidden" name="date" value={defaultDate} />
            <button
              type="submit"
              className="whitespace-nowrap rounded-lg bg-teal px-2.5 py-1.5 text-[11.5px] font-extrabold text-white transition hover:bg-teal-dark"
            >
              הוספה
            </button>
          </form>
        </div>

        <div className="flex min-w-[170px] flex-col justify-center gap-0.5 border-t border-card-border bg-teal-bg px-4 py-3 lg:border-r lg:border-t-0">
          <span className="text-[10.5px] font-extrabold tracking-wide text-teal-dark">
            הרווח שלי {mLabel(my.month)}
          </span>
          <span className="text-2xl font-black tabular-nums text-teal-dark">{money(my.profit)}</span>
          <span className="text-[11px] font-bold text-teal-dark/80">
            יתרה מצטברת בתזרים: {money(runningBalance)}
          </span>
        </div>
      </div>

      <p className="px-4 pb-3.5 pt-1 text-[11.5px] leading-relaxed text-muted">
        השורה נרשמת לחודש שנבחר למעלה. לעריכה או מחיקה של שורה קיימת — לשונית{" "}
        <b className="text-ink">רישום ותנועות</b>.
      </p>
    </section>
  );
}

export function RulesCard({ ownerName }: { ownerName: string }) {
  const perms: [string, boolean][] = [
    ["ספר התזרים — כל התנועות שלי", false],
    ["סיכומי כל העסק (שורת הסיכום העליונה)", false],
    ["דוח הכנסות והוצאות של כל העסק", false],
    ["טבלת כל הסניפים ודירוג לפי החזר השקעה", false],
    ["רכש, מלאי וההשקעה פר סניף (שכבת הנכסים)", false],
    ["תעריפון ועריכת עלויות", false],
    ["מסלולי גבייה", false],
    ["הכנסות / הוצאות / רווח של הסניף שלו", true],
    ["פירוט העלויות והקיזוז מול הבעלים", true],
    [`כמה להעביר ל${ownerName} ב-1 לחודש`, true],
  ];
  const sources: [string, string][] = [
    ["תנועה שהזנתי (אשראי / מזומן / ניידים / חשמל / רו\"ח...)", "ספר התזרים, ולפי הצומת גם ספר הסניף"],
    ["השכרות שהוחזרו ושולמו", "הכנסת סניף הניידים"],
    ["הכנסה ידנית של סניף", "הכנסת אותו סניף"],
    ["הוצאה קבועה או חד-פעמית של סניף", "הוצאת הסניף, פעם אחת"],
    ["תעריפון (מחשב / תיק / סטיק / סינון וגלישה)", "הוצאת הסניף — רק אם אין כבר הוצאה ידנית מקבילה"],
    ["אזור פרסום משותף", "הוצאת הסניף — רק אם הסניף לא הזין פרסום בעצמו"],
    ["רכישת ציוד (חשבונית מספק)", "תנועה הונית + פריטים — לא הוצאה של אף סניף"],
    ["משלוח פריטים לסניף", "העברת ההשקעה בין מיקומים — לא נרשם שקל"],
    ["העברה חודשית מהשותף", "סילוק חוב — לא הכנסה חדשה"],
  ];
  const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
  const TD = "px-2.5 py-2 border-b border-[#eef1f6]";

  return (
    <section className={CARD}>
      <div className={HEAD}>
        <h2 className="text-[15px] font-extrabold text-ink">הרשאות ומקורות נתונים</h2>
      </div>
      <div className="px-4 py-3.5">
        <p className="mb-2.5 rounded-[10px] border border-card-border bg-[#f4f6f9] px-3 py-2.5 text-xs leading-relaxed text-muted">
          <b className="text-ink">{ownerName} רואה הכל</b> — כל ההנה&quot;ח, כל הסניפים וכל הפונקציות.{" "}
          <b className="text-ink">מנהל סניף או שותף רואה את הסניף שלו בלבד</b>, ונכנס ישירות למסך הסניף שלו.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={`${TH} min-w-[150px]`}>מה במסך</th>
                <th className={TH}>{ownerName} (בעלים)</th>
                <th className={TH}>מנהל סניף / שותף</th>
              </tr>
            </thead>
            <tbody>
              {perms.map(([label, shared], i) => (
                <tr key={label} className={i % 2 ? "bg-[#fafbfd]" : ""}>
                  <td className={TD}>{label}</td>
                  <td className={`${TD} font-extrabold text-emerald-600`}>✓</td>
                  <td className={`${TD} ${shared ? "font-extrabold text-emerald-600" : "text-muted"}`}>
                    {shared ? "✓ (הסניף שלו בלבד)" : "✕"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-2.5 mt-3 rounded-[10px] border border-card-border bg-[#f4f6f9] px-3 py-2.5 text-xs leading-relaxed text-muted">
          <b className="text-ink">אין כפילות:</b> לכל סוג נתון מקור אחד בלבד; שני הספרים —{" "}
          <b className="text-ink">תזרים</b> ו<b className="text-ink">מחזור</b> — לא נסכמים זה עם זה; וציוד
          נמדד בשכבת הנכסים בלבד, ולעולם לא נכנס לספר התפעולי של סניף.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={`${TH} min-w-[150px]`}>מקור</th>
                <th className={`${TH} min-w-[150px]`}>נספר כ־</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(([a, b], i) => (
                <tr key={a} className={i % 2 ? "bg-[#fafbfd]" : ""}>
                  <td className={TD}>{a}</td>
                  <td className={TD}>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
