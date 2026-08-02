"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import { recordBranchTransferAction } from "./actions";
import type { LedgerMonthRow } from "@/lib/branch-ledger";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

export function LedgerRowEditor({ branchId, row }: { branchId: string; row: LedgerMonthRow }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(Math.round(row.transferredAmount)));
  const [note, setNote] = useState(row.transferNote ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function save() {
    const parsed = Number(amount);
    if (Number.isNaN(parsed)) {
      showError("סכום לא תקין");
      return;
    }
    startTransition(async () => {
      try {
        await recordBranchTransferAction(
          branchId,
          row.month,
          row.netToOwner,
          0,
          0,
          parsed,
          note.trim()
        );
        router.refresh();
        showSuccess("נשמר בהצלחה");
        setEditing(false);
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בשמירה");
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-end gap-2">
        <div className="flex flex-col items-end">
          <span className={`font-bold ${row.transferredAmount === 0 ? "text-muted" : "text-ink"}`}>
            {money(row.transferredAmount)}
          </span>
          {row.transferNote && <span className="text-[10px] text-muted">{row.transferNote}</span>}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-md border border-card-border p-1 text-muted transition hover:bg-[#f4f6f9] hover:text-ink"
          title="עריכה"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {toastNode}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-24 rounded-md border border-card-border px-1.5 py-1 text-left text-xs focus:border-teal focus:outline-none"
          autoFocus
        />
        <button
          type="button"
          disabled={isPending}
          onClick={save}
          className="rounded-md bg-teal p-1 text-white transition hover:opacity-90 disabled:opacity-60"
          title="שמירה"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setAmount(String(Math.round(row.transferredAmount)));
            setNote(row.transferNote ?? "");
          }}
          className="rounded-md border border-card-border p-1 text-muted transition hover:bg-[#f4f6f9]"
          title="ביטול"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="הערה (לא חובה)"
        className="w-32 rounded-md border border-card-border px-1.5 py-1 text-[11px] focus:border-teal focus:outline-none"
      />
      {toastNode}
    </div>
  );
}
