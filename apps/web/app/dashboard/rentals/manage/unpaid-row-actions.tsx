"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markRentalPaidAction } from "../actions";

type Props = {
  rentalId: string;
  hasRoute: boolean;
};

export function UnpaidRowActions({ rentalId, hasRoute }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function mark(method: "cash" | "route") {
    setError(null);
    startTransition(async () => {
      try {
        await markRentalPaidAction(rentalId, method);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">לא שולם</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => mark("cash")}
        className="rounded-[6px] bg-[#f4f6f9] px-2 py-1 text-[11px] font-bold text-ink transition hover:bg-[#e9edf3] disabled:opacity-50"
      >
        סמן ששולם (מזומן)
      </button>
      {hasRoute && (
        <button
          type="button"
          disabled={pending}
          onClick={() => mark("route")}
          className="rounded-[6px] bg-[#f4f6f9] px-2 py-1 text-[11px] font-bold text-ink transition hover:bg-[#e9edf3] disabled:opacity-50"
        >
          גבייה דרך מסלול
        </button>
      )}
      {error && <span className="text-[11px] font-bold text-red-600">{error}</span>}
    </div>
  );
}
