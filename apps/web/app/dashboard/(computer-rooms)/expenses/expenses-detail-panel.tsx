"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ListFilter, Table2, X } from "lucide-react";
import type { FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { CountsToMainBadge } from "@/components/counts-to-main-field";
import { EditFixedExpenseModal, EditVariableExpenseModal } from "./edit-expense-modals";

const TH = "px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-2.5 py-1.5 align-top";
const SELECT =
  "rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-xs font-semibold text-ink focus:border-teal focus:outline-none";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

export interface ExpenseDetailRow {
  /** הספר שההוצאה שמורה בו: סניף אמיתי או הספר המשותף */
  branchId: string;
  branchLabel: string;
  /** מי השותף בספר הזה — נדרש לטופס העריכה */
  isPartner: boolean;
  ownerName: string;
  partnerName: string;
  /** ההוצאה שמורה בספר המשותף ולא תחת סניף — רק שם יש היקף סניפים לערוך */
  isShared: boolean;
  /** תווית "על אילו סניפים ההוצאה חלה", בהוצאה משותפת בלבד */
  scopeNote?: string;
  payerNote?: string;
  countsToMain: boolean;
  /** התאריך שלפיו ממיינים: תאריך ההוצאה, או תאריך תחילתה בהוצאה קבועה */
  date: string;
  fixed?: FixedExpense;
  variable?: VariableExpense;
}

/**
 * פירוט כל ההוצאות של כל הסניפים — טבלה אחת, סגורה כברירת מחדל.
 *
 * במסך ההוצאות מגיעים כמעט תמיד כדי *לרשום* הוצאה, לא כדי לקרוא את ההיסטוריה. לכן רשימת
 * כל ההוצאות של כל הסניפים לא פרושה על המסך אלא יושבת מאחורי כפתור אחד: מי שרוצה לראות
 * פותח, ומי שבא לרשום לא צריך לגלול מעליה. בפנים ההוצאה האחרונה למעלה — כי מה שמחפשים
 * בטבלה כזו הוא כמעט תמיד מה שקרה עכשיו — וכל שורה ניתנת לעריכה במקום.
 */
export function ExpensesDetailPanel({
  rows,
  branches,
}: {
  rows: ExpenseDetailRow[];
  /** רשימת הבחירה של "על אילו סניפים ההוצאה חלה" בעריכת הוצאה משותפת */
  branches: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [kind, setKind] = useState<"" | "fixed" | "variable">("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");

  const branchOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) if (!seen.has(r.branchId)) seen.set(r.branchId, r.branchLabel);
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [rows]);

  const categoryOptions = useMemo(
    () => [...new Set(rows.map((r) => (r.fixed ?? r.variable)?.category).filter((c): c is string => Boolean(c)))].sort(
      (a, b) => a.localeCompare(b, "he"),
    ),
    [rows],
  );

  const sorted = useMemo(() => [...rows].sort((a, b) => b.date.localeCompare(a.date)), [rows]);

  const filtered = sorted.filter((r) => {
    if (branchId && r.branchId !== branchId) return false;
    if (kind === "fixed" && !r.fixed) return false;
    if (kind === "variable" && !r.variable) return false;
    const e = r.fixed ?? r.variable;
    if (category && e?.category !== category) return false;
    if (q.trim()) {
      const text = `${r.fixed?.name ?? r.variable?.desc ?? ""} ${r.branchLabel} ${e?.category ?? ""}`;
      if (!text.toLowerCase().includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  const total = filtered.reduce((sum, r) => sum + ((r.fixed ?? r.variable)?.amount || 0), 0);
  const hasFilter = Boolean(branchId || kind || category || q.trim());

  function clearFilters() {
    setBranchId("");
    setKind("");
    setCategory("");
    setQ("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-5 py-2 text-sm font-bold text-ink shadow-card transition hover:border-teal hover:text-teal"
        >
          <Table2 className="h-4 w-4" />
          {open ? "סגירת טבלה" : "פירוט הוצאות"}
        </button>
      </div>

      {open && (
        <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-card-border bg-[#f8fafc] px-3 py-2.5">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted">
              <ListFilter className="h-3.5 w-3.5" />
              סינון
            </span>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={SELECT}>
              <option value="">כל הסניפים</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
            <select value={kind} onChange={(e) => setKind(e.target.value as "" | "fixed" | "variable")} className={SELECT}>
              <option value="">כל הסוגים</option>
              <option value="fixed">קבועות / חודשיות</option>
              <option value="variable">חד פעמיות</option>
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={SELECT}>
              <option value="">כל הקטגוריות</option>
              {categoryOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש חופשי"
              className={`${SELECT} w-36 font-normal`}
            />
            {hasFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 text-[11.5px] font-bold text-teal hover:underline"
              >
                <X className="h-3.5 w-3.5" />
                ניקוי
              </button>
            )}
            <span className="mr-auto text-[11.5px] font-semibold text-muted">
              {filtered.length} שורות · {money(total)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] border-collapse text-right text-[13px]">
              <thead>
                <tr className="border-b border-card-border bg-[#f4f6f9]">
                  <th className={TH}>תאריך</th>
                  <th className={TH}>סניף</th>
                  <th className={TH}>סוג</th>
                  <th className={TH}>הוצאה</th>
                  <th className={TH}>קטגוריה</th>
                  <th className={TH}>סכום</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2.5 py-6 text-center text-sm text-muted">
                      {rows.length === 0 ? "עדיין לא נרשמו הוצאות" : "אין הוצאות שמתאימות לסינון"}
                    </td>
                  </tr>
                )}
                {filtered.map((r, idx) => {
                  const e = r.fixed ?? r.variable;
                  if (!e) return null;
                  return (
                    <tr key={`${r.fixed ? "f" : "v"}-${e.id}`} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                      <td className={`${TD} whitespace-nowrap text-muted`}>{r.date}</td>
                      <td className={`${TD} whitespace-nowrap font-semibold text-ink`}>
                        {/* הספר של הסניף עצמו נשאר במרחק לחיצה: שם יושבים חלקו בהוצאות
                            המשותפות, ההוצאות הקבועות-המשתנות שלו ומאזן החובות מול השותף. */}
                        <Link href={`/dashboard/expenses/${r.branchId}`} className="hover:text-teal hover:underline">
                          {r.branchLabel}
                        </Link>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-muted`}>{r.fixed ? "קבועה" : "חד פעמית"}</td>
                      <td className={TD}>
                        <span className="flex flex-wrap items-center gap-1.5 font-bold text-ink">
                          {r.fixed?.name ?? r.variable?.desc}
                          <CountsToMainBadge on={r.countsToMain} />
                        </span>
                        {(r.scopeNote || r.payerNote || r.fixed?.endDate) && (
                          <span className="mt-0.5 block text-[11px] text-muted">
                            {[r.fixed?.endDate ? `הסתיימה ${r.fixed.endDate}` : "", r.payerNote, r.scopeNote]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        )}
                      </td>
                      <td className={`${TD} whitespace-nowrap text-muted`}>{e.category || "—"}</td>
                      <td className={`${TD} whitespace-nowrap font-semibold text-red-600`}>
                        {money(e.amount || 0)}
                        {r.fixed && <span className="text-[11px] font-normal text-muted">/חודש</span>}
                      </td>
                      <td className={`${TD} text-left`}>
                        {r.fixed ? (
                          <EditFixedExpenseModal
                            expense={r.fixed}
                            branchId={r.branchId}
                            isPartner={r.isPartner}
                            ownerName={r.ownerName}
                            partnerName={r.partnerName}
                            isShared={r.isShared}
                            branches={branches}
                          />
                        ) : (
                          <EditVariableExpenseModal
                            expense={r.variable!}
                            branchId={r.branchId}
                            isPartner={r.isPartner}
                            ownerName={r.ownerName}
                            partnerName={r.partnerName}
                            isShared={r.isShared}
                            branches={branches}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
