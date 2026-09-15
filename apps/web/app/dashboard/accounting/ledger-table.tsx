"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { IssueReceiptButton } from "./receipt-button";
import { DeleteEntryButton } from "./delete-entry-button";

/**
 * טבלת הספר הראשי — הכנסות או הוצאות, אותה טבלה בדיוק.
 *
 * הרשימות הישנות לא סבלו עומס: אלף שורות ירדו במסך אחד ארוך, בלי דרך למצוא שורה
 * מסוימת ובלי דרך לסדר. כאן זו טבלה: כותרות שאפשר ללחוץ עליהן כדי לסדר, סינון למעלה
 * (חיפוש חופשי, קטגוריה, מקור, טווח תאריכים), ו-50 שורות לעמוד. הסינון והסידור קורים
 * בצד הלקוח על כל השורות שכבר הגיעו מהשרת — הספר הראשי נטען ממילא במלואו כדי לחשב את
 * הסכומים למעלה, ולכן עמוד חדש לא עולה קריאה נוספת.
 *
 * הטבלה בנויה לחצי מסך, כי שתיהן יושבות זו לצד זו: העמודות צרות, שורת הסינון נשברת
 * לשתי שורות כשצריך, וגלילה אופקית היא מוצא אחרון ולא ברירת מחדל.
 *
 * כשסינון פעיל מופיעה מעל הטבלה שורת סיכום, והסכום בה הוא של השורות **המסוננות** ולא
 * של העמוד, ובכוונה: מי שמסנן "חשמל" רוצה לדעת כמה יצא על חשמל, לא כמה יצא על חמישים
 * השורות הראשונות. הסכום שבכותרת, לצד שם הטבלה, נשאר תמיד הסכום המלא של הספר.
 */

const PAGE_SIZES = [25, 50, 100, 250];
const DEFAULT_PAGE_SIZE = 50;

export interface LedgerTableRow {
  /** מזהה ייחודי לשורה בטבלה (source|id) */
  key: string;
  /** מזהה המסמך עצמו — נדרש למחיקה ולהפקת קבלה */
  id: string;
  date: string;
  desc: string;
  amount: number;
  origin: string;
  category: string;
  /** הכנסות בלבד: למי נמכר, ומצב המסמך. `receipt` קיים רק כשמותר להפיק מסמך על השורה. */
  soldTo?: string;
  receipt?: { issued: boolean; docNumber?: string; clientName?: string };
  deletable?: boolean;
}

type SortKey = "date" | "desc" | "category" | "origin" | "amount";
type SortDir = "asc" | "desc";

const FIELD =
  "rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-xs text-ink focus:border-teal focus:outline-none";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "he"));
}

