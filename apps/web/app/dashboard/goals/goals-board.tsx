"use client";

import { useState, useTransition } from "react";
import type { BranchType, GoalLinkKind } from "@ultranet/shared-types";
import { ArrowDownRight, ArrowRight, ArrowUpLeft } from "lucide-react";
import type { GoalRow, GoalsBoard as Board } from "@/lib/goals";
import { updateGoalAction } from "./actions";

const BRANCH_TYPE_LABEL: Record<BranchType, string> = {
  rentals: "השכרות",
  computers: "חדרי מחשבים",
  coworking: "משרד שיתופי",
};

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

type Status = "good" | "close" | "behind" | "none" | "inactive";

/** ממוצע שלושת החודשים המלאים האחרונים מול היעד החודשי. */
function statusOf(row: GoalRow): Status {
  if (row.goal.linkKind === "inactive") return "inactive";
  if (row.actual == null || !row.goal.turnover) return "none";
  const ratio = row.actual / row.goal.turnover;
  if (ratio >= 1) return "good";
  if (ratio >= 0.8) return "close";
  return "behind";
}

const STATUS_STYLE: Record<Status, { bar: string; text: string; label: string }> = {
  good: { bar: "bg-teal", text: "text-teal-dark", label: "עומד ביעד" },
  close: { bar: "bg-amber-500", text: "text-amber-700", label: "קרוב" },
  behind: { bar: "bg-red-500", text: "text-red-600", label: "מאחור" },
  none: { bar: "bg-slate-300", text: "text-muted", label: "אין נתון באתר" },
  inactive: { bar: "bg-slate-300", text: "text-muted", label: "לא פעיל כרגע" },
};

function linkValue(row: GoalRow) {
  return row.goal.linkKind === "branch" && row.goal.branchId ? `branch:${row.goal.branchId}` : row.goal.linkKind;
}

/** חץ מגמה: שלושת החודשים האחרונים מול שלושת החודשים שלפניהם. */
function TrendCell({ row }: { row: GoalRow }) {
  if (row.goal.linkKind === "inactive" || row.actual == null) return <span className="text-muted">—</span>;
  if (!row.trend) return <span className="text-[11.5px] text-muted">חדש — אין עם מה להשוות</span>;
  const pct = row.trendPct != null ? `${row.trendPct > 0 ? "+" : ""}${Math.round(row.trendPct)}%` : "";
  if (row.trend === "up")
    return (
      <span className="inline-flex items-center gap-1 font-extrabold text-teal-dark" title="עלייה מול 3 החודשים שלפני">
        <ArrowUpLeft className="h-5 w-5" />
        עלייה {pct}
      </span>
    );
  if (row.trend === "down")
    return (
      <span className="inline-flex items-center gap-1 font-extrabold text-red-600" title="ירידה מול 3 החודשים שלפני">
        <ArrowDownRight className="h-5 w-5" />
        ירידה {pct}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 font-bold text-muted" title="בלי שינוי משמעותי">
      <ArrowRight className="h-5 w-5 rotate-180" />
      יציב {pct}
    </span>
  );
}

