"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { ScopePicker } from "./scope-picker";
import {
  deleteOpsTaskAction,
  deleteStockItemAction,
  upsertOpsTaskAction,
  upsertStockItemAction,
  type SettingsSnapshot,
} from "../actions";
import type { OpsBranch } from "@/lib/operations-shared";
import type { OpsScope, OpsStockItem, OpsTask, OpsTaskFreq } from "@ultranet/shared-types";

const INPUT =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const PRIMARY =
  "flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60";

function scopeLabel(def: { scope: OpsScope; branchIds: string[] }, branches: OpsBranch[]): string {
  if (def.scope === "all") return "כל הסניפים";
  const names = def.branchIds.map((id) => branches.find((b) => b.id === id)?.name ?? id);
  return names.length ? names.join(", ") : "ללא סניף";
}

export function SettingsClient({ snapshot }: { snapshot: SettingsSnapshot }) {
  return (
    <div className="space-y-5">
      <StockItemsSection branches={snapshot.branches} items={snapshot.items} />
      <TasksSection branches={snapshot.branches} tasks={snapshot.tasks} />
    </div>
  );
}

/* ── הגדרות מלאי ──────────────────────────────────────────────────────────── */

function StockItemsSection({ branches, items }: { branches: OpsBranch[]; items: OpsStockItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<OpsStockItem | null>(null);
  const [name, setName] = useState("");
  const [targetQty, setTargetQty] = useState("1");
  const [unit, setUnit] = useState("");
  const [scope, setScope] = useState<OpsScope>("all");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setEditing(null);
    setName("");
    setTargetQty("1");
    setUnit("");
    setScope("all");
    setBranchIds([]);
  }

  function startEdit(item: OpsStockItem) {
    setEditing(item);
    setName(item.name);
    setTargetQty(String(item.targetQty));
    setUnit(item.unit ?? "");
    setScope(item.scope);
    setBranchIds(item.branchIds);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await upsertStockItemAction({
        id: editing?.id,
        name,
        targetQty: Number(targetQty) || 0,
        unit,
        scope,
        branchIds,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      reset();
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteStockItemAction(id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-card border border-card-border bg-white p-4 shadow-card">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        <Package className="h-4 w-4" />
        {"פריטי מלאי"}
        <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 normal-case text-ink">{items.length}</span>
      </h3>

      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{"עוד לא הוגדרו פריטים"}</p>
      ) : (
        <div className="overflow-hidden rounded-[11px] border border-card-border">
          <table className="w-full text-[13px]">
            <thead className="bg-[#f4f6f9] text-muted">
              <tr>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">{"פריט"}</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">{"כמות נדרשת"}</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">{"חל על"}</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-card-border">
                  <td className="px-[11px] py-2 font-semibold text-ink">{item.name}</td>
                  <td className="px-[11px] py-2 text-muted">{`${item.targetQty} ${item.unit ?? ""}`.trim()}</td>
                  <td className="px-[11px] py-2 text-[11px] text-muted">{scopeLabel(item, branches)}</td>
                  <td className="px-[11px] py-2">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        aria-label="עריכה"
                        className="rounded-lg border border-card-border bg-white p-1.5 text-muted transition hover:border-teal hover:text-teal"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item.id)}
                        aria-label="מחיקה"
                        className="rounded-lg border border-red-200 bg-white p-1.5 text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-3 rounded-[11px] border border-dashed border-card-border p-3">
        <h4 className="text-xs font-bold text-ink">{editing ? `עריכת "${editing.name}"` : "פריט חדש"}</h4>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם הפריט (למשל: עטים)"
            className={`${INPUT} min-w-[200px] flex-1`}
          />
          <input
            type="number"
            min={0}
            value={targetQty}
            onChange={(e) => setTargetQty(e.target.value)}
            placeholder="כמות"
            className={`${INPUT} w-24`}
          />
          <input
            type="text"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="יחידה (יח' / חבילות)"
            className={`${INPUT} w-40`}
          />
        </div>
        <ScopePicker
          branches={branches}
          scope={scope}
          branchIds={branchIds}
          onScopeChange={setScope}
          onBranchesChange={setBranchIds}
        />
        <div className="flex gap-2">
          <button type="button" onClick={submit} disabled={isPending} className={PRIMARY}>
            <Plus className="h-4 w-4" />
            {editing ? "שמור שינויים" : "הוסף פריט"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={reset}
              className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-muted"
            >
              {"ביטול"}
            </button>
          )}
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </section>
  );
}

/* ── הגדרות משימות ────────────────────────────────────────────────────────── */

function TasksSection({ branches, tasks }: { branches: OpsBranch[]; tasks: OpsTask[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<OpsTask | null>(null);
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [freq, setFreq] = useState<OpsTaskFreq>("weekly");
  const [scope, setScope] = useState<OpsScope>("all");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setEditing(null);
    setName("");
    setDetails("");
    setFreq("weekly");
    setScope("all");
    setBranchIds([]);
  }

  function startEdit(task: OpsTask) {
    setEditing(task);
    setName(task.name);
    setDetails(task.details ?? "");
    setFreq(task.freq);
    setScope(task.scope);
    setBranchIds(task.branchIds);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await upsertOpsTaskAction({ id: editing?.id, name, details, freq, scope, branchIds });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      reset();
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteOpsTaskAction(id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-3 rounded-card border border-card-border bg-white p-4 shadow-card">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        {"משימות"}
        <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 normal-case text-ink">{tasks.length}</span>
      </h3>

      {tasks.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{"עוד לא הוגדרו משימות"}</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex flex-wrap items-center gap-2 rounded-[11px] border border-card-border p-3 text-[13px]"
            >
              <span className="flex-1 font-semibold text-ink">{task.name}</span>
              <span className="rounded-full bg-[#f4f6f9] px-2.5 py-1 text-[11px] font-bold text-muted">
                {task.freq === "weekly" ? "שבועי" : "חודשי"}
              </span>
              <span className="text-[11px] text-muted">{scopeLabel(task, branches)}</span>
              <button
                type="button"
                onClick={() => startEdit(task)}
                aria-label="עריכה"
                className="rounded-lg border border-card-border bg-white p-1.5 text-muted transition hover:border-teal hover:text-teal"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => remove(task.id)}
                aria-label="מחיקה"
                className="rounded-lg border border-red-200 bg-white p-1.5 text-red-600 transition hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 rounded-[11px] border border-dashed border-card-border p-3">
        <h4 className="text-xs font-bold text-ink">{editing ? `עריכת "${editing.name}"` : "משימה חדשה"}</h4>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם המשימה"
            className={`${INPUT} min-w-[200px] flex-1`}
          />
          <select value={freq} onChange={(e) => setFreq(e.target.value as OpsTaskFreq)} className={INPUT}>
            <option value="weekly">{"שבועי"}</option>
            <option value="monthly">{"חודשי"}</option>
          </select>
        </div>
        <input
          type="text"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="פירוט / הוראות ביצוע (אופציונלי)"
          className={`${INPUT} w-full`}
        />
        <ScopePicker
          branches={branches}
          scope={scope}
          branchIds={branchIds}
          onScopeChange={setScope}
          onBranchesChange={setBranchIds}
        />
        <div className="flex gap-2">
          <button type="button" onClick={submit} disabled={isPending} className={PRIMARY}>
            <Plus className="h-4 w-4" />
            {editing ? "שמור שינויים" : "הוסף משימה"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={reset}
              className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-muted"
            >
              {"ביטול"}
            </button>
          )}
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </section>
  );
}
