"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import type { MonthFlow } from "@/lib/computer-room-accounting";
import { monthLabel } from "@/lib/branch-income-excel";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const SERIES = [
  { key: "income", label: "הכנסות", color: "#10b981" },
  { key: "expense", label: "הוצאות", color: "#ef4444" },
  { key: "profit", label: "רווח", color: "#0f766e" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

const RANGES = [6, 12, 24];

const PLOT_HEIGHT = 108;

interface Point extends MonthFlow {
  profit: number;
}

/**
 * גרף קטן של החודשים האחרונים — הוצאות מול הכנסות, חודש-חודש.
 *
 * מכוון שהוא לא מעל שליש מסך: הוא עונה על שאלה אחת ("החודש האחרון חזק או חלש ביחס למה
 * שהיה") ולא מחליף את הפירוט שמתחתיו. עלות ההקמה לא נכנסת אליו בכוונה — היא נקודה אחת
 * בזמן שהייתה מוחצת את כל שאר העמודים לגובה אפס.
 */
export function MonthlyFlowChart({ flow }: { flow: MonthFlow[] }) {
  const [size, setSize] = useState(12);
  const [end, setEnd] = useState(flow.length);
  const [hidden, setHidden] = useState<SeriesKey[]>(["profit"]);

  if (flow.length === 0) {
    return (
      <div className="rounded-card border border-card-border bg-white p-4 text-center text-xs text-muted shadow-card">
        אין עדיין נתונים חודשיים להצגה בגרף
      </div>
    );
  }

  const endIdx = Math.min(Math.max(end, Math.min(size, flow.length)), flow.length);
  const startIdx = Math.max(0, endIdx - size);
  const points: Point[] = flow.slice(startIdx, endIdx).map((f) => ({ ...f, profit: f.income - f.expense }));
  const visible = SERIES.filter((s) => !hidden.includes(s.key));

  const values = points.flatMap((p) => visible.map((s) => p[s.key]));
  const maxPos = Math.max(0, ...values);
  const minNeg = Math.min(0, ...values);
  const span = maxPos + Math.abs(minNeg) || 1;
  const posHeight = Math.round((maxPos / span) * PLOT_HEIGHT);
  const negHeight = PLOT_HEIGHT - posHeight;

  const barHeight = (value: number, region: "pos" | "neg") => {
    if (region === "pos") {
      if (value <= 0 || maxPos <= 0) return 0;
      return Math.max(2, Math.round((value / maxPos) * posHeight));
    }
    if (value >= 0 || minNeg >= 0) return 0;
    return Math.max(2, Math.round((Math.abs(value) / Math.abs(minNeg)) * negHeight));
  };

  const totals = points.reduce(
    (acc, p) => ({ income: acc.income + p.income, expense: acc.expense + p.expense }),
    { income: 0, expense: 0 },
  );

  const labelEvery = Math.ceil(points.length / 12);

  const toggle = (key: SeriesKey) =>
    setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const first = points[0];
  const last = points[points.length - 1];
  const rangeLabel = first && last ? `${monthLabel(first.month)} – ${monthLabel(last.month)}` : "";

  return (
    <div className="rounded-card border border-card-border bg-white p-3.5 shadow-card">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
          <TrendingUp className="h-4 w-4" />
          הוצאות מול הכנסות לפי חודש
        </h2>

        <div className="flex flex-wrap items-center gap-1.5">
          {SERIES.map((s) => {
            const on = !hidden.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggle(s.key)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold transition ${
                  on ? "border-card-border bg-[#f4f6f9] text-ink" : "border-card-border bg-white text-muted opacity-60"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ background: on ? s.color : "#cbd5e1" }} />
                {s.label}
              </button>
            );
          })}
          <select
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="rounded-full border border-card-border bg-white px-2 py-0.5 text-[10.5px] font-bold text-ink focus:border-teal focus:outline-none"
          >
            {RANGES.map((r) => (
              <option key={r} value={r}>
                {r} חודשים
              </option>
            ))}
          </select>
          {/* הניווט נקרא משמאל לימין יחד עם ציר הזמן שמתחתיו: חץ שמאלה = אחורה בזמן. */}
          <div dir="ltr" className="flex items-center gap-1">
            <button
              type="button"
              title={`${size} חודשים אחורה`}
              disabled={startIdx === 0}
              onClick={() => setEnd(Math.max(Math.min(size, flow.length), endIdx - size))}
              className="rounded-lg border border-card-border p-1 text-muted transition hover:text-teal disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span dir="ltr" className="min-w-[92px] text-center text-[10.5px] font-bold tabular-nums text-muted">
              {rangeLabel}
            </span>
            <button
              type="button"
              title={`${size} חודשים קדימה`}
              disabled={endIdx >= flow.length}
              onClick={() => setEnd(Math.min(flow.length, endIdx + size))}
              className="rounded-lg border border-card-border p-1 text-muted transition hover:text-teal disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ציר הזמן תמיד משמאל לימין — הישן בשמאל והחדש בימין — גם במסך RTL. */}
      <div dir="ltr">
        <div className="relative flex items-stretch gap-1 sm:gap-1.5" style={{ height: PLOT_HEIGHT }}>
          {/* קו האפס נמתח על כל הרוחב ולא נקטע בין העמודים - כשהוא היה מצויר בתוך כל עמוד
              בנפרד הוא נראה כמו קו מקווקו ולא כמו ציר. */}
          <div className="absolute inset-x-0 h-px bg-card-border" style={{ top: posHeight }} />
          {points.map((p) => (
            <div
              key={p.month}
              className="relative flex flex-1 flex-col"
              title={`${monthLabel(p.month)} · הכנסות ${money(p.income)} · הוצאות ${money(p.expense)} · רווח ${money(p.profit)}`}
            >
              <div className="flex items-end justify-center gap-[3px]" style={{ height: posHeight }}>
                {visible.map((s) => (
                  <div
                    key={s.key}
                    className="w-full max-w-[11px] rounded-t-[3px]"
                    style={{ height: barHeight(p[s.key], "pos"), background: s.color }}
                  />
                ))}
              </div>
              {negHeight > 0 && (
                <div className="flex items-start justify-center gap-[3px]" style={{ height: negHeight }}>
                  {visible.map((s) => (
                    <div
                      key={s.key}
                      className="w-full max-w-[11px] rounded-b-[3px]"
                      style={{ height: barHeight(p[s.key], "neg"), background: s.color }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1 overflow-hidden sm:gap-1.5">
          {points.map((p, idx) => (
            <span
              key={p.month}
              className={`min-w-0 flex-1 whitespace-nowrap text-[9px] font-semibold tabular-nums text-muted ${
                idx === 0 ? "text-left" : idx === points.length - 1 ? "text-right" : "text-center"
              }`}
            >
              {/* מסמנים חודש אחד מכל כמה - שתים-עשרה תוויות זה מה שנכנס במסך רחב בלי לדרוס
                  אחת את השנייה, ובמסך צר שליש מזה. השאר נקראות בלחיצה/עכבר על העמוד עצמו. */}
              {idx % labelEvery === 0 && (
                <span className={idx % (labelEvery * 3) === 0 ? "" : "hidden sm:inline"}>{monthLabel(p.month)}</span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-card-border pt-2 text-[11px]">
        <span className="text-muted">
          בטווח המוצג: הכנסות <b className="text-emerald-600">{money(totals.income)}</b> · הוצאות{" "}
          <b className="text-red-600">{money(totals.expense)}</b>
        </span>
        <span className="text-muted">
          רווח תפעולי:{" "}
          <b className={totals.income - totals.expense >= 0 ? "text-teal-dark" : "text-red-600"}>
            {money(totals.income - totals.expense)}
          </b>
        </span>
      </div>
    </div>
  );
}
