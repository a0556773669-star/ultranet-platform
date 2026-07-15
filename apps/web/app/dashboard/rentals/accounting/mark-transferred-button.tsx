"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { markTransferredAction } from "./branch-actions";

export function MarkTransferredButton({
  branchId,
  month,
  netToOwner,
  incomeShareToOwner,
  expenseNetToOwner,
}: {
  branchId: string;
  month: string;
  netToOwner: number;
  incomeShareToOwner: number;
  expenseNetToOwner: number;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="flex items-center gap-1.5 text-sm font-bold text-teal-dark">
        העברתי
        <Check className="h-4 w-4" />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markTransferredAction(branchId, month, netToOwner, incomeShareToOwner, expenseNetToOwner);
          setDone(true);
        })
      }
      className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:brightness-105 disabled:opacity-60"
    >
      {pending ? "מסמן..." : "סימנתי שהעברתי"}
    </button>
  );
}
