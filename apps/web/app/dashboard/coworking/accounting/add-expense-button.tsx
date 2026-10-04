"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Gauge, Minus, Receipt, TrendingDown } from "lucide-react";
import type { RecurringPurchaseType } from "@ultranet/shared-types";
import { useToast } from "@/lib/toast";
import { CountsToMainField } from "@/components/counts-to-main-field";
import { ExpenseTypeField } from "@/components/recurring-purchases/expense-type-field";
import { createRecurringVariableExpenseAction } from "@/components/recurring-expenses/actions";
import { Modal } from "@/components/modal";
import { createCoworkingFixedExpenseAction, createCoworkingVariableExpenseAction } from "../actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

type ExpenseKind = "fixed" | "recurring" | "variable";

const KINDS: { key: ExpenseKind; label: string; icon: typeof CalendarClock; hint: string }[] = [
  {
    key: "fixed",
    label: "הוצאה קבועה",
    icon: CalendarClock,
    hint: "חוזרת כל חודש באותו סכום בדיוק — שכירות המשרד, ארנונה, מנוי אינטרנט. נרשמת פעם אחת ונצברת לבד מחודש ההתחלה והלאה.",
  },
  {
    key: "recurring",
    label: "קבועה משתנה",
    icon: Gauge,
    hint: 'חוזרת כל חודש אבל הסכום משתנה — חשמל, מים, ניקיון. נרשמת פעם אחת, והסכום של כל חודש מוזן בטבלת "הוצאות קבועות משתנות".',
  },
  {
    key: "variable",
    label: "הוצאה חד-פעמית",
    icon: Receipt,
    hint: "הוצאה שנרשמת פעם אחת ונגמרת — כיסא שנקנה, תיקון, קפה. אפשר לקשר אותה לסוג רכישה חוזרת כדי לראות כמה היא עולה לאורך זמן.",
  },
];

/**
 * הוספת הוצאה במשרד השיתופי — כפתור אחד, ובתוכו שלושת סוגי ההוצאה.
 *
 * שלושת הטפסים היו פרושים על המסך אחד מתחת לשני, ויחד הם תפסו יותר מקום מהמאזן עצמו:
 * מסך ההנה"ח הוא מסך שמסתכלים בו, והזנת הוצאה היא פעולה שעושים פעם בשבוע. אותו פתרון
 * שכבר עובד בהנה"ח הראשית, ואותן Server Actions בדיוק — רק דרך אחרת להגיע אליהן.
 */
