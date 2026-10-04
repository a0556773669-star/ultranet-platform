"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Check, RotateCcw, X } from "lucide-react";
import { BranchSwitcher } from "../branch-switcher";
import { getStockSnapshotAction, setStockMarkAction, type StockSnapshot, type StockRow } from "../actions";
import { formatPeriod } from "@/lib/operations-shared";
import type { OpsStockMark } from "@ultranet/shared-types";

export function StockClient({ snapshot }: { snapshot: StockSnapshot }) {
  const [state, setState] = useState(snapshot);
  const [error, setError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const { rows, branchId } = state;
  const missing = rows.filter((r) => r.status === "missing").length;
  const pending = rows.filter((r) => r.status === null).length;

  function switchBranch(next: string) {
    startTransition(async () => {
      setState(await getStockSnapshotAction(next));
    });
  }

  function mark(row: StockRow, status: OpsStockMark | null) {
    if (!branchId) return;
    setError(null);
    const note = status === "missing" ? noteDraft[row.itemId] ?? row.note : "";
    // עדכון אופטימי: הסימון הוא לחיצה אחת ורצוי שיגיב מיד, והפעולה בשרת רק מאשרת.
    setState((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.itemId === row.itemId ? { ...r, status, note } : r)),
    }));
    startTransition(async () => {
      const result = await setStockMarkAction(branchId, row.itemId, status, note);
      if (!result.ok) {
        setError(result.message);
        setState(await getStockSnapshotAction(branchId));
      }
    });
  }

  function saveNote(row: StockRow) {
    if (!branchId || row.status !== "missing") return;
    const note = noteDraft[row.itemId] ?? "";
    startTransition(async () => {
      const result = await setStockMarkAction(branchId, row.itemId, "missing", note);
      if (!result.ok) setError(result.message);
    });
  }

  if (state.branches.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
        {"אין סניף חדרי מחשבים משויך למשתמש הזה"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <BranchSwitcher branches={state.branches} value={branchId} onChange={switchBranch} />
        <span className="rounded-full bg-[#f4f6f9] px-3 py-1 text-xs font-bold text-muted">
          {formatPeriod(state.periodKey)}
        </span>
        {missing > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {missing} {"פריטים חסרים"}
          </span>
        )}
        {pending > 0 && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            {pending} {"טרם סומנו"}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
          {"לא הוגדרו פריטי מלאי לסניף הזה"}
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead className="bg-[#f4f6f9] text-muted">
              <tr>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">{"פריט"}</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">{"כמות נדרשת"}</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">{"סימון"}</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">{"הערה"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.itemId}
                  className={`border-t border-card-border transition ${
                    row.status === "missing" ? "bg-red-50" : row.status === "ok" ? "bg-emerald-50/50" : ""
                  }`}
                >
                  <td className="px-[11px] py-2 font-semibold text-ink">{row.name}</td>
                  <td className="px-[11px] py-2 text-muted">
                    {row.targetQty > 0 ? `${row.targetQty} ${row.unit || ""}`.trim() : "—"}
                  </td>
                  <td className="px-[11px] py-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => mark(row, "ok")}
                        disabled={isPending}
                        aria-label="יש במלאי"
                        className={
                          row.status === "ok"
                            ? "flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white"
                            : "flex h-8 w-8 items-center justify-center rounded-lg border border-card-border bg-white text-muted transition hover:border-emerald-400 hover:text-emerald-600"
                        }
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => mark(row, "missing")}
                        disabled={isPending}
                        aria-label="חסר"
                        className={
                          row.status === "missing"
                            ? "flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white"
                            : "flex h-8 w-8 items-center justify-center rounded-lg border border-card-border bg-white text-muted transition hover:border-red-400 hover:text-red-600"
                        }
                      >
                        <X className="h-4 w-4" />
                      </button>
                      {row.status !== null && (
                        <button
                          type="button"
                          onClick={() => mark(row, null)}
                          disabled={isPending}
                          aria-label="ביטול סימון"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-card-border bg-white text-muted transition hover:text-ink"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-[11px] py-2">
                    {row.status === "missing" ? (
                      <input
                        type="text"
                        value={noteDraft[row.itemId] ?? row.note}
                        onChange={(e) => setNoteDraft((prev) => ({ ...prev, [row.itemId]: e.target.value }))}
                        onBlur={() => saveNote(row)}
                        placeholder="מה בדיוק חסר?"
                        className="w-full rounded-lg border border-card-border bg-white px-2 py-1 text-[12px] focus:border-teal focus:outline-none"
                      />
                    ) : (
                      <span className="text-[11px] text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {state.alerts && <StockAlerts alerts={state.alerts} />}
    </div>
  );
}

/** סיכום לבעלים: מה חסר בכל סניף החודש, ומי עוד לא מילא. */
function StockAlerts({ alerts }: { alerts: NonNullable<StockSnapshot["alerts"]> }) {
  return (
    <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        <AlertTriangle className="h-4 w-4" />
        {"מצב הסניפים החודש"}
      </h3>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.branchId} className="flex flex-wrap items-center gap-2 border-b border-card-border py-2 text-[13px] last:border-b-0">
            <span className="font-semibold text-ink">{a.branchName}</span>
            {a.missing.length > 0 ? (
              <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
                {"חסר: "}
                {a.missing.join(", ")}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
                {"אין חוסרים"}
              </span>
            )}
            {a.pending > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                {a.pending} {"טרם סומנו"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
