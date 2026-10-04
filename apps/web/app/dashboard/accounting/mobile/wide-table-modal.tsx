"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Table2, X } from "lucide-react";

/**
 * הכפתור שפותח את טבלת ההעברות המלאה.
 *
 * הטבלה עצמה נבנית בשרת ומועברת כ-`children`: היא אותה טבלה שהייתה במסך עד היום, על כל
 * עמודותיה, ורק המקום שלה השתנה. כך אין שתי גרסאות של אותה טבלה שצריך לזכור לעדכן יחד.
 */
export function WideTableModal({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-sm font-bold text-ink transition hover:bg-[#f1f5f9]"
      >
        <Table2 className="h-4 w-4" />
        טבלה רחבה
      </button>

      {open && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-8"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[1200px] rounded-card bg-white p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
                <Table2 className="h-4 w-4" />
                {title}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="סגירה"
                className="text-muted transition hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
