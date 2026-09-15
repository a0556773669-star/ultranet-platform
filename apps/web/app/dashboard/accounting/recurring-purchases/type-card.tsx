import { Repeat, Trash2, Archive, ArchiveRestore, Sparkles } from "lucide-react";
import type { Branch, RecurringPurchaseType } from "@ultranet/shared-types";
import {
  RECURRING_PURCHASE_MODULE_LABELS,
  purchaseBranchLabel,
  type RecurringPurchase,
  type RecurringPurchaseReport,
  type RecurringPurchaseYear,
} from "@/lib/recurring-purchases";
import {
  deleteExpenseTypeAction,
  setExpenseTypeArchivedAction,
  tagPurchaseAction,
  untagPurchaseAction,
  updateExpenseTypeAction,
} from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

const MONTH_NAMES = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/** מספר קטן שצריך להיות מדויק — ממוצע חודשי של 87.5 ₪ הוא לא "88". */
function moneyPrecise(n: number) {
  return `${n.toLocaleString("he-IL", { maximumFractionDigits: 1 })} ₪`;
}

function Stat({ label, value, hint, tone = "ink" }: { label: string; value: string; hint?: string; tone?: "ink" | "teal" | "red" }) {
  const color = tone === "teal" ? "text-teal-dark" : tone === "red" ? "text-red-600" : "text-ink";
  return (
    <div className="rounded-lg border border-card-border bg-[#f9fafb] px-2.5 py-2">
      <div className="text-[10.5px] font-semibold text-muted">{label}</div>
      <div className={`text-[17px] font-black tabular-nums ${color}`}>{value}</div>
      {hint && <div className="text-[10px] leading-snug text-muted">{hint}</div>}
    </div>
  );
}

/** פיזור הקניות על חודשי השנה. עמודה ריקה = חודש שלא קנינו בו, וזו חצי מהתשובה. */
function MonthBars({ year }: { year: RecurringPurchaseYear }) {
  const max = Math.max(...year.byMonth, 1);
  return (
    <div className="grid grid-cols-12 gap-1">
      {year.byMonth.map((amount, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5" title={`${MONTH_NAMES[i]}: ${money(amount)}`}>
          <div className="flex h-12 w-full items-end rounded bg-[#f1f5f9]">
            <div
              className={`w-full rounded ${amount > 0 ? "bg-teal" : ""}`}
              style={{ height: amount > 0 ? `${Math.max(8, (amount / max) * 100)}%` : "0%" }}
            />
          </div>
          <span className="text-[9px] font-semibold text-muted">{MONTH_NAMES[i]}</span>
        </div>
      ))}
    </div>
  );
}

function PurchaseRow({
  purchase,
  branchNameById,
}: {
  purchase: RecurringPurchase;
  branchNameById: ReadonlyMap<string, string>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border py-1.5 text-[12px] last:border-b-0">
      <span className="flex-1 font-semibold text-ink">
        {purchase.desc}
        <span className="mr-1.5 text-[10.5px] font-medium text-muted">
          {purchase.date} · {purchaseBranchLabel(purchase, branchNameById)}
        </span>
      </span>
      <span className="font-black tabular-nums text-red-600">{money(purchase.amount)}</span>
      <form action={untagPurchaseAction}>
        <input type="hidden" name="purchaseId" value={purchase.id} />
        <input type="hidden" name="source" value={purchase.source} />
        <button
          type="submit"
          title="להסיר את השיוך לסוג הזה"
          className="rounded border border-card-border px-1.5 py-0.5 text-[10px] font-bold text-muted transition hover:border-red-300 hover:text-red-600"
        >
          הסר שיוך
        </button>
      </form>
    </div>
  );
}

/**
 * כרטיס של סוג רכישה חוזרת אחד: השנה הנוכחית במלואה, והשנים שלפניה כשורות להשוואה.
 *
 * שני המספרים שהכרטיס קיים בשבילם הם `perMonth` ו-`perBranch`. שניהם **חישוב של הדוח**:
 * הכסף נספר בהנה"ח בחודש שבו יצא ותחת הסניף שרשם אותו, וכאן רק שואלים "אם מפזרים את זה
 * על השנה ועל הסניפים, כמה זה יוצא" — כדי שאפשר יהיה להשוות רכישה חוזרת להוצאה קבועה.
 */
