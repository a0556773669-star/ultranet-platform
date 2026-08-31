"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateRentalHistoryAction, updateRentalItemAction, markRentalUnpaidAction } from "../actions";
import { UnpaidRowActions } from "./unpaid-row-actions";
import { DeleteHistoryRentalButton } from "./delete-history-rental-button";
import type { HistoryRowData } from "./rentals-lists";

export function HistoryRentalRow({ r }: { r: HistoryRowData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(r.startDate);
  const [returnDate, setReturnDate] = useState(r.returnDate ?? "");
  const [finalPrice, setFinalPrice] = useState(String(Math.round(r.price || 0)));
  const [notes, setNotes] = useState(r.notes ?? "");
  const [itemId, setItemId] = useState(r.itemId);
  const [unpaidPending, setUnpaidPending] = useState(false);

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateRentalHistoryAction(r.rentalId, {
          startDate,
          returnDate,
          finalPrice: Number(finalPrice) || 0,
          notes: notes.trim() || undefined,
        });
        if (itemId !== r.itemId) {
          await updateRentalItemAction(r.rentalId, itemId);
        }
        setEditing(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בעדכון ההשכרה");
      }
    });
  }

  function handleMarkUnpaid() {
    if (!confirm("לבטל את סימון \"שולם\"?")) return;
    setUnpaidPending(true);
    setError(null);
    startTransition(async () => {
      try {
        await markRentalUnpaidAction(r.rentalId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בביטול סימון התשלום");
      } finally {
        setUnpaidPending(false);
      }
    });
  }

  return (
    <>
      <tr className={`border-t border-card-border transition hover:bg-[#f8fafc] ${!r.paid ? "bg-red-50" : ""}`}>
        <td className="px-[11px] py-2 text-muted">
          <Link href={`/dashboard/rentals/clients/${r.clientId}`} className="hover:underline">
            {r.clientName}
          </Link>
        </td>
        <td className="px-[11px] py-2 text-muted">{r.itemName}</td>
        <td className="px-[11px] py-2 text-muted">{r.branchName}</td>
        <td className="px-[11px] py-2 text-muted">{r.startDate}</td>
        <td className="px-[11px] py-2 text-muted">{r.returnDate}</td>
        <td className="px-[11px] py-2 font-semibold text-ink">{Math.round(r.price || 0).toLocaleString()} ₪</td>
        <td className="px-[11px] py-2">
          {r.paid ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">שולם</span>
              <button
                type="button"
                disabled={unpaidPending}
                onClick={handleMarkUnpaid}
                className="rounded-[8px] border border-card-border px-2 py-0.5 text-[11px] font-bold text-ink transition hover:bg-[#f4f6f9] disabled:opacity-50"
              >
                {unpaidPending ? "..." : "ביטול סימון"}
              </button>
            </div>
          ) : (
            <UnpaidRowActions rentalId={r.rentalId} routes={r.routes} />
          )}
        </td>
        <td className="px-[11px] py-2 text-left">
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded-[8px] border border-card-border px-2 py-1 text-[11px] font-bold text-ink transition hover:bg-[#f4f6f9]"
            >
              {editing ? "ביטול" : "עריכה"}
            </button>
            {r.canDelete && <DeleteHistoryRentalButton rentalId={r.rentalId} />}
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="border-t border-card-border bg-[#f8fafc]">
          <td colSpan={8} className="px-[11px] py-3">
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-[11px] font-bold text-muted">
                פריט (מחשב/סטיק)
                <select
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className="rounded-[8px] border border-card-border px-2 py-1 text-[13px]"
                >
                  {r.itemOptions.map((it) => (
                    <option key={it.id} value={it.id}>{it.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-bold text-muted">
                תאריך התחלה
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-[8px] border border-card-border px-2 py-1 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-bold text-muted">
                תאריך החזרה
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="rounded-[8px] border border-card-border px-2 py-1 text-[13px]"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-bold text-muted">
                מחיר סופי (₪)
                <input
                  type="number"
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value)}
                  className="w-24 rounded-[8px] border border-card-border px-2 py-1 text-[13px]"
                />
              </label>
              <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[11px] font-bold text-muted">
                הערות
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-[8px] border border-card-border px-2 py-1 text-[13px]"
                />
              </label>
              <button
                type="button"
                disabled={pending}
                onClick={handleSave}
                className="rounded-[8px] bg-gradient-to-br from-teal to-teal-light px-3 py-1.5 text-[11px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "שומר..." : "שמירה"}
              </button>
              {error && <span className="text-[11px] font-bold text-red-600">{error}</span>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
