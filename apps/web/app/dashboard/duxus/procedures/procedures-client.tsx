"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { NotebookText, Paperclip, Search } from "lucide-react";
import type { Procedure, ProcedureStatus } from "@ultranet/shared-types";
import { PROCEDURE_STATUS_LABEL } from "./procedure-form";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-xs focus:border-teal focus:bg-white focus:outline-none";

const STATUS_CLASS: Record<ProcedureStatus, string> = {
  draft: "border-card-border bg-[#f4f6f9] text-muted",
  active: "border-emerald-300 bg-emerald-50 text-emerald-700",
  superseded: "border-amber-300 bg-amber-50 text-amber-700",
  archived: "border-card-border bg-[#f4f6f9] text-muted",
};

/**
 * מאגר הנהלים (סעיף 12): קטגוריות, גרסאות, מצבים וחיפוש לפי שם, קטגוריה וטקסט
 * תיאורי. ברירת המחדל מסתירה נהלים בארכיון - הם קיימים, אבל לא מפריעים ביומיום.
 */
export function ProceduresClient({ procedures }: { procedures: Procedure[] }) {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<"" | ProcedureStatus>("");
  const [showArchived, setShowArchived] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(procedures.map((p) => p.category ?? "").filter(Boolean))).sort(),
    [procedures]
  );

  const shown = useMemo(() => {
    const q = text.trim();
    return procedures.filter((p) => {
      if (!showArchived && p.status === "archived" && status !== "archived") return false;
      if (status && p.status !== status) return false;
      if (category && (p.category ?? "") !== category) return false;
      if (q && !p.title.includes(q) && !(p.category ?? "").includes(q) && !(p.summary ?? "").includes(q)) return false;
      return true;
    });
  }, [procedures, text, category, status, showArchived]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="חיפוש לפי שם, קטגוריה או תיאור"
            className={`w-full pr-7 ${FIELD}`}
          />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="קטגוריה" className={FIELD}>
          <option value="">כל הקטגוריות</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | ProcedureStatus)}
          aria-label="מצב"
          className={FIELD}
        >
          <option value="">כל המצבים</option>
          {(Object.keys(PROCEDURE_STATUS_LABEL) as ProcedureStatus[]).map((s) => (
            <option key={s} value={s}>
              {PROCEDURE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 accent-[#1a8a76]"
          />
          הצגת ארכיון
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="card text-sm text-muted">
          {procedures.length === 0
            ? 'עדיין אין נהלים. לחצו על "נוהל חדש" כדי לכתוב נוהל ברור ראשון - למשל נוהל גבייה, ניהול השכרות או קליטת סניף חדש.'
            : "אין נהלים שמתאימים לחיפוש."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/duxus/procedures/${p.id}`}
              className="card flex flex-col gap-2 transition hover:shadow-lg"
            >
              <div className="flex flex-wrap items-center gap-2 text-teal">
                <NotebookText className="h-5 w-5" />
                {p.category ? (
                  <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">{p.category}</span>
                ) : null}
                <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[p.status ?? "draft"]}`}>
                  {PROCEDURE_STATUS_LABEL[p.status ?? "draft"]}
                </span>
                {p.attachmentName ? <Paperclip className="h-3.5 w-3.5 text-muted" /> : null}
              </div>
              <div className="text-sm font-bold text-ink">{p.title}</div>
              {p.summary ? <div className="text-xs text-muted">{p.summary}</div> : null}
              <div className="mt-auto text-[11px] text-muted">
                גרסה {p.version}
                {p.ownerName ? ` · ${p.ownerName}` : ""}
                {p.updatedAt ? ` · עודכן ${new Date(p.updatedAt).toLocaleDateString("he-IL")}` : ""}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
