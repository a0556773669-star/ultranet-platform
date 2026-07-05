"use client";

import { useState, useTransition } from "react";
import {
  createNewsAction,
  deleteNewsAction,
  type NewsView,
  type NewsSnapshot,
} from "./actions";

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
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-lg font-bold text-gray-800">עדכון חדש</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="כותרת"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="תוכן העדכון"
            className="min-h-[90px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={isPending}
            className="w-fit rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            פרסם עדכון
          </button>
        </div>
      )}

      <div className="space-y-2">
        {news.length === 0 && <p className="text-sm text-gray-500">אין עדכונים</p>}
        {news.map((n) => (
          <div key={n.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-800">{n.title}</p>
                {n.body && <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{n.body}</p>}
                <p className="mt-1 text-xs text-gray-400">{n.date} · {n.by}</p>
              </div>
              {snapshot.canManage && (
                <button onClick={() => handleDelete(n.id)} className="text-xs text-red-500">מחק</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
