"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { BranchOption } from "@/lib/rental-reports";

const PRESETS = [
  { key: "today", label: "היום" },
  { key: "3d", label: "3 ימים אחרונים" },
  { key: "week", label: "השבוע" },
  { key: "month", label: "בחר חודש" },
  { key: "all", label: "מתחילת הפעילות" },
  { key: "range", label: "בחר טווח אחר" },
] as const;

const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

/**
 * סרגל הסינון של הדוחות. כל הבחירה חיה בכתובת (`?p=&m=&from=&to=&b=`) — השרת מחשב מחדש בכל שינוי,
 * וקישור לדוח נשמר עם הסינון שלו. רשימת הסניפים מגיעה מהשרת וכוללת רק סניפי השכרות.
 */
export function ReportFilters({
  branches,
  selected,
  preset,
  month,
  from,
  to,
}: {
  branches: BranchOption[];
  selected: string[];
  preset: string;
  month: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params?.toString() ?? "");
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : (pathname ?? ""), { scroll: false });
  }

  const [year, mon] = month.split("-");
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: thisYear - 2022 }, (_, i) => String(thisYear - i));
  const allIds = branches.map((b) => b.id);
  const effective = selected.length === 0 ? allIds : selected;

  function toggleBranch(id: string) {
    const next = effective.includes(id) ? effective.filter((x) => x !== id) : [...effective, id];
    // כולם סומנו (או אף אחד) = "כל הסניפים" = בלי פרמטר
    update({ b: next.length === 0 || next.length === allIds.length ? null : next.join(",") });
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold text-muted">תקופה</span>
        <div className="flex flex-wrap gap-1 rounded-lg border border-card-border p-0.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => update({ p: p.key === "month" ? null : p.key })}
              className={preset === p.key ? "pill-active" : "pill-inactive"}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === "month" && (
          <>
            <select
              aria-label="חודש"
              className="btn-outline"
              value={mon}
              onChange={(e) => update({ m: `${year}-${e.target.value}` })}
            >
              {MONTHS.map((name, i) => (
                <option key={name} value={String(i + 1).padStart(2, "0")}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="שנה"
              className="btn-outline"
              value={year}
              onChange={(e) => update({ m: `${e.target.value}-${mon}` })}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </>
        )}

        {preset === "range" && (
          <>
            <label className="flex items-center gap-1 text-[13px] text-muted">
              מ-
              <input type="date" className="btn-outline" value={from} onChange={(e) => update({ p: "range", from: e.target.value })} />
            </label>
            <label className="flex items-center gap-1 text-[13px] text-muted">
              עד
              <input type="date" className="btn-outline" value={to} onChange={(e) => update({ p: "range", to: e.target.value })} />
            </label>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold text-muted">סניפים</span>
        <button type="button" onClick={() => update({ b: null })} className="text-xs font-bold text-teal hover:underline">
          כולם
        </button>
        {branches.map((b) => {
          const on = effective.includes(b.id);
          return (
            <label
              key={b.id}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] ${
                on ? "border-teal bg-teal-bg font-bold text-teal-dark" : "border-card-border text-muted"
              }`}
            >
              <input type="checkbox" checked={on} onChange={() => toggleBranch(b.id)} />
              {b.name}
            </label>
          );
        })}
      </div>
    </div>
  );
}
