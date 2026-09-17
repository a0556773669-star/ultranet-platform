"use client";

import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";

/**
 * הטבלה של ההנה"ח — אחת, לכל הטבלאות שבמסך.
 *
 * כל טבלה במסך הראשי שואלת את אותן שאלות: איפה השורה שחיפשתי, מה הסכום של מה שסיננתי,
 * ואיך מסדרים לפי עמודה. קודם התשובה הזו הייתה כתובה פעם אחת ב-`ledger-table.tsx`
 * ושאר הרשימות פשוט לא קיבלו אותה — רכישות חד-פעמיות היו רשימת `div`-ים בלי חיפוש,
 * והרכישות החוזרות היו טבלה בלי כלום. לכן הסינון, הסידור והעימוד יושבים כאן פעם אחת,
 * וכל טבלה מגדירה רק את העמודות שלה.
 *
 * העמודה מגדירה שתי פונקציות ולא אחת: `value` היא מה שממיינים ומסננים לפיו, `render`
 * הוא מה שרואים. ההפרדה הזו היא מה שמאפשר לעמודה להציג תג או כפתור ועדיין להיות
 * ממוינת — ובלעדיה כל עמודה שאינה טקסט פשוט הייתה יוצאת מהסידור.
 *
 * הסכום בשורת הסינון הוא של השורות **המסוננות** ולא של העמוד, בכוונה: מי שמסנן "חשמל"
 * רוצה לדעת כמה יצא על חשמל, לא כמה יצא על חמישים השורות הראשונות.
 */

const PAGE_SIZES = [25, 50, 100, 250];

const FIELD =
  "rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-xs text-ink focus:border-teal focus:outline-none";
/** גרסה צרה יותר לשדות שיושבים בשורת הסינון לצד עוד כמה — כדי שהשורה תיכנס לשורה אחת. */
const NARROW_FIELD =
  "rounded-lg border border-card-border bg-white px-2 py-1 text-[11px] text-ink focus:border-teal focus:outline-none";

export function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

export interface DataColumn<T> {
  /** מזהה העמודה, משמש גם כמפתח סידור */
  key: string;
  label: string;
  /** רוחב מפורש (`table-fixed`) ומחלקות נוספות לכותרת ולתא */
  className?: string;
  align?: "right" | "left" | "center";
  /** מה שממיינים ומסננים לפיו. חסר = העמודה אינה ניתנת לסידור (עמודת פעולות) */
  value?: (row: T) => string | number;
  /** מה שמוצג בתא */
  render: (row: T) => ReactNode;
  /** מוסיף לשורת הסינון תפריט עם הערכים הייחודיים של העמודה */
  filterable?: boolean;
  /** התווית של "הכל" בתפריט הסינון של העמודה */
  allLabel?: string;
}

type SortDir = "asc" | "desc";

function alignClass(align: DataColumn<unknown>["align"]) {
  return align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right";
}

