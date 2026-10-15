"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BookOpen, FileText, Search } from "lucide-react";

export type LibraryItem = {
  kind: "procedure" | "tutorial";
  id: string;
  title: string;
  summary?: string;
  category?: string;
  imageDataUrl?: string;
  href: string;
};

/**
 * "נהלים והדרכות" (אפיון שדרוג v2, סעיף 12): חיפוש, סינון לפי סוג תוכן ותחום. הרשימה מגיעה
 * מהשרת כבר מסוננת לפי ההרשאות של כל פריט — כאן רק תצוגה.
 */
export function LibraryClient({ items }: { items: LibraryItem[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"all" | "procedure" | "tutorial">("all");
  const [category, setCategory] = useState("");
  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category ?? "").filter(Boolean))).sort((a, b) => a.localeCompare(b, "he")),
    [items],
  );
  const query = q.trim().toLowerCase();
  const visible = items.filter(
    (i) =>
      (kind === "all" || i.kind === kind) &&
      (!category || i.category === category) &&
      (!query || i.title.toLowerCase().includes(query) || (i.summary ?? "").toLowerCase().includes(query)),
  );
  const filterActive = kind !== "all" || Boolean(category) || Boolean(query);
  const chip = (on: boolean) => (on ? "pill-active" : "pill-inactive");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש נוהל או הדרכה..."
            className="w-full rounded-[10px] border border-card-border bg-white py-1.5 pl-3 pr-9 text-sm focus:border-teal focus:outline-none"
          />
        </div>
        <button type="button" className={chip(kind === "all")} onClick={() => setKind("all")}>
          הכול
        </button>
        <button type="button" className={chip(kind === "procedure")} onClick={() => setKind("procedure")}>
          נהלים
        </button>
        <button type="button" className={chip(kind === "tutorial")} onClick={() => setKind("tutorial")}>
          הדרכות
        </button>
        {categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-[10px] border border-card-border bg-white px-2 py-1.5 text-sm"
            aria-label="תחום"
          >
            <option value="">כל התחומים</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {filterActive && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setKind("all");
              setCategory("");
            }}
            className="text-xs font-bold text-teal hover:underline"
          >
            הצג הכול
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="card text-sm text-muted">{filterActive ? "לא נמצאו פריטים תואמים." : "עדיין אין נהלים או הדרכות זמינים."}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((i) => (
            <Link key={`${i.kind}-${i.id}`} href={i.href} className="card flex flex-col gap-2 overflow-hidden transition hover:shadow-lg">
              {i.kind === "tutorial" ? (
                i.imageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.imageDataUrl} alt={i.title} className="h-32 w-full rounded-lg border border-card-border object-cover" />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center rounded-lg border border-card-border bg-[#f4f6f9]">
                    <BookOpen className="h-8 w-8 text-muted" />
                  </div>
                )
              ) : null}
              <div className="flex items-center gap-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    i.kind === "procedure" ? "bg-teal-bg text-teal-dark" : "bg-[#f4f6f9] text-muted"
                  }`}
                >
                  {i.kind === "procedure" ? "נוהל" : "הדרכה"}
                </span>
                {i.category && <span className="text-[11px] text-muted">{i.category}</span>}
              </div>
              <div className="flex items-start gap-1.5 text-sm font-bold text-ink">
                {i.kind === "procedure" && <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
                {i.title}
              </div>
              {i.summary && <div className="text-[12px] text-muted">{i.summary}</div>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
