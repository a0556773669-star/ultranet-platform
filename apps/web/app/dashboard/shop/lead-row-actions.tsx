"use client";

import { useTransition } from "react";
import type { ShopLeadStatus } from "@ultranet/shared-types";
import { updateLeadStatusAction, deleteLeadAction } from "./actions";

const STATUS_OPTIONS: { value: ShopLeadStatus; label: string }[] = [
  { value: "new", label: "חדש" },
  { value: "contacted", label: "יצרנו קשר" },
  { value: "closed", label: "נסגר" },
];

export function LeadRowActions({ id, status }: { id: string; status: ShopLeadStatus }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={status}
        disabled={isPending}
        onChange={(e) => startTransition(() => updateLeadStatusAction(id, e.target.value as ShopLeadStatus))}
        className="rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-xs font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        onClick={() => {
          if (confirm("למחוק את הליד? הפעולה אינה הפיכה.")) startTransition(() => deleteLeadAction(id));
        }}
        disabled={isPending}
        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
      >
        מחיקה
      </button>
    </div>
  );
}