function GoalLine({ row, board }: { row: GoalRow; board: Board }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const status = statusOf(row);
  const style = STATUS_STYLE[status];
  const pct = row.actual != null && row.goal.turnover ? (row.actual / row.goal.turnover) * 100 : 0;

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "השמירה נכשלה");
      }
    });

  const onLink = (value: string) => {
    const [kind, branchId] = value.split(":") as [GoalLinkKind, string | undefined];
    run(() => updateGoalAction(row.goal.id, { linkKind: kind, branchId }));
  };

  const onTarget = (raw: string) => {
    setEditing(false);
    const n = Number(raw.replace(/[,₪\s]/g, ""));
    if (!Number.isFinite(n) || n === row.goal.turnover) return;
    run(() => updateGoalAction(row.goal.id, { turnover: n }));
  };

  return (
    <tr
      className={`border-t border-card-border align-middle ${pending ? "opacity-50" : ""} ${
        status === "inactive" ? "bg-[#f7f9fb] text-muted opacity-70" : ""
      }`}
    >
      <td className="px-3 py-2.5">
        <div className="text-[13px] font-bold text-ink">{row.goal.label}</div>
        {error && <div className="text-[11px] font-semibold text-red-600">{error}</div>}
      </td>
      <td className="px-3 py-2.5">
        <select
          value={linkValue(row)}
          onChange={(e) => onLink(e.target.value)}
          disabled={pending}
          className="w-full max-w-[220px] rounded-lg border border-card-border bg-white px-2 py-1 text-[12px]"
        >
          <option value="none">— לא נמדד —</option>
          <option value="coworking_all">כל סניפי המשרד השיתופי</option>
          <option value="inactive">לא פעיל כרגע (לא נכנס לסיכום)</option>
          <option value="new_rentals">סניפי ניידים חדשים (כל מה שאין לו שורה)</option>
          <option value="computer_sales">הכנסות &quot;מכירת מחשבים&quot; בכספים</option>
          <option value="laptop_sales">מכירות מחשבים מסניפי הניידים</option>
          {(["rentals", "computers", "coworking"] as const).map((type) => (
            <optgroup key={type} label={BRANCH_TYPE_LABEL[type]}>
              {board.branches
                .filter((b) => b.type === type)
                .map((b) => (
                  <option key={b.id} value={`branch:${b.id}`}>
                    {b.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        {row.goal.linkKind === "new_rentals" && (
          <div className="mt-1 max-w-[220px] text-[11px] text-muted">{row.sourceLabel}</div>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[13px] font-bold text-ink">
        {editing ? (
          <input
            autoFocus
            defaultValue={row.goal.turnover}
            inputMode="numeric"
            onBlur={(e) => onTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-24 rounded-lg border border-teal px-2 py-1 text-[12px]"
          />
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="hover:underline" title="לחץ לעריכת היעד">
            {money(row.goal.turnover)}
          </button>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[13px] font-extrabold text-ink">
        {row.actual == null ? <span className="text-muted">—</span> : money(row.actual)}
        {row.actual != null && row.monthsCounted < 3 && (
          <div className="text-[10.5px] font-semibold text-muted">
            {row.monthsCounted === 1 ? "חודש מלא אחד" : `${row.monthsCounted} חודשים מלאים`}
          </div>
        )}
      </td>
      <td className="min-w-[170px] px-3 py-2.5">
        {row.actual == null ? (
          <span className="text-[11.5px] text-muted">{style.label}</span>
        ) : (
          <div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-[#eef1f5]">
              <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className={`mt-0.5 flex justify-between text-[11px] font-bold ${style.text}`}>
              <span>{Math.round(pct)}%</span>
              <span>{style.label}</span>
            </div>
          </div>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[12px]">
        <TrendCell row={row} />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-muted">
        {row.computersActual != null || row.goal.computersTarget != null ? (
          <span>
            <b className="text-ink">{row.computersActual ?? row.goal.computersNow ?? "—"}</b>
            {row.goal.computersTarget != null && <> / יעד {row.goal.computersTarget}</>}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-muted">
        {row.goal.profit != null ? money(row.goal.profit) : "—"}
      </td>
    </tr>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
      <div className="text-[11.5px] font-bold text-muted">{label}</div>
      <div className="mt-1 text-[22px] font-extrabold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-muted">{sub}</div>}
    </div>
  );
}

export function GoalsBoard({ board }: { board: Board }) {
  const active = board.rows.filter((r) => r.goal.linkKind !== "inactive");
  const measured = active.filter((r) => r.actual != null);
  const targetAll = active.reduce((s, r) => s + r.goal.turnover, 0);
  const targetMeasured = measured.reduce((s, r) => s + r.goal.turnover, 0);
  const actual = measured.reduce((s, r) => s + (r.actual ?? 0), 0);
  const pct = targetMeasured ? Math.round((actual / targetMeasured) * 100) : 0;
  const onTrack = measured.filter((r) => statusOf(r) === "good").length;
  const up = measured.filter((r) => r.trend === "up").length;
  const down = measured.filter((r) => r.trend === "down").length;
  const unlinked = active.length - measured.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="ממוצע חודשי בפועל (שורות שנמדדות)"
          value={money(actual)}
          sub={`${pct}% מיעד של ${money(targetMeasured)}`}
        />
        <Stat label="שורות שעומדות ביעד" value={`${onTrack} מתוך ${measured.length}`} />
        <Stat label="מגמה" value={`${up} בעלייה · ${down} בירידה`} sub="מול שלושת החודשים שלפני" />
        <Stat
          label="יעד חודשי כולל (בלי שורות לא פעילות)"
          value={money(targetAll)}
          sub={unlinked ? `${unlinked} שורות לא נמדדות באתר` : "כל השורות נמדדות"}
        />
      </div>

      <div className="overflow-x-auto rounded-card border border-card-border bg-white shadow-card">
        <table className="w-full text-right">
          <thead className="bg-[#f7f9fb] text-[11.5px] font-bold text-muted">
            <tr>
              <th className="px-3 py-2">שורה</th>
              <th className="px-3 py-2">נמדד מול</th>
              <th className="px-3 py-2">יעד מחזור לחודש</th>
              <th className="px-3 py-2">בפועל (ממוצע 3 חודשים)</th>
              <th className="px-3 py-2">התקדמות</th>
              <th className="px-3 py-2">מגמה</th>
              <th className="px-3 py-2">מחשבים</th>
              <th className="px-3 py-2">יעד רווחיות</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((row) => (
              <GoalLine key={row.goal.id} row={row} board={board} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
