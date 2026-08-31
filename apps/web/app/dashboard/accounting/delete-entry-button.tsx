"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";

export function DeleteEntryButton({
  confirmText,
  action,
  successText = "נמחק בהצלחה",
}: {
  confirmText: string;
  action: () => Promise<void>;
  successText?: string;
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