export function AddCoworkingExpenseButton({
  branchId,
  expenseTypes,
  frequencies,
  defaultDate,
  currentMonth,
}: {
  branchId: string;
  expenseTypes: RecurringPurchaseType[];
  /** התדירויות לבחירה, מ-`RECURRING_FREQUENCY_LABELS`. מגיעות כ-prop כדי שהקומפוננטה
   *  הזו לא תייבא את `lib/recurring-expenses` — שם יושב גם `firebase-admin`. */
  frequencies: { value: string; label: string }[];
  /** YYYY-MM-DD */
  defaultDate: string;
  /** YYYY-MM */
  currentMonth: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ExpenseKind>("variable");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  const active = KINDS.find((k) => k.key === kind)!;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        if (kind === "fixed") {
          await createCoworkingFixedExpenseAction(branchId, formData);
        } else if (kind === "recurring") {
          await createRecurringVariableExpenseAction("coworking", branchId, formData);
        } else {
          await createCoworkingVariableExpenseAction(branchId, formData);
        }
        router.refresh();
        setOpen(false);
        showSuccess("ההוצאה נוספה");
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בשמירה");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-red-200 bg-red-50 px-3 py-1.5 text-[12.5px] font-bold text-red-700 transition hover:border-red-400 hover:bg-red-100"
      >
        <Minus className="h-3.5 w-3.5" />
        הוספת הוצאה
      </button>

      {open && (
        <Modal title="הוספת הוצאה — משרד שיתופי" icon={TrendingDown} onClose={() => setOpen(false)} wide>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {KINDS.map((k) => {
              const on = k.key === kind;
              return (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => setKind(k.key)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    on ? "border-teal bg-teal text-white" : "border-card-border bg-white text-ink hover:bg-[#f1f5f9]"
                  }`}
                >
                  <k.icon className="h-3.5 w-3.5" />
                  {k.label}
                </button>
              );
            })}
          </div>
          <p className="mb-3 text-[11.5px] leading-relaxed text-muted">{active.hint}</p>

          {/* `key` על הטופס מאפס את השדות במעבר בין סוגים: שדות של סוג אחד לא אמורים
              להישאר מלאים מתחת לסוג אחר, ובמיוחד לא שדות חובה שכבר אינם מוצגים. */}
          <form key={kind} action={handleSubmit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {kind === "fixed" && (
              <>
                <div>
                  <label className={LABEL}>שם ההוצאה</label>
                  <input name="name" placeholder="שכירות המשרד / ארנונה" required className={FIELD} autoFocus />
                </div>
                <div>
                  <label className={LABEL}>סכום חודשי</label>
                  <input name="amount" type="number" min={0} step="0.01" required className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>מתחיל מתאריך</label>
                  <input name="startDate" type="date" defaultValue={defaultDate} required className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>קטגוריה</label>
                  <input name="category" className={FIELD} />
                </div>
              </>
            )}

            {kind === "recurring" && (
              <>
                <div>
                  <label className={LABEL}>שם ההוצאה</label>
                  <input name="name" placeholder="חשמל / ניקיון" required className={FIELD} autoFocus />
                </div>
                <div>
                  <label className={LABEL}>קטגוריה</label>
                  <input name="category" className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>תדירות</label>
                  <select name="frequency" defaultValue="monthly" className={FIELD}>
                    {frequencies.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>חלוקת העלות</label>
                  <select name="spread" defaultValue="true" className={FIELD}>
                    <option value="true">לפרוס על חודשי המחזור</option>
                    <option value="false">הכל בחודש התשלום</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>מתחיל מתאריך</label>
                  <input name="startDate" type="date" defaultValue={`${currentMonth}-01`} required className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>סכום משוער (לא חובה)</label>
                  <input name="defaultAmount" type="number" step="0.01" className={FIELD} />
                </div>
                <p className="text-[11px] leading-snug text-muted sm:col-span-2">
                  תדירות רב-חודשית נדרשת רק בחודשי החיוב שלה, ו&quot;לפרוס&quot; מחלק את התשלום על כל חודשי
                  המחזור — כדי שחודש עם תשלום שנתי לא ייראה חודש אסון ושאר השנה לא תיראה זולה מכפי שהיא.
                </p>
              </>
            )}

            {kind === "variable" && (
              <>
                <div className="sm:col-span-2">
                  <label className={LABEL}>תיאור</label>
                  <input name="desc" placeholder="למשל: כיסא משרדי" required className={FIELD} autoFocus />
                </div>
                <div>
                  <label className={LABEL}>סכום</label>
                  <input name="amount" type="number" min={0} step="0.01" required className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>תאריך</label>
                  <input name="date" type="date" defaultValue={defaultDate} required className={FIELD} />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>קטגוריה</label>
                  <input name="category" className={FIELD} />
                </div>
                <div className="sm:col-span-2">
                  <ExpenseTypeField types={expenseTypes} idPrefix="coworking-new-variable-type" />
                </div>
              </>
            )}

            <div className="sm:col-span-2">
              <CountsToMainField defaultChecked={kind !== "recurring"} />
            </div>

            <div className="flex items-center gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "שומר..." : "הוספת הוצאה"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-muted transition hover:bg-[#f4f6f9]"
              >
                ביטול
              </button>
            </div>
          </form>
        </Modal>
      )}
      {toastNode}
    </>
  );
}
