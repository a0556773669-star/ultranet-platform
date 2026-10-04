"use client";

import { useState, useTransition } from "react";
import { Calendar, CalendarDays } from "lucide-react";
import { BranchSwitcher } from "../branch-switcher";
import {
  getOpsTasksSnapshotAction,
  setTaskDoneAction,
  type TaskRow,
  type TasksSnapshot,
} from "../actions";
import { formatPeriod } from "@/lib/operations-shared";

export function OpsTasksClient({ snapshot }: { snapshot: TasksSnapshot }) {
  const [state, setState] = useState(snapshot);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { branchId, rows } = state;
  const weekly = rows.filter((r) => r.freq === "weekly");
  const monthly = rows.filter((r) => r.freq === "monthly");

  function switchBranch(next: string) {
    startTransition(async () => {
      setState(await getOpsTasksSnapshotAction(next));
    });
  }

  function toggle(row: TaskRow) {
    if (!branchId) return;
    setError(null);
    const next = !row.isDone;
    setState((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => (r.taskId === row.taskId ? { ...r, isDone: next } : r)),
    }));
    startTransition(async () => {
      const result = await setTaskDoneAction(branchId, row.taskId, row.freq, next);
      if (!result.ok) {
        setError(result.message);
        setState(await getOpsTasksSnapshotAction(branchId));
      }
    });
  }

  if (state.branches.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
        {"אין סניף חדרי מחשבים משויך למשתמש הזה"}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BranchSwitcher branches={state.branches} value={branchId} onChange={switchBranch} />

      <TaskGroup
        title="משימות שבועיות"
        periodLabel={formatPeriod(state.weekKey)}
        icon={<Calendar className="h-4 w-4" />}
        rows={weekly}
        onToggle={toggle}
        disabled={isPending}
      />
      <TaskGroup
        title="משימות חודשיות"
        periodLabel={formatPeriod(state.monthKey)}
        icon={<CalendarDays className="h-4 w-4" />}
        rows={monthly}
        onToggle={toggle}
        disabled={isPending}
      />

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {state.progress && (
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">{"התקדמות הסניפים"}</h3>
          {state.progress.map((p) => (
            <div key={p.branchId} className="flex items-center gap-2 border-b border-card-border py-2 text-[13px] last:border-b-0">
              <span className="flex-1 font-semibold text-ink">{p.branchName}</span>
              <span
                className={
                  p.total > 0 && p.done === p.total
                    ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600"
                    : "rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700"
                }
              >
                {p.done}/{p.total}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskGroup({
  title,
  periodLabel,
  icon,
  rows,
  onToggle,
  disabled,
}: {
  title: string;
  periodLabel: string;
  icon: React.ReactNode;
  rows: TaskRow[];
  onToggle: (row: TaskRow) => void;
  disabled: boolean;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        {icon}
        {title}
        <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 normal-case text-ink">{periodLabel}</span>
        <span className="normal-case">
          {rows.filter((r) => r.isDone).length}/{rows.length}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-6 text-center text-sm text-muted">
          {"אין משימות"}
        </div>
      ) : (
        rows.map((row) => (
          <div
            key={row.taskId}
            className={`flex items-center justify-between gap-3 rounded-[11px] border border-card-border bg-white p-3 shadow-card ${
              row.isDone ? "border-r-4 border-r-card-border opacity-60" : "border-r-4 border-r-teal"
            }`}
          >
            <label className="flex flex-1 items-center gap-3">
              <input
                type="checkbox"
                checked={row.isDone}
                disabled={disabled}
                onChange={() => onToggle(row)}
                className="h-5 w-5 accent-teal"
              />
              <span className="flex flex-col">
                <span className={row.isDone ? "text-muted line-through" : "font-semibold text-ink"}>{row.name}</span>
                {row.details && <span className="text-[11px] text-muted">{row.details}</span>}
              </span>
            </label>
            {row.isDone && row.doneBy && <span className="text-[11px] text-muted">{row.doneBy}</span>}
          </div>
        ))
      )}
    </section>
  );
}
