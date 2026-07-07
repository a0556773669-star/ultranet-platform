"use client";

import { useState, useTransition } from "react";
import {
  addTaskAction,
  deleteTaskAction,
  toggleTaskDoneAction,
  type TaskView,
  type TasksSnapshot,
} from "./actions";

export function TasksClient({ snapshot }: { snapshot: TasksSnapshot }) {
  const [tasks, setTasks] = useState<TaskView[]>(snapshot.tasks);
  const [name, setName] = useState("");
  const [freq, setFreq] = useState<"weekly" | "monthly">("weekly");
  const [assign, setAssign] = useState<"admin" | "branches">("admin");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleBranch(key: string) {
    setSelectedBranches((prev) =>
      prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key]
    );
  }

  function handleToggle(id: string) {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isDone: !t.isDone } : t))
    );
    startTransition(async () => {
      const result = await toggleTaskDoneAction(id);
      if (!result.ok) {
        setError(result.message);
      }
    });
  }

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await addTaskAction(name, freq, assign, selectedBranches);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setName("");
      setSelectedBranches([]);
      window.location.reload();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTaskAction(id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTasks((prev) => prev.filter((t) => t.id !== id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {tasks.length === 0 && (
          <div className="rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
            אין משימות
          </div>
        )}
        {tasks.map((t) => (
          <div
            key={t.id}
            className={`flex items-center justify-between gap-3 rounded-[11px] border border-card-border bg-white p-3 shadow-card ${
              t.isDone ? "border-r-4 border-r-card-border opacity-60" : "border-r-4 border-r-teal"
            }`}
          >
            <label className="flex flex-1 items-center gap-3">
              <input
                type="checkbox"
                checked={t.isDone}
                onChange={() => handleToggle(t.id)}
                className="h-5 w-5 accent-teal"
              />
              <span className={t.isDone ? "text-muted line-through" : "font-semibold text-ink"}>
                {t.name}
              </span>
            </label>

            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-1 text-[11px] font-bold text-muted">
              {t.freq === "weekly" ? "📅 שבועי" : "🗓️ חודשי"}
            </span>
            <span className="text-[11px] text-muted">{t.branchLabel}</span>
            {snapshot.canManage && (
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
              >
                מחק
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {snapshot.canManage && (
        <div className="space-y-3 rounded-card border border-card-border bg-white p-4 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">➕ הוספת משימה</h2>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם המשימה"
            className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
          />

          <div className="flex gap-3">
            <select
              value={freq}
              onChange={(e) => setFreq(e.target.value as "weekly" | "monthly")}
              className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
            >
              <option value="weekly">שבועי</option>
              <option value="monthly">חודשי</option>
            </select>
            <select
              value={assign}
              onChange={(e) => setAssign(e.target.value as "admin" | "branches")}
              className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
            >
              <option value="admin">מנהל (כולם)</option>
              <option value="branches">סניפים נבחרים</option>
            </select>
          </div>

          {assign === "branches" && (
            <div className="flex flex-wrap gap-2">
              {snapshot.branches.map((b) => {
                const on = selectedBranches.includes(b.key);
                return (
                  <button
                    type="button"
                    key={b.key}
                    onClick={() => toggleBranch(b.key)}
                    className={
                      on
                        ? "rounded-full border border-teal bg-teal-bg px-3 py-1 text-xs font-bold text-teal-dark"
                        : "rounded-full border border-card-border bg-[#f4f6f9] px-3 py-1 text-xs font-bold text-muted"
                    }
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "מוסיף..." : "➕ הוסף משימה"}
          </button>
        </div>
      )}
    </div>
  );
}
