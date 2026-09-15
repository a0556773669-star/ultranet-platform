"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { endMainFixedExpenseAction } from "../actions";

/**
 * "הפסקה" של הוצאה קבועה — תאריך + כפתור, ולא כפתור מחיקה.
 *
 * הוצאה שנגמרה לא נמחקת: החודשים שהיא כן הייתה פעילה בהם באמת יצאו מהכיס, והם
 * צריכים להישאר בספר הראשי. תאריך ריק = היום.
 */
export function EndMainFixedExpenseControl({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await endMainFixedExpenseAction(id, formData);
        router.refresh();
        showSuccess("ההוצאה סומנה כמסתיימת");
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה");
      }
    });
  }

  return (
    <>
      <form action={handleSubmit} className="flex items-center gap-1">
        <input
          name="endDate"
          type="date"
          title="התאריך שבו ההוצאה נגמרה — ריק = היום"
          className="rounded-lg border border-card-border bg-white px-2 py-1 text-[11px]"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-card-border bg-white px-2 py-1 text-[11px] font-bold text-ink transition hover:bg-[#f4f6f9] disabled:opacity-50"
        >
          {isPending ? "..." : "הפסקה"}
        </button>
      </form>
      {toastNode}
    </>
  );
}
