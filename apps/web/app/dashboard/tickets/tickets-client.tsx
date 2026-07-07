"use client";

import { useState, useTransition } from "react";
import {
  createTicketAction,
  deleteTicketAction,
  updateTicketStatusAction,
  type TicketView,
  type TicketsSnapshot,
} from "./actions";
import type { BranchKey } from "@/lib/legacy-inventory";

import type { TicketStatus } from "@/lib/legacy-tickets";

const DIRECTION_OPTIONS: { value: "to-admin" | "to-branch"; label: string }[] = [
  { value: "to-admin", label: "📄 דיווח תקלה למנהל" },
  { value: "to-branch", label: "📩 הודעה לסניף" },
];

const FIELD = "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

const STATUS_OPTS: { value: TicketStatus; label: string; on: string; off: string }[] = [
  { value: "open", label: "🔴 פתוח", on: "bg-red-500 text-white", off: "bg-red-50 text-red-600" },
  { value: "progress", label: "🟡 בטיפול", on: "bg-amber-500 text-white", off: "bg-amber-50 text-amber-600" },
  { value: "done", label: "🟢 טופל", on: "bg-emerald-500 text-white", off: "bg-emerald-50 text-emerald-600" },
];

export function TicketsClient({ snapshot }: { snapshot: TicketsSnapshot }) {
  const [tickets, setTickets] = useState<TicketView[]>(snapshot.tickets);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [direction, setDirection] = useState<"to-admin" | "to-branch">("to-admin");
  const [branchKey, setBranchKey] = useState<BranchKey>(snapshot.branches[0]?.key ?? ("lohamim" as BranchKey));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createTicketAction(title, desc, direction, branchKey);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTitle("");
      setDesc("");
      window.location.reload();
    });
  }

  function handleStatus(id: string, status: TicketStatus) {
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
    startTransition(async () => {
      const result = await updateTicketStatusAction(id, status);
      if (!result.ok) setError(result.message);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTicketAction(id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTickets((prev) => prev.filter((t) => t.id !== id));
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-card border border-card-border bg-white p-4 shadow-card">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">🛠️ פנייה חדשה</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "to-admin" | "to-branch")}
            className={FIELD}
          >
            {DIRECTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={branchKey}
            onChange={(e) => setBranchKey(e.target.value as BranchKey)}
            className={FIELD}
          >
            {snapshot.branches.map((b) => (
              <option key={b.key} value={b.key}>{b.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת הפנייה"
            className={FIELD}
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="פירוט (לא חובה)"
            className={`min-h-[70px] ${FIELD}`}
          />
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={isPending}
          className="w-fit rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
        >
          שלח פנייה
        </button>
      </div>

      <div className="space-y-2">
        {tickets.length === 0 && (
          <div className="rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
            אין פניות
          </div>
        )}
        {tickets.map((t) => (
          <div key={t.id} className="rounded-card border border-card-border bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-ink">{t.title}</p>
                {t.desc && <p className="mt-1 text-sm text-muted">{t.desc}</p>}
                <p className="mt-1 text-[11px] text-muted">{t.branch} · {t.date} · {t.by}</p>
              </div>
              {snapshot.canManage && (
                <button
                  onClick={() => handleDelete(t.id)}
                  className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
                >
                  מחק
                </button>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {STATUS_OPTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleStatus(t.id, s.value)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${t.status === s.value ? s.on : s.off}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
