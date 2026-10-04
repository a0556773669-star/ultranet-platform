"use client";

import { useState } from "react";
import { AlertTriangle, Archive, Trash2, X } from "lucide-react";

/** המילה שיש להקליד כדי לאשר מחיקה בלתי הפיכה של תת-עץ שלם. */
export const CONFIRM_WORD = "מחיקה";

/**
 * דיאלוג מחיקה עם שתי דרגות מפורשות, במקום `confirm` שיודע רק כן/לא:
 *
 * - **ארכוב** - הפריט יורד מהלוח אך נשאר בהיסטוריה (מחיקה לוגית). זו האפשרות
 *   השמרנית, והיא מוצגת רק כשיש מה לשמור.
 * - **מחיקה לצמיתות** - הפריט וכל מה שתלוי בו נמחקים באמת. בלתי הפיך, ולכן
 *   כשהמחיקה גוררת איתה דברים נוספים היא דורשת הקלדת המילה "מחיקה".
 *
 * `lines` מציג בדיוק מה ייעלם, כדי שאף אחד לא ימחק רבעון שלם על סמך ניחוש.
 */
export function DeleteDialog({
  title,
  lines,
  warning,
  archiveLabel,
  archiveHint,
  permanentLabel = "מחיקה לצמיתות",
  requireTyping = false,
  isPending = false,
  onArchive,
  onPermanent,
  onClose,
}: {
  title: string;
  lines: string[];
  warning?: string;
  /** כשלא מועבר - אין מה לארכב, ונשארת רק המחיקה */
  archiveLabel?: string;
  archiveHint?: string;
  permanentLabel?: string;
  requireTyping?: boolean;
  isPending?: boolean;
  onArchive?: () => void;
  onPermanent: () => void;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState("");
  const canDelete = !requireTyping || typed.trim() === CONFIRM_WORD;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/35 p-3" role="dialog" aria-label={title}>
      <div className="w-full max-w-md rounded-card bg-white shadow-xl">
        <header className="flex items-start justify-between gap-2 border-b border-card-border px-4 py-3">
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {title}
          </h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="סגירה">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-col gap-3 px-4 py-3 text-sm">
          {lines.length > 0 && (
            <div>
              <div className="mb-1 text-xs font-bold text-muted">מה ייעלם:</div>
              <ul className="list-disc space-y-0.5 pr-5 text-xs text-ink">
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}

          {warning ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{warning}</div>
          ) : null}

          {archiveLabel ? (
            <div className="rounded-lg border border-card-border bg-[#f9fafb] px-3 py-2 text-xs text-muted">
              {archiveHint ?? "ארכוב משאיר הכל בהיסטוריה ורק מוריד מהלוח. מחיקה לצמיתות אינה הפיכה."}
            </div>
          ) : null}

          {requireTyping && (
            <label className="text-xs font-bold text-muted">
              כדי לאשר, הקלידו <span className="text-ink">{CONFIRM_WORD}</span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoFocus
                className="mt-1 w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-red-400 focus:bg-white focus:outline-none"
              />
            </label>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-card-border px-4 py-3">
          <button type="button" onClick={onClose} className="text-xs font-semibold text-muted hover:underline">
            ביטול
          </button>
          {archiveLabel && onArchive ? (
            <button
              type="button"
              onClick={onArchive}
              disabled={isPending}
              className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#f4f6f9] disabled:opacity-60"
            >
              <Archive className="h-3.5 w-3.5" />
              {archiveLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPermanent}
            disabled={isPending || !canDelete}
            className="flex items-center gap-1 rounded-[10px] bg-red-600 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isPending ? "מוחק..." : permanentLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
