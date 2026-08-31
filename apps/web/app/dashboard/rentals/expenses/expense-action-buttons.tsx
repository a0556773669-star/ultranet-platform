"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { endFixedExpenseAction, deleteFixedExpenseAction, deleteVariableExpenseAction } from "./actions";

export function EndFixedExpenseControl({ id, branchId }: { id: string; branchId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await endFixedExpenseAction(id, branchId, formData);
        router.refresh();
        showSuccess("ההוצאה סומנה כמסתיימת בהצלחה");
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה");
      }
    });
  }

  return (
    <>
      <form action={handleSubmit} className="flex items-center gap-1">
        <input name="endDate" type="date" className="rounded-lg border border-card-border bg-white px-2 py-1 text-xs" />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-card-border bg-white px-2 py-1 text-xs font-bold text-ink hover:bg-[#f4f6f9] disabled:opacity-50"
        >
          {isPending ? "..." : "סיום"}
        </button>
      </form>
      {toastNode}
    </>
  );
}

export function DeleteFixedExpenseButton({ id, branchId }: { id: string; branchId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function handleClick() {
    if (!confirm("למחוק את ההוצאה?")) return;
    startTransition(async () => {
      try {
        await deleteFixedExpenseAction(id, branchId);
        router.refresh();
        showSuccess("ההוצאה נמחקה בהצלחה");
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
        className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "מוחק..." : "מחיקה"}
      </button>
      {toastNode}
    </>
  );
}

export function DeleteVariableExpenseButton({ id, branchId }: { id: string; branchId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function handleClick() {
    if (!confirm("למחוק את ההוצאה?")) return;
    startTransition(async () => {
      try {
        await deleteVariableExpenseAction(id, branchId);
        router.refresh();
        showSuccess("ההוצאה נמחקה בהצלחה");
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
        className="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {isPending ? "מוחק..." : "מחיקה"}
      </button>
      {toastNode}
    </>
  );
}
