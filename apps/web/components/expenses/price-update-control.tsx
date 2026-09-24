"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { useToast } from "@/lib/toast";

export interface PriceUpdateResult {
  ok: boolean;
  message: string;
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * כפתור "עדכון מחיר" של הוצאה קבועה — אותה קוביה בכל מסך הוצאות באתר.
 *
 * השכירות עלתה עד היום 2,000 ₪ ומהחודש הזה 2,300 ₪: בוחרים מאיזה חודש ומה הסכום החדש, וזהו.
 * החודשים שלפני נשארים בסכום הישן — השרת סוגר את השורה ופותח גרסה חדשה
 * (`lib/fixed-expense-revision.ts`), ולעולם לא עורך את הסכום של חודשים שעברו.
 *
 * כל מודול מעביר `submit` משלו, שקורא ל-Server Action שלו — ההרשאה נבדקת שם.
 */
export function PriceUpdateControl({
  currentAmount,
  submit,
}: {
  currentAmount: number;
  submit: (fromMonth: string, newAmount: number) => Promise<PriceUpdateResult>;
}) {
  const [open, setOpen] = useState(false);
  const [fromMonth, setFromMonth] = useState(currentMonth());
  const [amount, setAmount] = useState(String(currentAmount || ""));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function save() {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      showError("יש להזין סכום חודשי חדש");
      return;
    }
    startTransition(async () => {
      try {
        const result = await submit(fromMonth, value);
        if (result.ok) {
          showSuccess(result.message);
          setOpen(false);
          router.refresh();
        } else {
          showError(result.message);
        }
      } catch (e) {
        showError(e instanceof Error ? e.message : "אירעה שגיאה");
      }
    });
  }

  return (
    <>
      {open ? (
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-teal/40 bg-teal-bg/40 px-1.5 py-1">
          <span className="text-[11px] font-bold text-muted">מ-</span>
          <input
            type="month"
            value={fromMonth}
            onChange={(e) => setFromMonth(e.target.value)}
            className="rounded-md border border-card-border bg-white px-1.5 py-0.5 text-[11px]"
            title="החודש הראשון שבו חל הסכום החדש"
          />
          <input
            type="number"
            min={0}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-20 rounded-md border border-card-border bg-white px-1.5 py-0.5 text-[11px]"
            title="הסכום החודשי החדש"
          />
          <span className="text-[11px] text-muted">₪</span>
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="rounded-md bg-teal px-2 py-0.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            {isPending ? "..." : "שמירה"}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="px-1 text-[11px] font-bold text-muted">
            ביטול
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2 py-1 text-xs font-bold text-teal-dark hover:bg-[#f4f6f9]"
          title="הסכום משתנה מחודש מסוים והלאה — מה שהיה עד אז נשאר"
        >
          <TrendingUp className="h-3 w-3" />
          עדכון מחיר
        </button>
      )}
      {toastNode}
    </>
  );
}
