"use client";

import { useMemo, useState } from "react";

export type CompareSeries = { id: string; name: string; points: { month: string; value: number | null }[] };

/** סדר קבוע של גוונים (נבדק לעיוורון צבעים): הסדרה הראשונה, השנייה, השלישית — הצבע הולך עם הבחירה. */
const HUES = ["#0f8f78", "#d0660f", "#5b5bd6"];
const MAX = 3;

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${(y ?? "").slice(2)}`;
}

/**
 * השוואת סניפים בגרף (מסמך המשך 1, סעיף 47): 2–3 סניפים, נטו למחשב לפי **אותה נוסחה** של טבלת
 * המעקב. חודש בלי נתון (הסניף לא היה קיים / מכנה אפס) הוא **רווח בקו**, לא אפס; החודש הנוכחי
 * מסומן בעיגול חלול — "בתהליך". רק סניפים שהבעלים רואה ממילא (המסך כולו בעלים בלבד).
 */
export function BranchCompareChart({
  series,
  months,
  target,
  currentMonth,
}: {
  series: CompareSeries[];
  months: string[];
  target: number;
  currentMonth: string;
}) {
  const [selected, setSelected] = useState<string[]>(() => series.slice(0, 2).map((s) => s.id));
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const chosen = selected.map((id) => series.find((s) => s.id === id)).filter(Boolean) as CompareSeries[];
  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX ? prev : [...prev, id]));

  const W = 640;
  const H = 240;
  // מימין לשמאל, כמו טבלת המעקב: החודש הוותיק מימין, הציר האנכי בצד ימין.
  const pad = { top: 16, right: 48, bottom: 28, left: 16 };
  const values = chosen.flatMap((s) => s.points.map((p) => p.value).filter((v): v is number => v !== null));
  const { lo, hi } = useMemo(() => {
    const all = [...values, target, 0];
    const mn = Math.min(...all);
    const mx = Math.max(...all);
    const step = Math.max(50, Math.ceil((mx - mn) / 4 / 50) * 50);
    return { lo: Math.floor(mn / step) * step, hi: Math.ceil(mx / step) * step || step };
  }, [values, target]);
  const x = (i: number) => W - pad.right - (months.length <= 1 ? 0 : (i * (W - pad.left - pad.right)) / (months.length - 1));
  const y = (v: number) => pad.top + ((hi - v) * (H - pad.top - pad.bottom)) / (hi - lo || 1);
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);

  function segments(points: CompareSeries["points"]) {
    const segs: string[] = [];
    let cur: string[] = [];
    points.forEach((p, i) => {
      if (p.value === null) {
        if (cur.length > 1) segs.push(cur.join(" "));
        cur = [];
      } else cur.push(`${cur.length ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
    });
    if (cur.length > 1) segs.push(cur.join(" "));
    return segs;
  }

  return (
    <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-extrabold text-ink">השוואת סניפים — נטו למחשב</div>
        <button type="button" onClick={() => setShowTable((v) => !v)} className="text-xs font-bold text-teal hover:underline">
          {showTable ? "הצגת גרף" : "הצגת טבלה"}
        </button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {series.map((s) => {
          const idx = selected.indexOf(s.id);
          const on = idx >= 0;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              disabled={!on && selected.length >= MAX}
              className={`flex items-center gap-1.5 ${on ? "pill-active" : "pill-inactive"} disabled:opacity-40`}
            >
              {on && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: HUES[idx] }} />}
              {s.name}
            </button>
          );
        })}
      </div>

      {chosen.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted">בחרו עד שלושה סניפים להשוואה</div>
      ) : showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] tabular-nums">
            <thead className="text-muted">
              <tr>
                <th className="px-2 py-1 text-right">סניף</th>
                {months.map((m) => (
                  <th key={m} className="px-2 py-1 text-right">
                    {monthLabel(m)}
                    {m === currentMonth ? "*" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chosen.map((s) => (
                <tr key={s.id} className="border-t border-card-border">
                  <td className="px-2 py-1 font-bold text-ink">{s.name}</td>
                  {s.points.map((p) => (
                    <td key={p.month} className="px-2 py-1 text-ink">
                      {p.value === null ? <span className="text-muted">—</span> : Math.round(p.value).toLocaleString("he-IL")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="גרף נטו למחשב לפי חודש" onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="#e7ebf1" strokeWidth={1} />
                <text x={W - pad.right + 6} y={y(t) + 4} textAnchor="start" fontSize={10} fill="#5a6a7e">
                  {Math.round(t)}
                </text>
              </g>
            ))}
            <line x1={pad.left} x2={W - pad.right} y1={y(target)} y2={y(target)} stroke="#5a6a7e" strokeWidth={1.5} strokeDasharray="5 4" />
            <text x={pad.left + 34} y={y(target) - 5} textAnchor="middle" fontSize={10} fill="#5a6a7e">
              {`יעד ${target}`}
            </text>
            {months.map((m, i) => (
              <text key={m} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#5a6a7e">
                {monthLabel(m)}
              </text>
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={H - pad.bottom} stroke="#c9d2de" strokeWidth={1} />}
            {chosen.map((s, si) => (
              <g key={s.id}>
                {segments(s.points).map((d, k) => (
                  <path key={k} d={d} fill="none" stroke={HUES[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ))}
                {s.points.map((p, i) =>
                  p.value === null ? null : (
                    <circle
                      key={p.month}
                      cx={x(i)}
                      cy={y(p.value)}
                      r={p.month === currentMonth ? 4 : 3}
                      fill={p.month === currentMonth ? "#ffffff" : HUES[si]}
                      stroke={p.month === currentMonth ? HUES[si] : "#ffffff"}
                      strokeWidth={p.month === currentMonth ? 2 : 1.5}
                    />
                  ),
                )}
              </g>
            ))}
            {months.map((m, i) => (
              <rect
                key={m}
                x={x(i) - (W - pad.left - pad.right) / Math.max(1, months.length - 1) / 2}
                y={pad.top}
                width={(W - pad.left - pad.right) / Math.max(1, months.length - 1)}
                height={H - pad.top - pad.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            ))}
          </svg>
          {hover !== null && (
            <div className="pointer-events-none absolute top-1 rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-[11px] shadow-card" style={{ left: 8 }}>
              <div className="mb-0.5 font-bold text-ink">
                {monthLabel(months[hover]!)}
                {months[hover] === currentMonth ? " · בתהליך" : ""}
              </div>
              {chosen.map((s, si) => {
                const v = s.points[hover]?.value ?? null;
                return (
                  <div key={s.id} className="flex items-center gap-1.5 text-ink">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: HUES[si] }} />
                    {s.name}: {v === null ? <span className="text-muted">אין נתון</span> : `${Math.round(v).toLocaleString("he-IL")} ₪`}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted">
        אותה נוסחה של טבלת המעקב (נטו בלי מע&quot;מ ÷ מחשבים שקולים). חודש בלי נתון מוצג כרווח בקו, לא כאפס; עיגול חלול = החודש
        הנוכחי, בתהליך.
      </p>
    </div>
  );
}
