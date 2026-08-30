"use client";

import { useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import {
  ACCOUNTING_EXPENSE_CATEGORIES,
  ACCOUNTING_INCOME_CATEGORIES,
} from "@/lib/accounting-categories";
import type { MovementEntry } from "@/lib/accounting-entries";
import { updateEntryAction, type SaveResult } from "./entry-actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export interface BranchOption {
  id: string;
  name: string;
}

export interface BranchGroups {
  rooms: BranchOption[];
  rentals: BranchOption[];
  coworking: BranchOption[];
}

/**
 * Edits any of the four kinds of movement, and re-files it while it's open.
 *
 * The branch picker here is the same decision as the attribution screen - "whose book is this
 * row in" - so a row typed into the wrong place is fixed where it is seen, without hunting for
 * the screen it happens to belong to.
 */
export function EditEntryModal({
  entry,
  branches,
  onSaved,
}: {
  entry: MovementEntry;
  branches: BranchGroups;
  onSaved: (result: SaveResult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const categories: readonly string[] =
    entry.kind === "income" ? ACCOUNTING_INCOME_CATEGORIES : ACCOUNTING_EXPENSE_CATEGORIES;
  const title = entry.kind === "income" ? "עריכת הכנסה" : "עריכת הוצאה";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await updateEntryAction(entry.kind, entry.book, entry.id, formData);
      if (res.ok) {
        setOpen(false);
        onSaved(res);
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap rounded-lg border border-card-border bg-white px-2.5 py-1 text-[11.5px] font-bold text-ink transition hover:bg-[#f4f6f9]"
      >
        עריכה
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-card bg-white p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
                <Pencil className="h-4 w-4" />
                {title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted transition hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
              <label className="text-[11px] font-bold text-muted">תאריך</label>
              <input type="date" name="date" defaultValue={entry.date} required className={FIELD} />

              <label className="text-[11px] font-bold text-muted">קטגוריה</label>
              <select name="category" defaultValue={entry.category ?? ""} className={FIELD}>
                <option value="">ללא קטגוריה</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                {entry.category && !categories.includes(entry.category) && (
                  <option value={entry.category}>{entry.category}</option>
                )}
              </select>

              <label className="text-[11px] font-bold text-muted">תיאור</label>
              <input name="desc" defaultValue={entry.desc} placeholder="תיאור" className={FIELD} />

              <label className="text-[11px] font-bold text-muted">סכום</label>
              <input
                type="number"
                name="amount"
                min={1}
                step="1"
                defaultValue={entry.amount}
                required
                className={FIELD}
              />

              <label className="text-[11px] font-bold text-muted">שיוך לסניף</label>
              <select
                name="branchId"
                defaultValue={entry.book === "branch" ? entry.branchId ?? "" : ""}
                className={FIELD}
              >
                <option value="">כללי — הנה&quot;ח אישית</option>
                {branches.rooms.length > 0 && (
                  <optgroup label="חדרי מחשבים">
                    {branches.rooms.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {branches.rentals.length > 0 && (
                  <optgroup label="ניידים / השכרות">
                    {branches.rentals.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {branches.coworking.length > 0 && (
                  <optgroup label="משרד שיתופי">
                    {branches.coworking.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="text-[11px] text-muted">
                בחירת סניף מעבירה את השורה לספר של אותו סניף. &quot;כללי&quot; מחזיר אותה להנה&quot;ח
                האישית. השורה תמיד נמצאת במקום אחד בלבד.
              </p>

              {error && (
                <p className="text-[12.5px] font-bold text-red-600" role="status">
                  ✕ {error}
                </p>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "שומר..." : "שמור"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-[10px] border border-card-border px-4 py-2 text-sm font-bold text-muted transition hover:bg-[#f4f6f9]"
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
