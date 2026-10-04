"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { stampMissingAddedDatesAction } from "./actions";

export function StampDatesButton({ ids }: { ids: string[] }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-lg border border-card-border bg-white px-2 py-1 text-xs"
      />
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const r = await stampMissingAddedDatesAction(ids, date);
            if (r.ok) {
              showSuccess(r.message);
              router.refresh();
            } else showError(r.message);
          })
        }
        className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {isPending ? "..." : "קבע להם תאריך הוספה"}
      </button>
      {toastNode}
    </div>
  );
}
