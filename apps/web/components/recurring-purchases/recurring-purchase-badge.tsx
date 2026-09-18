import { Repeat } from "lucide-react";
import type { RecurringPurchaseTypeSummary } from "@/lib/recurring-purchases";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * התג שמופיע על הוצאה שסומנה כרכישה חוזרת — והחיבור עצמו.
 *
 * זה מה שהחליף את המסך הנפרד: במקום להיכנס למודול כדי לגלות שקנינו נייר שבע פעמים,
 * כל שורה של נייר אומרת את זה ליד עצמה, עם הסכום המצטבר **מכל העסק** — סניף, כמה
 * סניפים, וההוצאות של העסק עצמו. הסימון לא מזיז שקל; הוא רק סופר.
 */
export function RecurringPurchaseBadge({
  summary,
  compact = false,
}: {
  summary: RecurringPurchaseTypeSummary | undefined;
  /** בשורה צפופה מציגים רק את השם והסכום השנתי */
  compact?: boolean;
}) {
  if (!summary) return null;
  const { type, thisYearTotal, thisYearCount, year, grandTotal } = summary;
  return (
    <span
      title={`סה"כ מאז ומתמיד: ${money(grandTotal)} · ${summary.purchases.length} קניות`}
      className="inline-flex items-center gap-1 rounded-full border border-teal/30 bg-teal-bg/50 px-2 py-0.5 text-[10.5px] font-bold text-teal-dark"
    >
      <Repeat className="h-3 w-3" />
      {type.name}
      {thisYearCount > 0 && (
        <span className="font-extrabold">
          · {money(thisYearTotal)} ב-{year}
          {compact ? "" : ` (${thisYearCount} קניות)`}
        </span>
      )}
    </span>
  );
}
