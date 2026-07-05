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
          <p className="text-sm text-gray-500">אין משימות</p>
        )}
        {tasks.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3"
          >
            <label className="flex flex-1 items-center gap-3">
              <input
                type="checkbox"
                checked={t.isDone}
                onChange={() => handleToggle(t.id)}
                className="h-5 w-5"
              />
              <span className={t.isDone ? "text-gray-400 line-through" : "text-gray-800"}>
                {t.name}
              </span>
            </label>

            <span className="ml-3 rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-600">
              {t.freq === "weekly" ? "📅 שבועי" : "🗓️ חודשי"}
            </span>
            <span className="ml-3 text-xs text-gray-500">{t.branchLabel}</span>
            {snapshot.canManage && (
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                className="ml-3 text-xs text-red-600 underline"
              >
                מחק
              </button>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {snapshot.canManage && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-bold text-gray-800">הוספת משימה</h2>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם המשימה"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <div className="flex gap-3">
            <select
              value={freq}
              onChange={(e) => setFreq(e.target.value as "weekly" | "monthly")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="weekly">שבועי</option>
              <option value="monthly">חודשי</option>
            </select>
            <select
              value={assign}
              onChange={(e) => setAssign(e.target.value as "admin" | "branches")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="admin">מנהל (כולם)</option>
              <option value="branches">סניפים נבחרים</option>
            </select>
          </div>

          {assign === "branches" && (
            <div className="flex flex-wrap gap-2">
              {snapshot.branches.map((b) => (
                <label key={b.key} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedBranches.includes(b.key)}
                    onChange={() => toggleBranch(b.key)}
                  />
                  {b.label}
                </label>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending}
            className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-dark disabled:opacity-60"
          >
            {isPending ? "מוסיף..." : "➕ הוסף משימה"}
          </button>
        </div>
      )}
    </div>
  );
}
