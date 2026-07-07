"use client";

import { useState, useTransition } from "react";
import {
  createNewsAction,
  deleteNewsAction,
  type NewsView,
  type NewsSnapshot,
} from "./actions";

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export function NewsClient({ snapshot }: { snapshot: NewsSnapshot }) {
  const [news, setNews] = useState<NewsView[]>(snapshot.news);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createNewsAction(title, body);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setTitle("");
      setBody("");
      window.location.reload();
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteNewsAction(id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setNews((prev) => prev.filter((n) => n.id !== id));
    });
  }

  return (
    <div className="space-y-4">
      {snapshot.canManage && (
        <div className="space-y-3 rounded-card border border-card-border bg-white p-4 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">📰 עדכון חדש</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת"
            className={FIELD}
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="תוכן העדכון"
            className={`min-h-[90px] ${FIELD}`}
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={isPending}
            className="w-fit rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
          >
            פרסם עדכון
          </button>
        </div>
      )}

      <div className="space-y-2">
        {news.length === 0 && (
          <div className="rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
            אין עדכונים
          </div>
        )}
        {news.map((n) => (
          <div key={n.id} className="rounded-card border border-card-border bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-ink">{n.title}</p>
                {n.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{n.body}</p>}
                <p className="mt-1 text-[11px] text-muted">{n.date} · {n.by}</p>
              </div>
              {snapshot.canManage && (
                <button
                  onClick={() => handleDelete(n.id)}
                  className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-50"
                >
                  מחק
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
