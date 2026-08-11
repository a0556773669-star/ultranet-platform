"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteSeedDataAction } from "./cleanup-seed-actions";
import { useToast } from "@/lib/toast";

export function CleanupSeedButton() {
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError, toastNode } = useToast();

  function handleClick() {
    if (
      !confirm(
        "למחוק את כל הסלעים/אבני הדרך/הנהלים שהוכנסו ע\"י הייבוא האוטומטי הקודם?\nכל מה שהוזן ידנית לא ייפגע."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteSeedDataAction();
      if (!result.ok) {
        showError(result.message);
        return;
      }
      const { summary } = result;
      const total = summary.rocksDeleted + summary.milestonesDeleted + summary.proceduresDeleted;
      showSuccess(
        total === 0
          ? "לא נמצא מה למחוק - כנראה כבר נוקה"
          : `נמחקו ${summary.rocksDeleted} סלעים, ${summary.milestonesDeleted} אבני דרך ו-${summary.proceduresDeleted} נהלים מהייבוא הקודם`
      );
    });
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-[11px] border border-dashed border-red-200 bg-red-50 px-4 py-3">
      {toastNode}
      <div className="text-xs text-red-700">
        ניקוי חד-פעמי (owner בלבד) - מוחק את מה שהוכנס אוטומטית ע&quot;י הייבוא הקודם, כדי להזין הכל ידנית מחדש.
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {isPending ? "מוחק..." : "ניקוי נתוני ייבוא"}
      </button>
    </div>
  );
}