export function RecurringPurchaseTypeCard({
  report,
  allBranches,
  branchNameById,
  suggestions,
}: {
  report: RecurringPurchaseReport;
  allBranches: Branch[];
  branchNameById: ReadonlyMap<string, string>;
  suggestions: RecurringPurchase[];
}) {
  const { type, branches, years, grandTotal, lastPurchase } = report;
  const latest = years[0];
  const previous = years[1];
  const older = years.slice(1);
  const delta = latest && previous ? latest.total - previous.total : null;

  const update = updateExpenseTypeAction.bind(null, type.id);
  const archive = setExpenseTypeArchivedAction.bind(null, type.id, !type.archived);
  const del = deleteExpenseTypeAction.bind(null, type.id);
  const tag = tagPurchaseAction.bind(null, type.id);

  return (
    <div className={`rounded-card border bg-white p-4 shadow-card ${type.archived ? "border-dashed border-card-border opacity-75" : "border-card-border"}`}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <Repeat className="h-4 w-4" />
            {type.name}
            {type.archived && (
              <span className="rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10px] font-bold text-muted">הופסק</span>
            )}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted">
            {RECURRING_PURCHASE_MODULE_LABELS[type.module]}
            {type.category ? ` · ${type.category}` : ""} ·{" "}
            {branches.length > 0 ? `מתחלק בין ${branches.length} סניפים` : "אין סניפים פעילים"}
            {lastPurchase ? ` · נקנה לאחרונה ${lastPurchase.date}` : " · עוד לא נקנה"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <form action={archive}>
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg border border-card-border px-2 py-1 text-[10.5px] font-bold text-muted transition hover:border-teal hover:text-teal"
            >
              {type.archived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
              {type.archived ? "החזרה לשימוש" : "הפסקה"}
            </button>
          </form>
          <form action={del}>
            <button
              type="submit"
              title="מוחק את הסוג ומסיר את השיוך מכל הרכישות. ההוצאות עצמן נשארות."
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[10.5px] font-bold text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-3 w-3" />
              מחיקה
            </button>
          </form>
        </div>
      </div>

      {!latest ? (
        <p className="rounded-lg border border-dashed border-card-border bg-[#f9fafb] p-3 text-[12px] text-muted">
          עוד לא שויכה לסוג הזה אף רכישה. בטופס ההוצאה החד-פעמית בוחרים אותו בשדה &quot;רכישה חוזרת&quot;,
          ורכישות שכבר נרשמו מסומנות מכאן.
        </p>
      ) : (
        <>
          <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-5">
            <Stat label={`סה"כ ${latest.year}`} value={money(latest.total)} hint={`${latest.count} קניות`} tone="red" />
            <Stat
              label="בחלוקה ל-12 חודשים"
              value={moneyPrecise(latest.perMonth)}
              hint="כמה זה עולה בחודש ממוצע"
              tone="teal"
            />
            <Stat
              label="לכל סניף"
              value={moneyPrecise(latest.perBranch)}
              hint={`${latest.branchCount} סניפים`}
              tone="teal"
            />
            <Stat label="ממוצע לקנייה" value={money(latest.avgPerPurchase)} hint={latest.avgGapDays !== null ? `כל ${latest.avgGapDays} ימים בערך` : "קנייה אחת"} />
            <Stat
              label={previous ? `מול ${previous.year}` : 'סה"כ מאז ומתמיד'}
              value={delta === null ? money(grandTotal) : `${delta >= 0 ? "+" : "−"}${money(Math.abs(delta))}`}
              hint={previous ? `${previous.year}: ${money(previous.total)}` : `על פני ${years.length} שנים`}
              tone={delta !== null && delta > 0 ? "red" : "ink"}
            />
          </div>

          <div className="mb-3">
            <p className="mb-1 text-[10.5px] font-semibold text-muted">מתי קנינו ב-{latest.year}</p>
            <MonthBars year={latest} />
          </div>

          <details className="mb-2 rounded-lg border border-card-border bg-[#fbfcfe]">
            <summary className="cursor-pointer select-none px-3 py-1.5 text-[11.5px] font-bold text-ink">
              {latest.count} הקניות של {latest.year}
            </summary>
            <div className="border-t border-card-border px-3 py-1">
              {latest.purchases.map((p) => (
                <PurchaseRow key={`${p.source}-${p.id}`} purchase={p} branchNameById={branchNameById} />
              ))}
            </div>
          </details>

          {older.length > 0 && (
            <div className="mb-2 overflow-x-auto">
              <table className="w-full border-collapse text-right text-[11.5px]">
                <thead>
                  <tr className="bg-[#f4f6f9] text-[10.5px] font-bold text-muted">
                    <th className="px-2 py-1 text-right">שנה</th>
                    <th className="px-2 py-1 text-center">קניות</th>
                    <th className="px-2 py-1 text-center">{'סה"כ'}</th>
                    <th className="px-2 py-1 text-center">לחודש</th>
                    <th className="px-2 py-1 text-center">לסניף</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {older.map((y) => (
                    <tr key={y.year} className="border-b border-card-border last:border-b-0">
                      <td className="px-2 py-1 font-bold text-ink">{y.year}</td>
                      <td className="px-2 py-1 text-center">{y.count}</td>
                      <td className="px-2 py-1 text-center font-bold text-red-600">{money(y.total)}</td>
                      <td className="px-2 py-1 text-center text-teal-dark">{moneyPrecise(y.perMonth)}</td>
                      <td className="px-2 py-1 text-center text-teal-dark">{moneyPrecise(y.perBranch)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {suggestions.length > 0 && (
        <div className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
          <p className="flex items-center gap-1.5 text-[11.5px] font-extrabold text-amber-900">
            <Sparkles className="h-3.5 w-3.5" />
            נראה שגם אלה {type.name} ({suggestions.length})
          </p>
          <p className="mb-1 text-[10.5px] text-amber-800">
            רכישות שהתיאור שלהן מכיל את שם הסוג ועוד לא סומנו. סימון מצרף אותן לסיכום השנתי ולא משנה
            כלום בהנה&quot;ח.
          </p>
          {suggestions.slice(0, 12).map((p) => (
            <div
              key={`${p.source}-${p.id}`}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 py-1 text-[12px] last:border-b-0"
            >
              <span className="flex-1 font-semibold text-ink">
                {p.desc}
                <span className="mr-1.5 text-[10.5px] font-medium text-amber-800">
                  {p.date} · {purchaseBranchLabel(p, branchNameById)}
                </span>
              </span>
              <span className="font-black tabular-nums text-red-600">{money(p.amount)}</span>
              <form action={tag}>
                <input type="hidden" name="purchaseId" value={p.id} />
                <input type="hidden" name="source" value={p.source} />
                <button
                  type="submit"
                  className="rounded bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white transition hover:opacity-90"
                >
                  כן, לצרף
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <details className="rounded-lg border border-card-border bg-[#fbfcfe]">
        <summary className="cursor-pointer select-none px-3 py-1.5 text-[11.5px] font-bold text-ink">
          הגדרות הסוג
        </summary>
        <form action={update} className="grid grid-cols-2 gap-2 border-t border-card-border p-3 md:grid-cols-4">
          <div>
            <label className={LABEL}>שם</label>
            <input name="name" defaultValue={type.name} className={FIELD} required />
          </div>
          <div>
            <label className={LABEL}>קטגוריה</label>
            <input name="category" defaultValue={type.category ?? ""} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>מודול</label>
            <select name="module" defaultValue={type.module} className={FIELD}>
              {Object.entries(RECURRING_PURCHASE_MODULE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>הערה</label>
            <input name="note" defaultValue={type.note ?? ""} className={FIELD} />
          </div>
          <div className="col-span-2 md:col-span-4">
            <BranchScopeField type={type} allBranches={allBranches} />
          </div>
          <div className="col-span-2 md:col-span-4">
            <button
              type="submit"
              className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
            >
              שמירה
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}

/**
 * בין אילו סניפים העלות השנתית מתחלקת **בדוח**. אותה סמנטיקה כמו בהוצאה משותפת: ריק =
 * כל הסניפים כולל כאלה שייפתחו, ולכן זו ברירת המחדל ולא רשימה מסומנת מראש.
 */
export function BranchScopeField({
  type,
  allBranches,
  idPrefix = "type-scope",
}: {
  type?: RecurringPurchaseType;
  allBranches: Branch[];
  idPrefix?: string;
}) {
  const chosen = new Set(type?.branchIds ?? []);
  const selected = chosen.size > 0;
  return (
    <fieldset className="rounded-lg border border-card-border bg-white p-2.5">
      <legend className="px-1 text-[11px] font-bold text-muted">בין אילו סניפים העלות מתחלקת בדוח</legend>
      <div className="mb-1.5 flex flex-wrap gap-3 text-[11.5px] font-semibold text-ink">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="radio" name="branchScope" value="all" defaultChecked={!selected} className="h-3.5 w-3.5 accent-teal" />
          כל הסניפים (כולל שייפתחו)
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="radio" name="branchScope" value="selected" defaultChecked={selected} className="h-3.5 w-3.5 accent-teal" />
          רק הסניפים שאסמן
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allBranches.length === 0 && <span className="text-[11px] text-muted">אין סניפים פעילים</span>}
        {allBranches.map((b) => (
          <label
            key={b.id}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-card-border bg-[#f8fafc] px-2 py-0.5 text-[11px] font-semibold text-ink"
          >
            <input
              type="checkbox"
              name="branchIds"
              value={b.id}
              defaultChecked={chosen.has(b.id)}
              id={`${idPrefix}-${b.id}`}
              className="h-3 w-3 accent-teal"
            />
            {b.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
