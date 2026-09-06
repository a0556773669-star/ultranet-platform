"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/lib/toast";
import { bulkSetCountsToMainAction, setCountsToMainAction, type LegacyCollection } from "./actions";

export interface LegacyRow {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  on: boolean;
}

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * קבוצה אחת של שורות היסטוריות, עם שני כפתורי "כולם" ותיבה לכל שורה.
 *
 * הקבוצה סגורה כברירת מחדל ומראה בכותרת כמה כבר מסומנות מתוך כמה - כי ההחלטה הזו
 * מתקבלת פעם אחת, ואחריה המסך הוא רק אישור שהיא נשמרה.
 */
export function LegacyGroup({
  collection,
  title,
  note,
  rows,
}: {
  collection: LegacyCollection;
  title: string;
  note?: string;
  rows: LegacyRow[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  const onCount = rows.filter((r) => r.on).length;
  const onTotal = rows.filter((r) => r.on).reduce((s, r) => s + r.amount, 0);
  const allTotal = rows.reduce((s, r) => s + r.amount, 0);

  function run(fn: () => Promise<void>, message: string) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
        showSuccess(message);
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה");
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-right transition hover:bg-[#f8fafc]"
      >
        <span className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
          {title}
          <span className="text-[11px] font-bold text-muted">({rows.length})</span>
        </span>
        <span className="text-[12px] text-muted">
          מסומנות {onCount} · {money(onTotal)} מתוך {money(allTotal)}
        </span>
      </button>

      {open && (
        <div className="border-t border-card-border">
          {note && <p className="px-4 py-2 text-[11px] text-muted">{note}</p>}
          <div className="flex flex-wrap gap-2 border-b border-card-border px-4 py-2">
            <button
              type="button"
              disabled={isPending || rows.length === 0}
              onClick={() =>
                run(
                  () => bulkSetCountsToMainAction(collection, rows.map((r) => r.id), true),
                  "כל השורות סומנו כמתחשבנות בראשי",
                )
              }
              className="rounded-lg bg-teal px-3 py-1 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              סמן הכל לראשי
            </button>
            <button
              type="button"
              disabled={isPending || rows.length === 0}
              onClick={() =>
                run(
                  () => bulkSetCountsToMainAction(collection, rows.map((r) => r.id), false),
                  "כל השורות הוסרו מהראשי",
                )
              }
              className="rounded-lg border border-card-border bg-white px-3 py-1 text-[11px] font-bold text-ink transition hover:bg-[#f4f6f9] disabled:opacity-50"
            >
              הסר הכל מהראשי
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto px-4">
            {rows.length === 0 && <p className="py-5 text-center text-sm text-muted">אין שורות בקבוצה הזו</p>}
            {rows.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-center gap-2.5 border-b border-card-border py-2 text-[13px] last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={r.on}
                  disabled={isPending}
                  onChange={(e) =>
                    run(() => setCountsToMainAction(collection, r.id, e.target.checked), "עודכן")
                  }
                  className="h-4 w-4 shrink-0 accent-teal"
                />
                <span className="flex-1">
                  <span className="block font-bold text-ink">{r.title}</span>
                  <span className="block text-[11px] text-muted">{r.subtitle}</span>
                </span>
                <span className="min-w-[80px] text-left font-extrabold text-red-600">{money(r.amount)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}
