"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Zap, Trophy, Flag, MapPin } from "lucide-react";
import type { BranchProgressRow, StageDef, StageState } from "@/lib/branch-progress";
import { setBranchStage } from "./actions";

type Summary = {
  total: number;
  overallPct: number;
  finished: number;
  perStage: (StageDef & { count: number })[];
  standing: { no: number; branches: string[] }[];
};

type Filter = "all" | "progress" | "done";

/** טבעת התקדמות ב-SVG. */
function Ring({ pct, size, stroke, children }: { pct: number; size: number; stroke: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, pct / 100)));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e0f0ed" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pct >= 100 ? "#0f6e56" : "#1a8a76"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

function stageTitle(stages: StageDef[], no: number) {
  return no === 8 ? "הגיעו ליעד" : (stages.find((s) => s.no === no)?.title ?? "");
}

export function ProgressBoard({
  rows,
  stages,
  target,
  summary,
}: {
  rows: BranchProgressRow[];
  stages: StageDef[];
  target: number;
  summary: Summary;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(
    () =>
      rows.filter((r) => (filter === "all" ? true : filter === "done" ? r.currentStage === 8 : r.currentStage !== 8)),
    [rows, filter],
  );

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-card-border bg-white p-6 text-center text-sm text-muted shadow-card">
        אין כרגע סניפי השכרות פעילים.
      </p>
    );
  }

  const maxStanding = Math.max(1, ...summary.standing.map((s) => s.branches.length));

  return (
    <div className="flex flex-col gap-5">
      {/* ===== הרשת כולה ===== */}
      <section className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <div className="flex flex-col gap-6 bg-gradient-to-l from-teal-bg/70 via-white to-white p-5 md:flex-row md:items-center">
          <div className="flex items-center gap-5">
            <Ring pct={summary.overallPct} size={132} stroke={12}>
              <span className="text-[30px] font-extrabold leading-none text-ink">{summary.overallPct}%</span>
              <span className="mt-1 text-[11px] font-semibold text-muted">מהדרך</span>
            </Ring>
            <div className="flex flex-col gap-2">
              <div className="text-[15px] font-extrabold text-ink">כל הרשת יחד</div>
              <div className="flex items-center gap-2 text-sm text-ink">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span>
                  <b className="text-[18px]">{summary.finished}</b> מתוך <b>{summary.total}</b> סניפים בשלב 7
                </span>
              </div>
              <div className="h-2.5 w-56 overflow-hidden rounded-full bg-teal-bg">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-teal-dark to-teal-light transition-all duration-700"
                  style={{ width: `${summary.total ? (summary.finished / summary.total) * 100 : 0}%` }}
                />
              </div>
              <div className="text-[11.5px] text-muted">
                יעד שלב 7: 150 ₪ נטו למחשב בחודש ({target.toLocaleString("he-IL")} ₪ כולל מע&quot;מ)
              </div>
            </div>
          </div>

          {/* משפך: כמה סניפים השלימו כל שלב */}
          <div className="flex-1">
            <div className="mb-2 text-[12px] font-bold text-muted">כמה סניפים השלימו כל שלב</div>
            <div className="flex flex-col gap-1.5">
              {summary.perStage.map((s) => {
                const pct = summary.total ? (s.count / summary.total) * 100 : 0;
                return (
                  <div key={s.no} className="flex items-center gap-2 text-[12px]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal text-[10.5px] font-bold text-white">
                      {s.no}
                    </span>
                    <span className="w-44 shrink-0 truncate text-ink">{s.title}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-page">
                      <div
                        className="h-full rounded-full bg-teal/80 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-left font-bold tabular-nums text-ink">
                      {s.count}/{summary.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* מסלול: איפה כל סניף עומד */}
        <div className="border-t border-card-border p-5">
          <div className="mb-3 text-[12px] font-bold text-muted">איפה הסניפים עומדים עכשיו</div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {summary.standing.map((s) => {
              const isGoal = s.no === 8;
              return (
                <div key={s.no} className="flex flex-col items-center gap-1.5">
                  <div className="flex h-20 w-full items-end justify-center rounded-lg bg-page px-2 pb-1">
                    <div
                      className={`w-full rounded-md transition-all duration-700 ${isGoal ? "bg-amber-400" : "bg-teal/70"}`}
                      style={{ height: `${(s.branches.length / maxStanding) * 100}%`, minHeight: s.branches.length ? 6 : 0 }}
                      title={s.branches.join(", ")}
                    />
                  </div>
                  <div className="text-[16px] font-extrabold leading-none text-ink">{s.branches.length}</div>
                  <div className="flex items-center gap-1 text-center text-[10.5px] leading-tight text-muted">
                    {isGoal ? <Flag className="h-3 w-3 text-amber-500" /> : <span className="font-bold">{s.no}</span>}
                    <span className="line-clamp-2">{isGoal ? "ביעד" : stageTitle(stages, s.no)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== סינון ===== */}
      <div className="flex flex-wrap items-center gap-1">
        {(
          [
            ["all", `הכל (${rows.length})`],
            ["progress", `בדרך (${rows.length - summary.finished})`],
            ["done", `ביעד (${summary.finished})`],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={filter === key ? "pill-active" : "pill-inactive"}
          >
            {label}
          </button>
        ))}
        <span className="mr-auto flex items-center gap-1 text-[11.5px] text-muted">
          <Zap className="h-3.5 w-3.5 text-amber-500" /> = מתעדכן אוטומטית · שאר השלבים — לחיצה מסמנת / מבטלת
        </span>
      </div>

      {/* ===== כרטיס לכל סניף ===== */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((row) => (
          <BranchCard key={row.branchId} row={row} stages={stages} />
        ))}
      </div>
    </div>
  );
}

function BranchCard({ row, stages }: { row: BranchProgressRow; stages: StageDef[] }) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const states: StageState[] = row.stages.map((s) => (s.no in optimistic ? { ...s, done: optimistic[s.no]! } : s));
  const doneCount = states.filter((s) => s.done).length;
  const pct = Math.round((doneCount / stages.length) * 100);
  const current = states.find((s) => !s.done)?.no ?? 8;
  const finished = current === 8;

  const toggle = (no: number, next: boolean) => {
    setError(null);
    setOptimistic((o) => ({ ...o, [no]: next }));
    startTransition(async () => {
      try {
        await setBranchStage(row.branchId, String(no), next);
      } catch (e) {
        setOptimistic((o) => ({ ...o, [no]: !next }));
        setError(e instanceof Error ? e.message : "השמירה נכשלה");
      }
    });
  };

  return (
    <div
      className={`flex flex-col gap-4 rounded-card border bg-white p-4 shadow-card transition ${
        finished ? "border-amber-300 ring-1 ring-amber-200" : "border-card-border"
      } ${pending ? "opacity-80" : ""}`}
    >
      <div className="flex items-center gap-3">
        <Ring pct={pct} size={62} stroke={7}>
          {finished ? (
            <Trophy className="h-5 w-5 text-amber-500" />
          ) : (
            <span className="text-[14px] font-extrabold text-ink">{doneCount}/7</span>
          )}
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[16px] font-extrabold text-ink">{row.name}</span>
            {row.isMine && <span className="text-[10px] font-bold text-teal-dark">(שלי)</span>}
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
            {row.location && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {row.location}
              </span>
            )}
            {row.partnerName && <span>שותף: {row.partnerName}</span>}
            <span>{row.laptopCount} מחשבים</span>
          </div>
          <div
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
              finished ? "bg-amber-100 text-amber-700" : "bg-teal-bg text-teal-dark"
            }`}
          >
            {finished ? "הגיע ליעד!" : `שלב נוכחי: ${current} — ${stages.find((s) => s.no === current)?.title}`}
          </div>
        </div>
      </div>

      {/* מסלול השלבים */}
      <ol className="flex flex-col">
        {stages.map((def, i) => {
          const st = states[i]!;
          const isCurrent = st.no === current;
          const last = i === stages.length - 1;
          const clickable = !def.auto && !pending;
          return (
            <li key={def.no} className="relative flex gap-3">
              {!last && (
                <span
                  className={`absolute right-[13px] top-7 h-[calc(100%-20px)] w-0.5 ${st.done ? "bg-teal" : "bg-card-border"}`}
                />
              )}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => toggle(st.no, !st.done)}
                title={def.auto ? "מתעדכן אוטומטית מהנתונים" : st.done ? "לחיצה לביטול" : "לחיצה לסימון"}
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[12px] font-bold transition ${
                  st.done
                    ? "border-teal bg-teal text-white"
                    : isCurrent
                      ? "animate-pulse border-amber-400 bg-amber-50 text-amber-700"
                      : "border-card-border bg-white text-muted"
                } ${clickable ? "cursor-pointer hover:scale-110 hover:shadow-primary" : "cursor-default"}`}
              >
                {st.done ? <Check className="h-4 w-4" strokeWidth={3} /> : def.no}
              </button>
              <div className={`min-w-0 flex-1 ${last ? "" : "pb-3"}`}>
                <div className="flex items-center gap-1 pt-1">
                  <span
                    className={`text-[13px] ${st.done ? "font-semibold text-ink" : isCurrent ? "font-bold text-ink" : "text-muted"}`}
                  >
                    {def.title}
                  </span>
                  {def.auto && <Zap className="h-3 w-3 text-amber-500" />}
                </div>
                {(st.hint || st.at) && (
                  <div className="text-[11px] text-muted">
                    {st.hint ?? (st.at ? `סומן ${st.at.slice(0, 10).split("-").reverse().join("/")}` : "")}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {error && <div className="rounded-md bg-red-50 px-2 py-1 text-[12px] text-red-700">{error}</div>}
    </div>
  );
}
