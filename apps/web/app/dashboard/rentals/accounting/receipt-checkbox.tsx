"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { setBranchTransferReceiptAction } from "../ledger/actions";

/** Simple "הוצאנו קבלה" checkbox for a branch/month, independent of the transfer amount itself. */
export function ReceiptCheckbox({
  branchId,
  month,
  receiptIssued,
}: {
  branchId: string;
  month: string;
  receiptIssued: boolean;
}) {
  const [checked, setChecked] = useState(receiptIssued);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showError, toastNode } = useToast();

  function toggle() {
    const next = !checked;
    setChecked(next);
    startTransition(async () => {
      try {
        await setBranchTransferReceiptAction(branchId, month, next);
        router.refresh();
      } catch (err) {
        setChecked(!next);
        showError(err instanceof Error ? err.message : "אירעה שגיאה בשמירה");
      }
    });
  }

  return (
    <div className="flex items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={isPending}
        onChange={toggle}
        className="h-4 w-4 accent-teal"
        title="הוצאנו קבלה"
      />
      {toastNode}
    </div>
  );
}