function SortHeader({
  label,
  keyName,
  sortKey,
  sortDir,
  onSort,
  align = "right",
  className = "",
}: {
  label: string;
  keyName: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "right" | "left";
  className?: string;
}) {
  const active = sortKey === keyName;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`px-[11px] py-[9px] ${align === "left" ? "text-left" : "text-right"} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(keyName)}
        title={`סידור לפי ${label}`}
        className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide transition hover:text-teal ${
          active ? "text-teal" : "text-muted"
        }`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

export function LedgerTable({
  kind,
  rows,
  total,
  emptyText,
  deleteAction,
}: {
  kind: "income" | "expense";
  rows: LedgerTableRow[];
  /** הסכום הכולל של הספר, לפני סינון — הכותרת מציגה אותו גם כשמסננים */
  total: number;
  emptyText: string;
  /** נמסר רק להכנסות, ורק הוא מפעיל את עמודת המחיקה */
  deleteAction?: (id: string) => Promise<void>;
}) {
  const isIncome = kind === "income";
  const amountClass = isIncome ? "text-emerald-600" : "text-red-600";

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [origin, setOrigin] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);

  const categories = useMemo(() => uniqueSorted(rows.map((r) => r.category)), [rows]);
  const origins = useMemo(() => uniqueSorted(rows.map((r) => r.origin)), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (category && r.category !== category) return false;
      if (origin && r.origin !== origin) return false;
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      if (!needle) return true;
      return (
        r.desc.toLowerCase().includes(needle) ||
        r.origin.toLowerCase().includes(needle) ||
        r.category.toLowerCase().includes(needle) ||
        (r.soldTo ?? "").toLowerCase().includes(needle) ||
        String(Math.round(r.amount)).includes(needle)
      );
    });
  }, [rows, q, category, origin, from, to]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "amount") return (a.amount - b.amount) * dir;
      if (sortKey === "date") return a.date.localeCompare(b.date) * dir;
      return (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "", "he") * dir;
    });
  }, [filtered, sortKey, sortDir]);

  const filteredTotal = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  const isFiltered = Boolean(q || category || origin || from || to);

  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // תאריך וסכום מתחילים מהגדול לקטן — החדש והיקר הם מה שמחפשים קודם.
      setSortDir(key === "date" || key === "amount" ? "desc" : "asc");
    }
    setPage(1);
  }

  function clearFilters() {
    setQ("");
    setCategory("");
    setOrigin("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  const sortProps = { sortKey, sortDir, onSort: sortBy };

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        <span>
          {isIncome ? "הכנסות" : "הוצאות שמתחשבנות בראשי"} ({rows.length})
        </span>
        <span className={`rounded-full bg-[#f4f6f9] px-2.5 py-0.5 normal-case ${amountClass}`}>{money(total)}</span>
      </div>

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-card-border bg-[#f8fafc] px-3 py-2.5">
          <div className="relative min-w-[150px] flex-1">
            <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="חיפוש בתיאור, במקור, בקטגוריה או בסכום..."
              className={`${FIELD} w-full pr-8`}
            />
          </div>

          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className={FIELD}
          >
            <option value="">כל הקטגוריות</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value);
              setPage(1);
            }}
            className={FIELD}
          >
            <option value="">כל המקורות</option>
            {origins.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1 text-[11px] font-semibold text-muted">
            מתאריך
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className={FIELD}
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
              className={FIELD}
            />
          </label>

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
            <span className={amountClass}>סה&quot;כ מסונן: {money(filteredTotal)}</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-[13px]">
            <thead className="bg-[#f4f6f9]">
              <tr>
                <SortHeader {...sortProps} label="תאריך" keyName="date" className="w-[92px]" />
                <SortHeader {...sortProps} label="תיאור" keyName="desc" />
                <SortHeader
                  {...sortProps}
                  label={isIncome ? "סוג" : "קטגוריה"}
                  keyName="category"
                  className="w-[104px]"
                />
                <SortHeader {...sortProps} label="מקור" keyName="origin" className="w-[104px]" />
                <SortHeader {...sortProps} label="סכום" keyName="amount" align="left" className="w-[96px]" />
                {isIncome && <th className="w-[128px] px-[11px] py-[9px]" />}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={isIncome ? 6 : 5} className="px-[11px] py-7 text-center text-sm text-muted">
                    {rows.length === 0 ? emptyText : "אין שורות שמתאימות לסינון"}
                  </td>
                </tr>
              )}
              {visible.map((r) => (
                <tr key={r.key} className="border-t border-card-border align-top transition hover:bg-[#f8fafc]">
                  <td className="whitespace-nowrap px-[11px] py-2 text-muted tabular-nums">{r.date}</td>
                  <td className="px-[11px] py-2 font-semibold text-ink">
                    {r.desc}
                    {r.soldTo && <span className="mr-1.5 text-[11px] font-normal text-muted">· נמכר ל{r.soldTo}</span>}
                  </td>
                  <td className="px-[11px] py-2 text-muted">{r.category || "—"}</td>
                  <td className="px-[11px] py-2 text-muted">{r.origin}</td>
                  <td className={`whitespace-nowrap px-[11px] py-2 text-left font-extrabold tabular-nums ${amountClass}`}>
                    {money(r.amount)}
                  </td>
                  {isIncome && (
                    <td className="px-[11px] py-2">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {/* מסמך מופק רק על כסף שלא נסלק: העברה מסניף ניידים, ומזומן שנמשך
                            מקופה. שורת אשראי לא מקבלת כפתור בכלל - נדרים פלוס כבר הפיק עליה
                            חשבונית מס קבלה, ומסמך שני היה כפילות. הכלל נאכף גם בשרת
                            (`receipt-actions.ts`), כי כפתור מוסתר הוא לא אכיפה. */}
                        {r.receipt && (
                          <IssueReceiptButton
                            incomeId={r.id}
                            amount={r.amount}
                            receiptIssued={r.receipt.issued}
                            receiptDocNumber={r.receipt.docNumber}
                            defaultClientName={r.receipt.clientName}
                          />
                        )}
                        {r.deletable && deleteAction && (
                          <DeleteEntryButton
                            confirmText="למחוק את שורת ההכנסה?"
                            action={() => deleteAction(r.id)}
                            successText="ההכנסה נמחקה"
                          />
                        )}
                      </div>
                    </td>
                  )}
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
    </section>
  );
}