export function DataTable<T>({
  title,
  icon: Icon,
  rows,
  columns,
  getKey,
  searchText,
  searchHint = "חיפוש בטבלה...",
  dateOf,
  amountOf,
  amountClass = "text-ink",
  total,
  totalLabel,
  defaultSortKey,
  defaultSortDir = "desc",
  emptyText,
  minWidth = 640,
  note,
  toolbar,
  defaultPageSize = 50,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  rows: T[];
  columns: DataColumn<T>[];
  getKey: (row: T) => string;
  /** הטקסט שהחיפוש החופשי רץ עליו */
  searchText: (row: T) => string;
  searchHint?: string;
  /** מפעיל את סינון טווח התאריכים (YYYY-MM-DD) */
  dateOf?: (row: T) => string;
  /** מפעיל את שורת הסיכום של השורות המסוננות */
  amountOf?: (row: T) => number;
  amountClass?: string;
  /** הסכום הכולל שבכותרת, לפני סינון. חסר = סכום כל השורות לפי `amountOf` */
  total?: number;
  totalLabel?: string;
  defaultSortKey?: string;
  defaultSortDir?: SortDir;
  emptyText: string;
  minWidth?: number;
  /** הערה קבועה מתחת לטבלה */
  note?: ReactNode;
  /** פקדים נוספים בשורת הסינון (למשל בחירת חודש) */
  toolbar?: ReactNode;
  defaultPageSize?: number;
}) {
  const [q, setQ] = useState("");
  const [selects, setSelects] = useState<Record<string, string>>({});
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<string>(defaultSortKey ?? "");
  const [sortDir, setSortDir] = useState<SortDir>(defaultSortDir);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(1);

  const filterCols = useMemo(() => columns.filter((c) => c.filterable && c.value), [columns]);

  const options = useMemo(() => {
    const out = new Map<string, string[]>();
    for (const col of filterCols) {
      const values = new Set<string>();
      for (const row of rows) {
        const v = String(col.value!(row) ?? "").trim();
        if (v) values.add(v);
      }
      out.set(col.key, [...values].sort((a, b) => a.localeCompare(b, "he")));
    }
    return out;
  }, [filterCols, rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      for (const col of filterCols) {
        const picked = selects[col.key];
        if (picked && String(col.value!(row) ?? "") !== picked) return false;
      }
      if (dateOf) {
        const d = dateOf(row);
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      if (!needle) return true;
      return searchText(row).toLowerCase().includes(needle);
    });
  }, [rows, filterCols, selects, dateOf, from, to, q, searchText]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey && c.value);
    if (!col) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = col.value!(a);
      const vb = col.value!(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "he") * dir;
    });
  }, [filtered, columns, sortKey, sortDir]);

  const grandTotal = useMemo(
    () => (total !== undefined ? total : amountOf ? rows.reduce((s, r) => s + amountOf(r), 0) : 0),
    [total, amountOf, rows],
  );
  const filteredTotal = useMemo(
    () => (amountOf ? filtered.reduce((s, r) => s + amountOf(r), 0) : 0),
    [amountOf, filtered],
  );

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  const isFiltered = Boolean(q || from || to || Object.values(selects).some(Boolean));

  function sortBy(key: string) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // מספר ותאריך מתחילים מהגדול לקטן — החדש והיקר הם מה שמחפשים קודם.
      const col = columns.find((c) => c.key === key);
      const sample = rows[0];
      const numeric = col?.value && sample !== undefined && typeof col.value(sample) === "number";
      setSortDir(numeric || key === "date" ? "desc" : "asc");
    }
    setPage(1);
  }

  function clearFilters() {
    setQ("");
    setSelects({});
    setFrom("");
    setTo("");
    setPage(1);
  }

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="h-4 w-4" />}
          {title} ({rows.length})
        </span>
        {amountOf && (
          <span className={`rounded-full bg-[#f4f6f9] px-2.5 py-0.5 normal-case ${amountClass}`}>
            {money(grandTotal)}
            {totalLabel ? ` ${totalLabel}` : ""}
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-card-border bg-[#f8fafc] px-3 py-2.5">
          {toolbar}
          <div className="relative min-w-[140px] flex-1">
            <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={searchHint}
              className={`${NARROW_FIELD} w-full py-1.5 pr-8`}
            />
          </div>

          {filterCols.map((col) => (
            <select
              key={col.key}
              aria-label={col.label}
              className={`${NARROW_FIELD} w-[130px] shrink-0`}
              value={selects[col.key] ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setSelects((prev) => ({ ...prev, [col.key]: v }));
                setPage(1);
              }}
            >
              <option value="">{col.allLabel ?? `כל ה${col.label}`}</option>
              {(options.get(col.key) ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ))}

          {/* שני התאריכים נשברים לשורה חדשה יחד ולא אחד-אחד, כדי שכל הטבלאות ישברו
              באותו מקום ושורת הסינון תיראה זהה בכולן */}
          {dateOf && (
            <div className="flex shrink-0 items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                מתאריך
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                  className={NARROW_FIELD}
                />
              </label>
              <label className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                עד
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                  className={NARROW_FIELD}
                />
              </label>
            </div>
          )}

          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-[11px] font-bold text-muted transition hover:bg-[#f4f6f9] hover:text-ink"
            >
              <X className="h-3 w-3" />
              ניקוי סינון
            </button>
          )}
        </div>

        {isFiltered && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border px-3 py-1.5 text-[11.5px] font-semibold text-muted">
            <span>נמצאו {sorted.length} שורות תואמות</span>
            {amountOf && <span className={amountClass}>סה&quot;כ מסונן: {money(filteredTotal)}</span>}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-[13px]" style={{ minWidth }}>
            <thead className="bg-[#f4f6f9]">
              <tr>
                {columns.map((col) => {
                  const active = sortKey === col.key;
                  const SortIcon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
                  return (
                    <th
                      key={col.key}
                      className={`px-[11px] py-[9px] ${alignClass(col.align)} ${col.className ?? ""}`}
                    >
                      {col.value ? (
                        <button
                          type="button"
                          onClick={() => sortBy(col.key)}
                          title={`סידור לפי ${col.label}`}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide transition hover:text-teal ${
                            active ? "text-teal" : "text-muted"
                          }`}
                        >
                          {col.label}
                          <SortIcon className="h-3 w-3" />
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{col.label}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-[11px] py-7 text-center text-sm text-muted">
                    {rows.length === 0 ? emptyText : "אין שורות שמתאימות לסינון"}
                  </td>
                </tr>
              )}
              {visible.map((row) => (
                <tr
                  key={getKey(row)}
                  className="border-t border-card-border align-middle transition hover:bg-[#f8fafc]"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-[11px] py-1.5 ${alignClass(col.align)} ${col.className ?? ""}`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sorted.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-card-border bg-[#f8fafc] px-3 py-2 text-[11.5px] font-semibold text-muted">
            <span className="tabular-nums">
              מציג {start + 1}–{Math.min(start + pageSize, sorted.length)} מתוך {sorted.length}
            </span>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1">
                שורות בעמוד
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className={FIELD}
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="inline-flex items-center gap-0.5 rounded-lg border border-card-border bg-white px-2 py-1 font-bold text-ink transition hover:bg-[#f4f6f9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  הקודם
                </button>
                <span className="px-1 tabular-nums">
                  עמוד {currentPage} מתוך {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= pageCount}
                  className="inline-flex items-center gap-0.5 rounded-lg border border-card-border bg-white px-2 py-1 font-bold text-ink transition hover:bg-[#f4f6f9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  הבא
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {note && <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-muted">{note}</p>}
    </section>
  );
}
