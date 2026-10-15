"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

/**
 * בחירת עמודות בטבלה (אפיון שדרוג v2, פריט 33) — העדפת תצוגה אישית בדפדפן הזה בלבד.
 *
 * - שום דבר לא נשמר במסד הנתונים ושום שדה לא נמחק; רק מסתירים עמודה שכבר מוצגת.
 * - הטבלה מעבירה ל-`ColumnsMenu` רק עמודות שהיא כבר מציגה למשתמש הזה (אחרי בדיקות ההרשאה
 *   שלה), ולכן אי אפשר "לחשוף" כאן עמודה שאינה מורשית. עמודת השם/המזהה לא מועברת — תמיד גלויה.
 */

export type ColumnOption = { key: string; label: string };

const PREFIX = "ultranet-columns:";

export function useHiddenColumns(tableKey: string) {
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFIX + tableKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(parsed)) setHidden(parsed.filter((k): k is string => typeof k === "string"));
    } catch {
      /* אין גישה לאחסון — כל העמודות גלויות */
    }
  }, [tableKey]);

  const persist = useCallback(
    (next: string[]) => {
      setHidden(next);
      try {
        if (next.length) localStorage.setItem(PREFIX + tableKey, JSON.stringify(next));
        else localStorage.removeItem(PREFIX + tableKey);
      } catch {
        /* לא קריטי */
      }
    },
    [tableKey]
  );

  const toggle = useCallback(
    (key: string) => persist(hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]),
    [hidden, persist]
  );
  const reset = useCallback(() => persist([]), [persist]);
  const show = useCallback((key: string) => !hidden.includes(key), [hidden]);

  return { hidden, show, toggle, reset };
}

/** תפריט "עוד" קטן לטבלה, ובו בחירת העמודות. */
export function ColumnsMenu({
  columns,
  hidden,
  onToggle,
  onReset,
}: {
  columns: ColumnOption[];
  hidden: string[];
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (columns.length === 0) return null;
  const hiddenCount = columns.filter((c) => hidden.includes(c.key)).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="עוד"
        aria-expanded={open}
        title="עוד"
        className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2 py-1 text-xs font-bold text-muted hover:bg-[#f4f6f9] hover:text-ink"
      >
        <MoreHorizontal className="h-4 w-4" />
        {hiddenCount > 0 && <span className="text-[11px]">{`${hiddenCount} מוסתרות`}</span>}
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-52 rounded-lg border border-card-border bg-white p-2 text-right shadow-lg">
          <p className="px-1 pb-1 text-[11px] font-bold text-muted">עמודות</p>
          {columns.map((c) => (
            <label
              key={c.key}
              className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs font-semibold text-ink normal-case hover:bg-[#f4f6f9]"
            >
              <input
                type="checkbox"
                checked={!hidden.includes(c.key)}
                onChange={() => onToggle(c.key)}
                className="h-3.5 w-3.5 accent-teal"
              />
              {c.label}
            </label>
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="mt-1 w-full rounded-md px-1.5 py-1 text-right text-[11px] font-bold text-teal hover:bg-[#f4f6f9]"
            >
              הצג את כל העמודות
            </button>
          )}
          <p className="mt-1 border-t border-card-border px-1 pt-1 text-[10.5px] font-normal normal-case text-muted">
            העדפה אישית בדפדפן הזה בלבד.
          </p>
        </div>
      )}
    </div>
  );
}
