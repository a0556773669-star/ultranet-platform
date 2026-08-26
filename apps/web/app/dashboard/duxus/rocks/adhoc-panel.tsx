"use client";

import { useEffect, useState, useTransition } from "react";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import type { Milestone, MilestoneStage } from "@ultranet/shared-types";
import { createMilestoneAction, deleteMilestoneAction, toggleMilestoneDoneAction } from "./actions";
import { AddMilestoneForm } from "./add-forms";
import { useToast } from "@/lib/toast";

/**
 * משימות שבועיות/שוטפות שאינן נגזרות מסלע (`source: "adhoc"`, בלי `rockId`) - מה
 * שעולה בפגישה השבועית או פשוט צריך להיעשות. הן חיות באותה קולקשן של אבני הדרך
 * ולכן מקבלות את אותו טיפול (סימון בוצע, גלגול לרבעון הבא), אבל מוצגות בקטע נפרד
 * כדי לא לזהם את עץ הסלעים.
 */
export function AdhocPanel({
  tasks,
  quarterKey,
  monthKey,
  weekKey,
  stage,
  readOnly = false,
  title = "משימות שוטפות",
  addLabel = "הוסף משימה שבועית/שוטפת",
  emptyMessage = "אין כרגע משימות שוטפות.",
}: {
  tasks: Milestone[];
  quarterKey: string;
  monthKey?: string;
  weekKey?: string;
  stage: MilestoneStage;
  readOnly?: boolean;
  title?: string;
  addLabel?: string;
  emptyMessage?: string;
}) {
  const { showError, toastNode } = useToast();
  const [, startTransition] = useTransition();
  const [openForm, setOpenForm] = useState(false);
  const [localTasks, setLocalTasks] = useState(tasks);
  useEffect(() => setLocalTasks(tasks), [tasks]);

  const doneCount = localTasks.filter((t) => t.done).length;

  function handleToggle(id: string) {
    setLocalTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    startTransition(async () => {
      const result = await toggleMilestoneDoneAction(id);
      if (!result.ok) {
        showError(result.message);
        setLocalTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
      }
    });
  }

  function handleDelete(id: string) {
    const removed = localTasks.find((t) => t.id === id);
    setLocalTasks((prev) => prev.filter((t) => t.id !== id));
    startTransition(async () => {
      const result = await deleteMilestoneAction(id);
      if (!result.ok) {
        showError(result.message);
        if (removed) setLocalTasks((prev) => [...prev, removed]);
      }
    });
  }

  function handleAdd(title_: string, ownerName: string) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setLocalTasks((prev) => [
      ...prev,
      {
        id: tempId,
        rockId: "",
        quarterKey,
        title: title_,
        ownerUserId: "",
        ownerName,
        stage,
        monthKey,
        weekKey,
        done: false,
        carryOverCount: 0,
        source: "adhoc",
        order: Date.now(),
        createdAt: Date.now(),
      },
    ]);
    setOpenForm(false);
    startTransition(async () => {
      const result = await createMilestoneAction({
        rockId: "",
        quarterKey,
        title: title_,
        ownerName,
        stage,
        monthKey,
        weekKey,
        source: "adhoc",
      });
      if (!result.ok) showError(result.message);
    });
  }

  return (
    <div className="card mb-4">
      {toastNode}
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <ListChecks className="h-4 w-4" />
          {title}
          {localTasks.length > 0 && (
            <span className="text-[11px] font-semibold text-muted">
              ({doneCount}/{localTasks.length})
            </span>
          )}
        </h3>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setOpenForm((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            {addLabel}
          </button>
        )}
      </div>

      {openForm && !readOnly && (
        <div className="mb-2">
          <AddMilestoneForm placeholder="מה צריך לעשות?" onSubmit={handleAdd} onCancel={() => setOpenForm(false)} />
        </div>
      )}

      {localTasks.length === 0 ? (
        <div className="text-sm text-muted">{emptyMessage}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {localTasks.map((t) => {
            const pending = t.id.startsWith("temp-");
            return (
              <div
                key={t.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  t.done ? "border-emerald-200 bg-emerald-50" : "border-card-border bg-white"
                } ${pending ? "opacity-60" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  disabled={readOnly || pending}
                  onChange={() => handleToggle(t.id)}
                  className="h-4 w-4 accent-emerald-600"
                />
                <span className={`flex-1 ${t.done ? "text-emerald-800 line-through" : "text-ink"}`}>{t.title}</span>
                <span className="shrink-0 rounded-full border border-purple bg-[#f4ecf8] px-2 py-0.5 text-[11px] font-bold text-purple">
                  שוטף
                </span>
                {t.ownerName ? <span className="shrink-0 text-[11px] text-muted">{t.ownerName}</span> : null}
                {!readOnly && (
                  <button type="button" onClick={() => handleDelete(t.id)} className="shrink-0 text-muted hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
