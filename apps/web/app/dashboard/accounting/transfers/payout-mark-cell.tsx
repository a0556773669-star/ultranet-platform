"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { recordPartnerPayoutAction } from "./payout-actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/** תיבת סימון = "העברתי הכל", ושדה מספר לצידה = "העברתי חלק". שניהם כותבים אותה רשומה. */
export function PayoutMarkCell({
  partnerName,
  month,
  due,
  paid,
}: {
  partnerName: string;
  month: string;
  due: number;
  paid: number;
}) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function submit(amount: number) {
    const fd = new FormData();
    fd.set("paidAmount", String(amount));
    startTransition(async () => {
      try {
        await recordPartnerPayoutAction(partnerName, month, fd);
        setEditing(false);
        router.refresh();
        showSuccess(amount > 0 ? "נרשם כהועבר" : "הסימון בוטל");
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה");
      }
    });
  }

  const fully = paid > 0 && Math.abs(paid - due) < 1;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={paid > 0}
          disabled={isPending || due <= 0}
          onChange={(e) => submit(e.target.checked ? Math.round(due) : 0)}
          className="h-4 w-4 accent-teal"
        />
        {paid > 0 && (
          <span className={`text-[11px] font-bold ${fully ? "text-teal-dark" : "text-amber-700"}`}>{money(paid)}</span>
        )}
        {editing ? (
          <form
            action={(fd) => submit(Number(fd.get("paidAmount")))}
            className="flex items-center gap-1"
          >
            <input
              name="paidAmount"
              type="number"
              step="1"
              defaultValue={Math.round(paid || due)}
              className="w-20 rounded border border-card-border px-1 py-0.5 text-[11px]"
            />
            <button type="submit" className="rounded bg-teal px-1.5 py-0.5 text-[10px] font-bold text-white">
              שמור
            </button>
          </form>
        ) : (
          due > 0 && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[10.5px] font-bold text-muted underline hover:text-teal"
            >
              סכום אחר
            </button>
          )
        )}
      </div>
      {toastNode}
    </>
  );
}
