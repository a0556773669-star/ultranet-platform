"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { wipeAllRocksDataAction } from "./wipe-actions";
import { useToast } from "@/lib/toast";

export function WipeRocksButton() {
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError, toastNode } = useToast();

  function handleClick() {
    if (
      !confirm(
        'למחוק לצמיתות את כל הסלעים, כל תתי-הסלעים, כל אבני הדרך וכל סיכומי הפגישות - מכל הרבעונים?\nהפעולה בלתי הפיכה. נהלים לא נמחקים.'
      )
    ) {
      return;
    }
    if (!confirm('בטוח לגמרי? זו מחיקה סופית של כל הנתונים ברבעונים/חודשים/שבועות.')) {
      return;
    }
    startTransition(async () => {
      const result = await wipeAllRocksDataAction();
      if (!result.ok) {
        showError(result.message);
        return;
      }
      const { summary } = result;
      showSuccess(
        `נמחקו ${summary.rocksDeleted} סלעים, ${summary.milestonesDeleted} אבני דרך ו-${summary.reviewsDeleted} סיכומי פגישות`
      );
    });
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-[11px] border border-dashed border-red-200 bg-red-50 px-4 py-3">
      {toastNode}
      <div className="text-xs text-red-700">
        איפוס חד-פעמי (owner בלבד) - מוחק לצמיתות את כל הסלעים ואבני הדרך מכל הרבעונים, כדי להתחיל מאפס.
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex shrink-0 items-center gap-1.5 rounded-[10px] border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {isPending ? "מוחק..." : "מחיקת כל הסלעים ואבני הדרך"}
      </button>
    </div>
  );
}
