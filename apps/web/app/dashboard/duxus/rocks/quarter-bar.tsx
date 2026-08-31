"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, CalendarPlus, Lock, Pencil } from "lucide-react";
import type { Quarter } from "@ultranet/shared-types";
import { setQuarterStatusAction, updateQuarterAction } from "./actions";
import { useToast } from "@/lib/toast";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

/**
 * שורת הרבעון בראש טאב הרבעון: בחירת רבעון (כולל ארכיון), שינוי שם/תאריכים,
 * ארכוב/החזרה לפעיל, ומעבר לאשף "פתיחת רבעון חדש".
 */
export function QuarterBar({ quarter, quarters }: { quarter: Quarter; quarters: Quarter[] }) {
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(quarter.label);
  const [startDate, setStartDate] = useState(quarter.startDate ?? "");
  const [endDate, setEndDate] = useState(quarter.endDate ?? "");

  const archived = quarter.status === "archived";

  function handleSave() {
    startTransition(async () => {
      const result = await updateQuarterAction(quarter.id, { label, startDate, endDate });
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess("הרבעון עודכן");
      setEditing(false);
      router.refresh();
    });
  }

  function handleToggleArchive() {
    const next = archived ? "active" : "archived";
    if (!archived && !confirm(`להעביר את "${quarter.label}" לארכיון? הרבעון יהפוך לקריאה בלבד.`)) return;
    startTransition(async () => {
      const result = await setQuarterStatusAction(quarter.id, next);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(next === "archived" ? "הרבעון הועבר לארכיון" : "הרבעון חזר לפעיל");
      router.refresh();
    });
  }

  return (
    <div className="card mb-4">
      {toastNode}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={quarter.id}
            onChange={(e) => router.push(`/dashboard/duxus/rocks?q=${encodeURIComponent(e.target.value)}`)}
            className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm font-bold text-ink focus:border-teal focus:bg-white focus:outline-none"
          >
            {quarters.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
                {q.status === "archived" ? " (ארכיון)" : ""}
              </option>
            ))}
            {quarters.every((q) => q.id !== quarter.id) && <option value={quarter.id}>{quarter.label}</option>}
          </select>

          {archived ? (
            <span className="flex items-center gap-1 rounded-full border border-card-border bg-[#f4f6f9] px-2.5 py-1 text-[11px] font-bold text-muted">
              <Lock className="h-3 w-3" />
              ארכיון · קריאה בלבד
            </span>
          ) : (
            <span className="rounded-full border border-teal bg-teal-bg px-2.5 py-1 text-[11px] font-bold text-teal-dark">פעיל</span>
          )}

          {quarter.startDate || quarter.endDate ? (
            <span className="text-[11px] text-muted">
              {quarter.startDate} {quarter.startDate && quarter.endDate ? "–" : ""} {quarter.endDate}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!archived && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#f4f6f9]"
            >
              <Pencil className="h-3.5 w-3.5" />
              שם הרבעון
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleArchive}
            disabled={isPending}
            className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#f4f6f9] disabled:opacity-60"
          >
            {archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
            {archived ? "החזרה לפעיל" : "ארכוב"}
          </button>
          <Link
            href={`/dashboard/duxus/rocks/rollover?q=${encodeURIComponent(quarter.id)}`}
            className="flex items-center gap-1 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            פתיחת רבעון חדש
          </Link>
        </div>
      </div>

      {editing && !archived && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-card-border p-3">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="שם הרבעון" className={FIELD} />
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1 text-xs text-muted">
              מתאריך
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={FIELD} />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted">
              עד תאריך
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={FIELD} />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
            >
              שמירה
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs font-semibold text-muted hover:underline">
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
