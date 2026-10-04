"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, TrendingUp, Laptop as LaptopIcon, Palette } from "lucide-react";
import type { LaptopCostItem, LaptopCostRate } from "@ultranet/shared-types";
import { useToast } from "@/lib/toast";
import { DEFAULT_COST_ITEM_LABELS, LAPTOP_COST_KIND_LABELS, sumCostItems } from "@/lib/laptop-costs";
import { deleteLaptopCostRateAction, saveLaptopCostRateAction } from "./actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

type Row = { label: string; amount: string };

/**
 * כרטיס של סוג מחשב אחד (רגיל / גרפיקה): המחיר שבתוקף היום עם הפירוט שלו, "עדכון מחיר" שפותח
 * גרסה חדשה מתאריך, והיסטוריית הגרסאות. בדיוק כמו עלות הקמה של חדר מחשבים — סכום אחד שמורכב
 * מכמה סעיפים (מחשב, תיק, סטיק, מטען...), והסכום תמיד מחושב מהסעיפים.
 */
export function CostRateCard({
  kind,
  versions,
  current,
  laptopCount,
}: {
  kind: LaptopCostRate["kind"];
  /** מהחדשה לישנה */
  versions: LaptopCostRate[];
  current: LaptopCostRate | null;
  laptopCount: number;
}) {
  const [editing, setEditing] = useState(versions.length === 0);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>(
    (current?.items.length ? current.items : DEFAULT_COST_ITEM_LABELS.map((label) => ({ label, amount: 0 }))).map(
      (i: LaptopCostItem) => ({ label: i.label, amount: i.amount ? String(i.amount) : "" }),
    ),
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const Icon = kind === "graphics" ? Palette : LaptopIcon;

  const total = sumCostItems(rows.map((r) => ({ amount: Number(r.amount) || 0 })));

  function save() {
    startTransition(async () => {
      const r = await saveLaptopCostRateAction({
        kind,
        from,
        items: rows.map((row) => ({ label: row.label, amount: Number(row.amount) || 0 })),
      });
      if (r.ok) {
        showSuccess(r.message);
        setEditing(false);
        router.refresh();
      } else showError(r.message);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-card border border-card-border bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <Icon className="h-4 w-4" />
          עלות {LAPTOP_COST_KIND_LABELS[kind]}
        </h2>
        <span className="text-[11px] text-muted">{laptopCount} מחשבים מהסוג הזה</span>
      </div>

      {current ? (
        <div className="rounded-lg border border-card-border bg-[#f9fafb] p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold text-muted">בתוקף מ-{current.from}</span>
            <span className="text-xl font-black text-ink">{money(current.total)}</span>
          </div>
          <ul className="mt-2 flex flex-col gap-0.5 text-[12.5px]">
            {current.items.map((i, idx) => (
              <li key={idx} className="flex justify-between text-muted">
                <span>{i.label}</span>
                <span className="tabular-nums text-ink">{money(i.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          עוד לא הוגדרה עלות — עד שתוגדר, מחשבים מהסוג הזה לא נזקפים להשקעה בסניף.
        </p>
      )}

      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 self-start rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-teal-dark hover:bg-[#f4f6f9]"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          {current ? "עדכון מחיר" : "הגדרת עלות"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-teal/40 bg-teal-bg/30 p-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted">
              {current ? "המחיר החדש חל על מחשבים שנוספו מהתאריך:" : "חל על מחשבים שנוספו מהתאריך:"}
            </span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm"
            />
            {!current && (
              <span className="text-[11px] text-muted">
                הגרסה הראשונה חלה גם על כל המחשבים שנוספו לפני התאריך הזה.
              </span>
            )}
          </label>
          <div className="flex flex-col gap-1.5">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_110px_auto] items-center gap-1.5">
                <input
                  value={row.label}
                  onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, label: e.target.value } : r)))}
                  placeholder="סעיף (למשל תיק מחשב)"
                  className="rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={row.amount}
                  onChange={(e) => setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, amount: e.target.value } : r)))}
                  placeholder="₪"
                  className="rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((_, i) => i !== idx))}
                  className="text-muted hover:text-red-600"
                  aria-label="הסרת שורה"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRows((rs) => [...rs, { label: "", amount: "" }])}
              className="flex items-center gap-1 self-start text-xs font-bold text-teal-dark"
            >
              <Plus className="h-3.5 w-3.5" />
              הוספת סעיף
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-card-border pt-2">
            <span className="text-xs font-bold text-muted">{'סה"כ למחשב'}</span>
            <span className="text-lg font-black text-ink">{money(total)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? "שומר..." : "שמירה"}
            </button>
            {versions.length > 0 && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-[#f4f6f9]"
              >
                ביטול
              </button>
            )}
          </div>
        </div>
      )}

      {versions.length > 1 && (
        <details className="text-[12px]">
          <summary className="cursor-pointer font-bold text-muted">היסטוריית מחירים ({versions.length})</summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-md bg-[#f9fafb] px-2.5 py-1">
                <span className="text-muted">מ-{v.from}</span>
                <span className="flex items-center gap-2">
                  <b className="tabular-nums text-ink">{money(v.total)}</b>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm("למחוק את הגרסה? מחשבים שנוספו בתקופה שלה יחזרו למחיר שלפניה.")) return;
                      startTransition(async () => {
                        const r = await deleteLaptopCostRateAction(v.id);
                        if (r.ok) {
                          showSuccess(r.message);
                          router.refresh();
                        } else showError(r.message);
                      });
                    }}
                    className="text-muted hover:text-red-600"
                    aria-label="מחיקת גרסה"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {toastNode}
    </section>
  );
}
