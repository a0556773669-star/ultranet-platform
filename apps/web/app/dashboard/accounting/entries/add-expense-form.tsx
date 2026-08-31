"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { ACCOUNTING_EXPENSE_CATEGORIES } from "@/lib/accounting-categories";
import { saveExpenseAction, type SaveResult } from "../expense-actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export interface BranchOption {
  id: string;
  name: string;
}

/**
 * The expense form on the entry screen. A client component so a rejected save says why, instead
 * of leaving a button that appears to do nothing.
 */
export function AddExpenseForm({
  rooms,
  rentals,
  coworking,
}: {
  rooms: BranchOption[];
  rentals: BranchOption[];
  coworking: BranchOption[];
}) {
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setResult(null);
    startTransition(async () => {
      const res = await saveExpenseAction(formData);
      setResult(res);
      if (res.ok) form.reset();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card"
    >
      <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        <Upload className="h-4 w-4" />
        הוספת הוצאה
      </h2>

      <input type="date" name="date" defaultValue={today} className={FIELD} />
      <select name="category" defaultValue="" className={FIELD}>
        <option value="">קטגוריה (לא חובה)</option>
        {ACCOUNTING_EXPENSE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input name="desc" placeholder="תיאור" className={FIELD} />
      <input type="number" name="amount" min={1} step="1" placeholder="סכום" className={FIELD} />

      <select name="branchId" defaultValue="" className={FIELD}>
        <option value="">כללי — לא משויך לסניף</option>
        {rooms.length > 0 && (
          <optgroup label="חדרי מחשבים">
            {rooms.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </optgroup>
        )}
        {rentals.length > 0 && (
          <optgroup label="ניידים / השכרות">
            {rentals.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </optgroup>
        )}
        {coworking.length > 0 && (
          <optgroup label="משרד שיתופי">
            {coworking.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <p className="text-[11px] text-muted">
        בחירת סניף רושמת את ההוצאה בספר של אותו סניף. &quot;כללי&quot; רושם אותה בהנה&quot;ח האישית שלך.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-7 py-2.5 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "שומר..." : "שמור"}
        </button>
        {result && (
          <span className={`text-[13px] font-bold ${result.ok ? "text-emerald-600" : "text-red-600"}`} role="status">
            {result.ok ? "✓ " : "✕ "}
            {result.message}
          </span>
        )}
      </div>
    </form>
  );
}
