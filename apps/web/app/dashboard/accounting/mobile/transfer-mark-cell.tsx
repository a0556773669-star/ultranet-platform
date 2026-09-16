"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { recordBranchTransferAction } from "./transfer-actions";

/** Checkbox + amount for "did this branch/partner transfer this month's balance yet". Checking it
 *  marks the full amount due as transferred; the amount field stays editable for partial transfers. */
export function TransferMarkCell({
  branchId,
  month,
  netToOwner,
  totalDue,
  transferredAmount,
}: {
  branchId: string;
  month: string;
  netToOwner: number;
  totalDue: number;
  transferredAmount: number;
}) {
  const [checked, setChecked] = useState(transferredAmount !== 0);
  const [amount, setAmount] = useState(String(Math.round(transferredAmount)));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function save(nextAmount: number) {
    startTransition(async () => {
      try {
        await recordBranchTransferAction(branchId, month, netToOwner, 0, 0, nextAmount, "");
        router.refresh();
        showSuccess("נשמר בהצלחה");
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בשמירה");
      }
    });
  }

  function toggle() {
    const next = !checked;
    const nextAmount = next ? Math.round(totalDue) : 0;
    setChecked(next);
    setAmount(String(nextAmount));
    save(nextAmount);
  }

  function commitAmount() {
    const parsed = Number(amount);
    if (Number.isNaN(parsed)) {
      showError("סכום לא תקין");
      return;
    }
    setChecked(parsed !== 0);
    save(parsed);
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={commitAmount}
        disabled={isPending}
        className="w-24 rounded-md border border-card-border px-1.5 py-1 text-left text-xs focus:border-teal focus:outline-none disabled:opacity-60"
      />
      <input
        type="checkbox"
        checked={checked}
        disabled={isPending}
        onChange={toggle}
        className="h-4 w-4 accent-teal"
        title="הועבר"
      />
      {toastNode}
    </div>
  );
}
