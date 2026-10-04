"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import type { QuarterStatus } from "@ultranet/shared-types";
import { setQuarterStatusAction } from "../actions";
import { DeleteQuarterButton } from "../delete-quarter-button";
import { useToast } from "@/lib/toast";

/** ארכוב/החזרה של רבעון מתוך ציר הזמן. שתי הפעולות נרשמות ביומן (סעיף 14). */
export function ArchiveActions({ quarterKey, label, status }: { quarterKey: string; label: string; status: QuarterStatus }) {
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const archived = status === "archived";

  function handleToggle() {
    if (!archived && !confirm(`להעביר את "${label}" לארכיון? הרבעון יהפוך לקריאה בלבד.`)) return;
    startTransition(async () => {
      const result = await setQuarterStatusAction(quarterKey, archived ? "active" : "archived");
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(archived ? "הרבעון חזר לפעיל" : "הרבעון הועבר לארכיון");
      router.refresh();
    });
  }

  return (
    <>
      {toastNode}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#f4f6f9] disabled:opacity-60"
      >
        {archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
        {archived ? "החזרה לפעיל" : "ארכוב"}
      </button>
      <DeleteQuarterButton quarterKey={quarterKey} label={label} variant="icon" onDeleted={() => router.refresh()} />
    </>
  );
}
