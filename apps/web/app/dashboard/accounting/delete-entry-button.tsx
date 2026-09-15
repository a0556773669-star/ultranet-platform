"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useToast } from "@/lib/toast";

export function DeleteEntryButton({
  confirmText,
  action,
  successText = "נמחק בהצלחה",
  compact = false,
}: {
  confirmText: string;
  action: () => Promise<void>;
  successText?: string;
  /** גרסת אייקון לטבלאות צפופות — אותה התנהגות בדיוק, רק בלי המילה "מחיקה" */
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function handleClick() {
    if (!confirm(confirmText)) return;
    startTransition(async () => {
      try {
        await action();
        router.refresh();
        showSuccess(successText);
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה במחיקה");
      }
    });
  }

  if (compact) {
    return (
      <>
        <button
          type="button"
          disabled={isPending}
          onClick={handleClick}
          title="מחיקה"
          aria-label="מחיקה"
          className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-lg border border-red-200 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 className="h-3 w-3" />
        </button>
        {toastNode}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "מוחק..." : "מחיקה"}
      </button>
      {toastNode}
    </>
  );
}
