import { Repeat } from "lucide-react";
import type { RecurringPurchaseTypeSummary } from "@/lib/recurring-purchases";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * "כמה בעצם הולך על נייר" — התשובה, בתוך מסך ההוצאות ולא במודול נפרד.
 *
 * שלוש קניות נייר של 300 ₪ מפוזרות על השנה נראות כלום כל אחת לחוד; ביחד הן 900 ₪ וזה
 * מספר שצריך לראות. הבלוק הזה סוגר את הפער בלי להוסיף מסך: הוא מציג רק את הסוגים
 * שבאמת מופיעים בהוצאות של המסך הנוכחי, אבל **הסכומים הם של כל העסק** — אותה קנייה
 * בחדר מחשבים, בהשכרות או בהנה"ח הראשית נספרת באותו מקום.
 *
 * `<details>` סגור כברירת מחדל: זה מידע שמסתכלים בו מדי פעם, לא בכל כניסה למסך.
 */
export function RecurringPurchasesSummary({
  summaries,
  title = "רכישות חוזרות — כמה באמת הולך על זה",
}: {
  summaries: RecurringPurchaseTypeSummary[];
  title?: string;
}) {
  const rows = summaries.filter((s) => s.purchases.length > 0).sort((a, b) => b.thisYearTotal - a.thisYearTotal);
  if (rows.length === 0) return null;

  return (
    <details className="rounded-card border border-card-border bg-white p-3 shadow-card">
      <summary className="cursor-pointer select-none text-[12.5px] font-bold text-ink">
        <span className="inline-flex items-center gap-1.5">
          <Repeat className="h-3.5 w-3.5" />
          {title}
          <span className="rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10.5px] font-bold text-muted">
            {rows.length}
          </span>
        </span>
      </summary>

      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        כל קנייה נשארה הוצאה חד-פעמית רגילה בחודש שבו יצא הכסף — כאן רק רואים אותן יחד. הסכומים
        כוללים את כל העסק: סניף בודד, הוצאה על כמה סניפים, והרכישות של העסק עצמו.
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-right text-[12px]">
          <thead>
            <tr className="bg-[#f4f6f9] text-[10.5px] font-bold uppercase tracking-wide text-muted">
              <th className="px-2 py-1.5 text-right">מוצר</th>
              <th className="px-2 py-1.5 text-center">קניות השנה</th>
              <th className="px-2 py-1.5 text-center">{'סה"כ השנה'}</th>
              <th className="px-2 py-1.5 text-center">בחודש ממוצע</th>
              <th className="px-2 py-1.5 text-center">סניפים</th>
              <th className="px-2 py-1.5 text-center">קנייה אחרונה</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((s) => (
              <tr key={s.type.id} className="border-b border-card-border last:border-b-0">
                <td className="px-2 py-1.5 font-bold text-ink">{s.type.name}</td>
                <td className="px-2 py-1.5 text-center text-muted">{s.thisYearCount}</td>
                <td className="px-2 py-1.5 text-center font-extrabold text-red-600">{money(s.thisYearTotal)}</td>
                <td className="px-2 py-1.5 text-center text-muted">{money(s.perMonth)}</td>
                <td className="px-2 py-1.5 text-center text-muted">{s.branches.length || "—"}</td>
                <td className="px-2 py-1.5 text-center text-muted">{s.lastPurchase?.date ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted">
        <b>בחודש ממוצע</b> הוא הסכום השנתי חלקי 12 — מספר להשוואה מול הוצאה קבועה בלבד. בהנה&quot;ח
        הכסף נשאר בחודש שבו יצא.
      </p>
    </details>
  );
}
