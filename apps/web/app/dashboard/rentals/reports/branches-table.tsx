"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";

export interface BranchRow {
  id: string;
  name: string;
  occupancy: number | null;
  revenue: number;
  netProfit: number;
  myProfit: number;
  netPerComputer: number | null;
  renters: number;
  avgDays: number | null;
}

type NumKey = Exclude<keyof BranchRow, "id" | "name">;

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number | null) => (n === null ? "—" : `${nf.format(Math.round(n))} ₪`);
const percent = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
const num1 = (n: number | null) => (n === null ? "—" : n.toFixed(1));

const COLUMNS: { key: NumKey; label: string; show: (r: BranchRow) => string; pct?: boolean; bold?: boolean }[] = [
  { key: "occupancy", label: "תפוסה (%)", show: (r) => percent(r.occupancy), pct: true },
  { key: "revenue", label: "מחזור", show: (r) => money(r.revenue) },
  { key: "netProfit", label: "נטו (כולו)", show: (r) => money(r.netProfit) },
  { key: "myProfit", label: "שלי", show: (r) => money(r.myProfit) },
  { key: "netPerComputer", label: "נטו למחשב", show: (r) => money(r.netPerComputer), bold: true },
  { key: "renters", label: "שוכרים", show: (r) => nf.format(r.renters) },
  { key: "avgDays", label: "ממוצע ימים", show: (r) => num1(r.avgDays) },
];

/**
 * טבלת הסניפים — תמיד כל סניפי ההשכרות, בלי קשר לבחירה בסינון שלמעלה (רק התקופה משפיעה).
 * כמו אקסל: לחיצה על כותרת ממיינת (עולה → יורד → ביטול), ובשורת הסינון מקלידים חלק משם סניף או
 * מינימום למספרים ("שלי: 200" = רק סניפים עם שלי ≥ 200). הכל בצד הלקוח על נתונים שכבר נטענו.
 */
export function BranchesTable({ rows }: { rows: BranchRow[] }) {
  const [sort, setSort] = useState<{ key: "name" | NumKey; dir: "asc" | "desc" } | null>(null);
  const [nameFilter, setNameFilter] = useState("");
  const [minFilters, setMinFilters] = useState<Partial<Record<NumKey, string>>>({});

  const visible = useMemo(() => {
    let out = rows.filter((r) => r.name.includes(nameFilter.trim()));
    for (const col of COLUMNS) {
      const raw = minFilters[col.key]?.trim();
      if (!raw) continue;
      const min = Number(raw.replace(",", "."));
      if (Number.isNaN(min)) continue;
      const threshold = col.pct ? min / 100 : min;
      out = out.filter((r) => {
        const v = r[col.key];
        return v !== null && v >= threshold;
      });
    }
    if (sort) {
      const { key, dir } = sort;
      const sign = dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        if (key === "name") return sign * a.name.localeCompare(b.name, "he");
        const av = a[key];
        const bv = b[key];
        if (av === null && bv === null) return 0;
        if (av === null) return 1; // בלי נתון — תמיד בסוף
        if (bv === null) return -1;
        return sign * (av - bv);
      });
    }
    return out;
  }, [rows, sort, nameFilter, minFilters]);

  function toggleSort(key: "name" | NumKey) {
    setSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: key === "name" ? "asc" : "desc" };
      if (cur.dir === (key === "name" ? "asc" : "desc")) return { key, dir: key === "name" ? "desc" : "asc" };
      return null;
    });
  }

  const hasFilter = nameFilter !== "" || Object.values(minFilters).some(Boolean);
  const SortIcon = ({ k }: { k: "name" | NumKey }) =>
    sort?.key !== k ? (
      <ArrowUpDown className="h-3 w-3 opacity-40" />
    ) : sort.dir === "asc" ? (
      <ArrowUp className="h-3 w-3" />
    ) : (
      <ArrowDown className="h-3 w-3" />
    );

  return (
    <section className="card overflow-x-auto">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[16px] font-extrabold text-ink">פירוט לפי סניף</h3>
          <p className="text-[12px] text-muted">כל סניפי ההשכרות, בלי קשר לבחירה למעלה — לפי התקופה שנבחרה. לחיצה על כותרת ממיינת.</p>
        </div>
        {hasFilter && (
          <button
            type="button"
            onClick={() => {
              setNameFilter("");
              setMinFilters({});
            }}
            className="flex items-center gap-1 text-xs font-bold text-teal hover:underline"
          >
            <X className="h-3 w-3" />
            נקה סינון ({visible.length} מתוך {rows.length})
          </button>
        )}
      </div>
      <table className="w-full min-w-[820px] text-[13px]">
        <thead>
          <tr className="border-b border-card-border text-right text-xs text-muted">
            <th className="py-1.5 font-bold">
              <button type="button" onClick={() => toggleSort("name")} className="flex items-center gap-1 font-bold">
                סניף <SortIcon k="name" />
              </button>
            </th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="font-bold">
                <button type="button" onClick={() => toggleSort(c.key)} className="flex items-center gap-1 font-bold">
                  {c.label} <SortIcon k={c.key} />
                </button>
              </th>
            ))}
          </tr>
          <tr className="border-b border-card-border bg-[#f7f9fb]">
            <th className="py-1">
              <input
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="חיפוש סניף…"
                className="w-full rounded border border-card-border px-1.5 py-0.5 text-xs font-normal"
              />
            </th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="py-1 pl-1">
                <input
                  value={minFilters[c.key] ?? ""}
                  onChange={(e) => setMinFilters((m) => ({ ...m, [c.key]: e.target.value }))}
                  inputMode="decimal"
                  placeholder="מינימום"
                  className="w-full min-w-0 rounded border border-card-border px-1.5 py-0.5 text-xs font-normal"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr key={r.id} className="border-b border-card-border/60 last:border-0">
              <td className="py-1.5 font-bold text-ink">{r.name}</td>
              {COLUMNS.map((c) => (
                <td key={c.key} className={c.bold ? "font-bold" : undefined}>
                  {c.show(r)}
                </td>
              ))}
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length + 1} className="py-4 text-center text-xs text-muted">
                אין סניפים שמתאימים לסינון
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
