"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRentalAction } from "../actions";

export function DeleteHistoryRentalButton({ rentalId }: { rentalId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (!confirm("האם למחוק את ההשכרה לצמיתות")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteRentalAction(rentalId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה במחיקת השכרה");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="rounded-[8px] border border-red-200 px-2 py-1 text-[11px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "מוחק..." : "מחיקה"}
      </button>
      {error && <span className="text-[10px] font-bold text-red-600">{error}</span>}
    </div>
  );
}
