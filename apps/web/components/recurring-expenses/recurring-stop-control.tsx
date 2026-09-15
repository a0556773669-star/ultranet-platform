import { PauseCircle, PlayCircle } from "lucide-react";
import type { RecurringVariableExpense } from "@ultranet/shared-types";
import {
  endRecurringVariableExpenseAction,
  resumeRecurringVariableExpenseAction,
} from "./actions";

/**
 * הפסקה/חידוש של הוצאה קבועה משתנה.
 *
 * עד היום הדרך היחידה "לסגור" הוצאה שנגמרה הייתה מחיקה — וזו תשובה שגויה: מחיקה מוציאה
 * את ההוצאה מכל החודשים למפרע, כך שכל מה ששולם עליה נעלם מהדוחות ומההיסטוריה. הפסקה
 * שומרת את העבר כפי שהוא ורק מפסיקה לבקש עדכון מהתאריך הזה והלאה, בדיוק כמו "סיום"
 * בהוצאה קבועה רגילה. הכפתור ההפוך ("חידוש") קיים כי הפסקה בטעות חייבת להיות הפיכה.
 */
export function RecurringStopControl({
  expense,
  today,
}: {
  expense: RecurringVariableExpense;
  /** YYYY-MM-DD - ברירת המחדל בשדה התאריך */
  today: string;
}) {
  if (expense.endDate) {
    const resume = resumeRecurringVariableExpenseAction.bind(null, expense.id);
    return (
      <form action={resume}>
        <button
          type="submit"
          title={`ההוצאה הופסקה ב-${expense.endDate} — חידוש יחזיר אותה לבקש עדכון`}
          className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2 py-0.5 text-[10px] font-bold text-ink transition hover:bg-[#f4f6f9]"
        >
          <PlayCircle className="h-3 w-3" />
          חידוש
        </button>
      </form>
    );
  }

  const end = endRecurringVariableExpenseAction.bind(null, expense.id);
  return (
    <form action={end} className="flex items-center gap-1">
      <input
        name="endDate"
        type="date"
        defaultValue={today}
        className="rounded border border-card-border bg-white px-1 py-0.5 text-[10px]"
      />
      <button
        type="submit"
        title="ההיסטוריה נשמרת — רק מפסיקים לבקש עדכון מהתאריך הזה"
        className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2 py-0.5 text-[10px] font-bold text-ink transition hover:bg-[#f4f6f9]"
      >
        <PauseCircle className="h-3 w-3" />
        הפסקה
      </button>
    </form>
  );
}
