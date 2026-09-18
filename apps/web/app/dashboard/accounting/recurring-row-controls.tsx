"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { useToast } from "@/lib/toast";
import {
  deleteRecurringVariableExpenseAction,
  endRecurringVariableExpenseAction,
  resumeRecurringVariableExpenseAction,
} from "@/components/recurring-expenses/actions";

/**
 * הפסקה / חידוש / מחיקה של הוצאה קבועה משתנה, בתוך שורת טבלה.
 *
 * זו הגרסה של אותן שלוש פעולות שקיימות ב-`components/recurring-expenses` — שם הן טפסים
 * ב-Server Component, וכאן הן חייבות להיות בצד הלקוח כי הן יושבות בתוך טבלה אינטראקטיבית.
 * הפעולות עצמן זהות לחלוטין: אותן Server Actions, אותה אכיפת הרשאה.
 *
 * **הפסקה ולא מחיקה** היא ההבחנה שהכפתורים קיימים בשבילה: מחיקה מוציאה את ההוצאה מכל
 * החודשים למפרע וכל מה ששולם עליה נעלם מהדוחות, בעוד הפסקה שומרת את העבר כפי שהוא ורק
 * מפסיקה לבקש עדכון. "חידוש" קיים כי הפסקה בטעות חייבת להיות הפיכה.
 */
export function RecurringRowControls({
  id,
  endDate,
  today,
}: {
  id: string;
  /** ריק = פעילה */
  endDate: string;
  /** YYYY-MM-DD — ברירת המחדל בשדה ההפסקה */
  today: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function run(fn: () => Promise<void>, successText: string) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
        showSuccess(successText);
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה");
      }
    });
  }

  function handleEnd(formData: FormData) {
    run(() => endRecurringVariableExpenseAction(id, formData), "ההוצאה סומנה כמסתיימת");
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {endDate ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() => run(() => resumeRecurringVariableExpenseAction(id), "ההוצאה חודשה")}
          title={`ההוצאה הופסקה ב-${endDate} — חידוש יחזיר אותה לבקש עדכון`}
          className="inline-flex items-center gap-1 rounded-lg border border-card-border bg-white px-2 py-0.5 text-[10px] font-bold text-ink transition hover:bg-[#f4f6f9] disabled:opacity-50"
        >
          <PlayCircle className="h-3 w-3" />
          חידוש
        </button>
      ) : (
        <form action={handleEnd} className="flex items-center gap-1">
          <input
            name="endDate"
            type="date"
            defaultValue={today}
            title="התאריך שבו ההוצאה נגמרה"
            className="rounded border border-card-border bg-white px-1 py-0.5 text-[10px]"
          />
          <button
            type="submit"
            disabled={isPending}
            title="ההיסטוריה נשמרת — רק מפסיקים לבקש עדכון מהתאריך הזה"
            className="inline-flex items-center gap-1 rounded-lg border border-card-border bg-white px-2 py-0.5 text-[10px] font-bold text-ink transition hover:bg-[#f4f6f9] disabled:opacity-50"
          >
            <PauseCircle className="h-3 w-3" />
            הפסקה
          </button>
        </form>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("למחוק את ההוצאה? היא תיעלם מכל החודשים למפרע — להוצאה שפשוט נגמרה השתמש ב'הפסקה'."))
            return;
          run(() => deleteRecurringVariableExpenseAction(id), "ההוצאה נמחקה");
        }}
        title="מחיקה"
        aria-label="מחיקה"
        className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
      </button>
      {toastNode}
    </div>
  );
}
