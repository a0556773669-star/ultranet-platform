"use client";

import { useState, useTransition } from "react";
import type { BranchType, GoalLinkKind } from "@ultranet/shared-types";
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

/** בחודש הנוכחי משווים לקצב (היעד × החלק שעבר מהחודש); בחודש שהסתיים — ליעד המלא. */
function statusOf(row: GoalRow, elapsed: number): Status {
  if (row.goal.linkKind === "inactive") return "inactive";
  if (row.actual == null || !row.goal.turnover) return "none";
  const expected = row.goal.turnover * Math.max(elapsed, 0.0001);
  const ratio = row.actual / expected;
  if (ratio >= 1) return "good";
  if (ratio >= 0.8) return "close";
  return "behind";
}

const STATUS_STYLE: Record<Status, { bar: string; text: string; label: string }> = {
  good: { bar: "bg-teal", text: "text-teal-dark", label: "בקצב" },
  close: { bar: "bg-amber-500", text: "text-amber-700", label: "קרוב" },
  behind: { bar: "bg-red-500", text: "text-red-600", label: "מאחור" },
  none: { bar: "bg-slate-300", text: "text-muted", label: "אין נתון באתר" },
  inactive: { bar: "bg-slate-300", text: "text-muted", label: "לא פעיל כרגע" },
};

function linkValue(row: GoalRow) {
  return row.goal.linkKind === "branch" && row.goal.branchId ? `branch:${row.goal.branchId}` : row.goal.linkKind;
}

function GoalLine({ row, board, isCurrent }: { row: GoalRow; board: Board; isCurrent: boolean }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const status = statusOf(row, board.elapsed);
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
      </td>
      <td className="min-w-[170px] px-3 py-2.5">
        {row.actual == null ? (
          <span className="text-[11.5px] text-muted">{style.label}</span>
        ) : (
          <div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-[#eef1f5]">
              <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
              {isCurrent && board.elapsed < 1 && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-ink/60"
                  style={{ right: `${board.elapsed * 100}%` }}
                  title="איפה צריך להיות היום"
                />
              )}
            </div>
            <div className={`mt-0.5 flex justify-between text-[11px] font-bold ${style.text}`}>
              <span>{Math.round(pct)}%</span>
              <span>{style.label}</span>
            </div>
          </div>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-muted">
        {row.avg3 == null ? "—" : money(row.avg3)}
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

export function GoalsBoard({ board, isCurrent }: { board: Board; isCurrent: boolean }) {
  const active = board.rows.filter((r) => r.goal.linkKind !== "inactive");
  const measured = active.filter((r) => r.actual != null);
  const targetAll = active.reduce((s, r) => s + r.goal.turnover, 0);
  const targetMeasured = measured.reduce((s, r) => s + r.goal.turnover, 0);
  const actual = measured.reduce((s, r) => s + (r.actual ?? 0), 0);
  const pct = targetMeasured ? Math.round((actual / targetMeasured) * 100) : 0;
  const onTrack = measured.filter((r) => statusOf(r, board.elapsed) === "good").length;
  const forecast = isCurrent && board.elapsed > 0 ? actual / board.elapsed : actual;
  const unlinked = active.length - measured.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="נכנס החודש (שורות שנמדדות)"
          value={money(actual)}
          sub={`${pct}% מיעד של ${money(targetMeasured)}`}
        />
        <Stat
          label={isCurrent ? "תחזית לסוף החודש" : "סוף החודש"}
          value={money(forecast)}
          sub={isCurrent ? `לפי הקצב עד היום (עברו ${Math.round(board.elapsed * 100)}% מהחודש)` : undefined}
        />
        <Stat label="שורות בקצב / ביעד" value={`${onTrack} מתוך ${measured.length}`} />
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
              <th className="px-3 py-2">בפועל</th>
              <th className="px-3 py-2">{isCurrent ? "התקדמות (הקו = איפה צריך להיות היום)" : "התקדמות"}</th>
              <th className="px-3 py-2">ממוצע 3 חודשים קודמים</th>
              <th className="px-3 py-2">מחשבים</th>
              <th className="px-3 py-2">יעד רווחיות</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map((row) => (
              <GoalLine key={row.goal.id} row={row} board={board} isCurrent={isCurrent} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
