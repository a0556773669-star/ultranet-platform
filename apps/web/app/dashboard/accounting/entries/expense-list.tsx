"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { deleteExpenseRowAction, type ExpenseSource, type SaveResult } from "../expense-actions";

export interface ExpenseRow {
  id: string;
  source: ExpenseSource;
  desc: string;
  date: string;
  amount: number;
  category?: string;
  /** branch name for a branch row; undefined for the personal ledger */
  branchName?: string;
}

const money = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

/**
 * Every expense the owner has, from BOTH books in one list.
 * Before this, the screen listed only the personal ledger - so an expense saved to a branch
 * vanished from view the moment it was written, which read as "the save didn't work".
 * Each row says which book it belongs to and can be deleted from here.
 */
export function ExpenseList({ rows }: { rows: ExpenseRow[] }) {
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<SaveResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "ledger" | "branch">("all");

  const visible = rows.filter(
    (r) => !deleted.has(`${r.source}:${r.id}`) && (filter === "all" || r.source === filter),
  );

  function remove(row: ExpenseRow) {
    const label = `${row.desc || "הוצאה"} — ${money(row.amount)}`;
    if (!window.confirm(`למחוק את "${label}"?\nהפעולה בלתי הפיכה.`)) return;
    setBusy(`${row.source}:${row.id}`);
    setResult(null);
    startTransition(async () => {
      const res = await deleteExpenseRowAction(row.source, row.id);
      setBusy(null);
      setResult(res.ok ? { ok: true, message: `נמחק: ${label}` } : res);
      if (res.ok) setDeleted((prev) => new Set(prev).add(`${row.source}:${row.id}`));
    });
  }

  const tab = (key: typeof filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(key)}
      className={
        filter === key
          ? "rounded-md bg-teal-bg px-2.5 py-1 text-xs font-bold text-teal-dark"
          : "rounded-md px-2.5 py-1 text-xs font-bold text-muted transition hover:bg-[#f4f6f9]"
      }
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        <span className="flex items-center gap-1.5">
          <Upload className="h-4 w-4" />
          כל ההוצאות
        </span>
        <div className="flex gap-0.5">
          {tab("all", `הכל (${rows.length})`)}
          {tab("ledger", "הנה\"ח אישית")}
          {tab("branch", "לפי סניף")}
        </div>
      </div>

      {result && (
        <p
          className={`mb-2 text-[13px] font-bold ${result.ok ? "text-emerald-600" : "text-red-600"}`}
          role="status"
        >
          {result.ok ? "✓ " : "✕ "}
          {result.message}
        </p>
      )}

      <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
        {visible.length === 0 && <p className="py-6 text-center text-sm text-muted">אין הוצאות להצגה</p>}
        {visible.map((r) => {
          const key = `${r.source}:${r.id}`;
          return (
            <div
              key={key}
              className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-ink">{r.desc || "הוצאה"}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <span>{r.date}</span>
                  {r.category && <span>· {r.category}</span>}
                  {r.branchName ? (
                    <span className="rounded-full bg-[#e8effc] px-2 py-0.5 font-bold text-[#1d4fb8]">
                      {r.branchName}
                    </span>
                  ) : (
                    <span className="rounded-full bg-teal-bg px-2 py-0.5 font-bold text-teal-dark">
                      הנה&quot;ח אישית
                    </span>
                  )}
                </div>
              </div>
              <div className="min-w-[80px] text-left font-extrabold tabular-nums text-red-600">
                {money(r.amount)}
              </div>
              <button
                type="button"
                onClick={() => remove(r)}
                disabled={busy === key}
                className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {busy === key ? "מוחק..." : "מחיקה"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[11.5px] text-muted">
        הוצאה שנשמרה לסניף מופיעה כאן עם שם הסניף, וגם בעמוד הסניף עצמו. מחיקה כאן מסירה אותה משני
        המקומות.
      </p>
    </div>
  );
}
