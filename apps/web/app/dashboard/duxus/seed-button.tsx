"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { seedInitialTasksAndProceduresAction } from "./seed-actions";
import { useToast } from "@/lib/toast";

export function SeedButton() {
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError, toastNode } = useToast();

  function handleClick() {
    if (
      !confirm(
        'לייבא את הסלעים/אבני הדרך והנהלים המוכנים (חברה מסודרת, הגדלת הכנסות + 3 נהלים)?\nהפעולה בטוחה להרצה חוזרת - כל מה שכבר קיים ידולג.'
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await seedInitialTasksAndProceduresAction();
      if (!result.ok) {
        showError(result.message);
        return;
      }
      const { summary } = result;
      showSuccess(
        `נוצרו ${summary.rocksCreated} סלעים, ${summary.milestonesCreated} אבני דרך ו-${summary.proceduresCreated} נהלים (${summary.rocksSkipped + summary.milestonesSkipped + summary.proceduresSkipped} כבר היו קיימים)`
      );
    });
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-[11px] border border-dashed border-teal bg-teal-bg/40 px-4 py-3">
      {toastNode}
      <div className="text-xs text-teal-dark">
        ייבוא ראשוני חד-פעמי (owner בלבד) - מכניס את הסלעים/אבני הדרך והנהלים המוכנים. אפשר להריץ כמה פעמים - מה שכבר קיים ידולג.
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-teal bg-white px-3 py-1.5 text-xs font-bold text-teal-dark transition hover:bg-teal-bg disabled:opacity-60"
      >
        <Download className="h-3.5 w-3.5" />
        {isPending ? "מייבא..." : "ייבוא נתונים ראשוני"}
      </button>
    </div>
  );
}
