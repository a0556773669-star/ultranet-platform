"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { globalSearchAction, type SearchHit } from "./search-actions";

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  client: "לקוחות",
  laptop: "ציוד",
  branch: "סניפים",
  task: "משימות",
};
const KIND_ORDER: SearchHit["kind"][] = ["client", "laptop", "branch", "task"];

/**
 * חיפוש כללי בראש האתר (אפיון שדרוג v2, סעיף 2; מסמך המשך 1, סעיף 35). תוצאות קצרות לפי סוג,
 * רק מה שמותר למשתמש (הסינון בשרת, `search-actions.ts`). קיצור: "/" — רק כשלא מקלידים בשדה
 * אחר, כדי לא להתנגש בהקלדה או בקיצורי הדפדפן. החיפוש נגיש גם בלי הקיצור.
 */
export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (typing) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    const id = setTimeout(() => {
      startTransition(async () => {
        try {
          const result = await globalSearchAction(q);
          setHits(result);
          setActive(0);
        } catch {
          setHits([]);
        }
      });
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const ordered = (hits ?? []).slice().sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind));

  function go(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  }

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      <input
        ref={inputRef}
        id="global-search"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, ordered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && ordered[active]) {
            e.preventDefault();
            go(ordered[active]!);
          }
        }}
        placeholder="חיפוש לקוח, מחשב, סניף או משימה…"
        aria-label="חיפוש כללי"
        className="w-full rounded-[10px] border border-card-border bg-[#f4f6f9] py-2 pl-10 pr-9 text-sm focus:border-teal focus:bg-white focus:outline-none"
      />
      <kbd className="pointer-events-none absolute left-3 top-1/2 hidden -translate-y-1/2 rounded border border-card-border bg-white px-1.5 text-[11px] text-muted sm:block">
        /
      </kbd>

      {open && query.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-card border border-card-border bg-white p-2 shadow-card">
          {hits === null || (pending && hits.length === 0) ? (
            <div className="px-2 py-3 text-sm text-muted">מחפש…</div>
          ) : ordered.length === 0 ? (
            <div className="px-2 py-3 text-sm text-muted">לא נמצאו תוצאות</div>
          ) : (
            KIND_ORDER.filter((k) => ordered.some((h) => h.kind === k)).map((kind) => (
              <div key={kind} className="mb-1">
                <div className="px-2 pb-1 pt-2 text-[11px] font-bold text-muted">{KIND_LABEL[kind]}</div>
                {ordered
                  .filter((h) => h.kind === kind)
                  .map((h) => {
                    const idx = ordered.indexOf(h);
                    return (
                      <Link
                        key={`${h.kind}-${h.id}`}
                        href={h.href}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => go(h)}
                        className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-[13px] ${
                          idx === active ? "bg-teal-bg" : "hover:bg-[#f4f6f9]"
                        }`}
                      >
                        <span className="font-bold text-ink">{h.title}</span>
                        <span className="truncate text-[11px] text-muted">{h.sub}</span>
                      </Link>
                    );
                  })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
