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
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold text-gray-800">פנייה חדשה</h2>
        <div className="flex flex-wrap gap-3">
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as "to-admin" | "to-branch")}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            {DIRECTION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            value={branchKey}
            onChange={(e) => setBranchKey(e.target.value as BranchKey)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
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
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="פירוט (לא חובה)"
            className="min-h-[70px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={isPending}
          className="w-fit rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          שלח פנייה
        </button>
      </div>

      <div className="space-y-2">
        {tickets.length === 0 && <p className="text-sm text-gray-500">אין פניות</p>}
        {tickets.map((t) => (
          <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-800">{t.title}</p>
                {t.desc && <p className="mt-1 text-sm text-gray-600">{t.desc}</p>}
                <p className="mt-1 text-xs text-gray-400">{t.branch} · {t.date} · {t.by}</p>
              </div>
              {snapshot.canManage && (
                <button onClick={() => handleDelete(t.id)} className="text-xs text-red-500">מחק</button>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {([
                { value: "open", label: "🔴 פתוח" },
                { value: "progress", label: "🟡 בטיפול" },
                { value: "done", label: "🟢 טופל" },
              ] as { value: TicketStatus; label: string }[]).map((s) => (
                <button
                  key={s.value}
                  onClick={() => handleStatus(t.id, s.value)}
                  className={`rounded-full px-3 py-1 text-xs ${t.status === s.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600"}`}
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
