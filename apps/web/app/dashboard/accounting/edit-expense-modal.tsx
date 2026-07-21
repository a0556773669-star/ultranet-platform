"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";
import type { AccountingExpense } from "@ultranet/shared-types";
import { updateExpenseAction } from "./actions";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export function EditExpenseModal({ expense }: { expense: AccountingExpense }) {
  const [open, setOpen] = useState(false);
  const update = updateExpenseAction.bind(null, expense.id);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-card-border px-2 py-1 text-[11px] font-medium text-ink transition hover:bg-[#f4f6f9]"
      >
        עריכה
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-card bg-white p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
                <Pencil className="h-4 w-4" />
                עריכת הוצאה
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="text-lg text-muted transition hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              action={async (formData: FormData) => {
                await update(formData);
                setOpen(false);
              }}
              className="flex flex-col gap-2.5"
            >
              <input type="date" name="date" defaultValue={expense.date} required className={FIELD} />
              <input name="desc" defaultValue={expense.desc} placeholder="תיאור" className={FIELD} />
              <input type="number" name="amount" min={0} defaultValue={expense.amount} placeholder="סכום" required className={FIELD} />
              <select name="business" defaultValue={expense.business} className={FIELD}>
                <option value="general">כללי</option>
                <option value="computers">מחשבים</option>
                <option value="rentals">השכרות</option>
                <option value="coworking">משרד שיתופי</option>
              </select>
              <button
                type="submit"
                className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
              >
                שמירה
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
