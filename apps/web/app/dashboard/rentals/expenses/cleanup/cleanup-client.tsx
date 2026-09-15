"use client";
/** ראה `./types.ts` — מסך זמני. */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Search } from "lucide-react";
import { useToast } from "@/lib/toast";
import { bulkDeleteRentalsExpensesAction } from "./actions";
import { KIND_LABEL, KIND_SHORT, typeLabelOf, type CleanupExpenseKind, type CleanupGroup, type CleanupRow } from "./types";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-[13px] focus:border-teal focus:bg-white focus:outline-none";

const KIND_BADGE: Record<CleanupExpenseKind, string> = {
  fixed: "bg-indigo-50 text-indigo-700 border-indigo-200",
  variable: "bg-sky-50 text-sky-700 border-sky-200",
  multi: "bg-amber-50 text-amber-800 border-amber-200",
};

function keyOf(row: { kind: CleanupExpenseKind; id: string }): string {
  return `${row.kind}:${row.id}`;
}

function shekels(n: number): string {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function payerNote(row: CleanupRow): string {
  const paid = row.paidBy === "partner" ? "שילם: השותף" : "שילם: אני";
  const owed = row.owedBy === "partner" ? "חוב: השותף" : row.owedBy === "shared" ? "חוב: משותף" : "חוב: אני";
  return `${paid} · ${owed}`;
}

export function ExpenseCleanupClient({ groups }: { groups: CleanupGroup[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [kindFilter, setKindFilter] = useState<"all" | CleanupExpenseKind>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  const allRows = useMemo(() => groups.flatMap((g) => g.rows), [groups]);

  const typeOptions = useMemo(
    () => [...new Set(allRows.map(typeLabelOf))].sort((a, b) => a.localeCompare(b, "he")),
    [allRows],
  );

  /** הקבוצות אחרי סינון — הן גם מה שמסומן ב"סמן את כל המוצג". */
  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        rows: group.rows.filter((row) => {
          if (kindFilter !== "all" && row.kind !== kindFilter) return false;
          if (typeFilter !== "all" && typeLabelOf(row) !== typeFilter) return false;
          if (q && !`${row.desc} ${typeLabelOf(row)} ${row.date}`.toLowerCase().includes(q)) return false;
          return true;
        }),
      }))
      .filter((group) => group.rows.length > 0);
  }, [groups, kindFilter, typeFilter, query]);

  const visibleRows = useMemo(() => visibleGroups.flatMap((g) => g.rows), [visibleGroups]);
  const selectedRows = useMemo(() => allRows.filter((r) => selected.has(keyOf(r))), [allRows, selected]);
  const selectedTotal = selectedRows.reduce((sum, r) => sum + r.amount, 0);

  function toggle(row: CleanupRow) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = keyOf(row);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function setMany(rows: CleanupRow[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const row of rows) {
        if (on) next.add(keyOf(row));
        else next.delete(keyOf(row));
      }
      return next;
    });
  }

  function handleDelete() {
    if (selectedRows.length === 0) return;
    const ok = confirm(
      `למחוק ${selectedRows.length} שורות הוצאה (${shekels(selectedTotal)})?\n\nהמחיקה סופית ולא ניתנת לשחזור.`,
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        const result = await bulkDeleteRentalsExpensesAction(selectedRows.map((r) => ({ id: r.id, kind: r.kind })));
        setSelected(new Set());
        router.refresh();
        showSuccess(
          result.skipped > 0
            ? `נמחקו ${result.deleted} שורות · ${result.skipped} דולגו (כבר נמחקו או לא שייכות למסך)`
            : `נמחקו ${result.deleted} שורות`,
        );
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה במחיקה");
      }
    });
  }

  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((r) => selected.has(keyOf(r)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-card border border-card-border bg-white p-3 shadow-card">
        <div className="relative">
          <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש בתיאור / בסוג"
            className={`${FIELD} pr-8`}
          />
        </div>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)} className={FIELD}>
          <option value="all">כל סוגי הרישום</option>
          <option value="fixed">{KIND_LABEL.fixed}</option>
          <option value="variable">{KIND_LABEL.variable}</option>
          <option value="multi">{KIND_LABEL.multi}</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={FIELD}>
          <option value="all">כל סוגי ההוצאה</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setMany(visibleRows, !allVisibleSelected)}
          className="rounded-lg border border-card-border px-3 py-1.5 text-[12px] font-bold text-ink transition hover:bg-[#f4f6f9]"
        >
          {allVisibleSelected ? "בטל סימון של המוצג" : `סמן את כל המוצג (${visibleRows.length})`}
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="rounded-lg border border-card-border px-3 py-1.5 text-[12px] font-bold text-muted transition hover:bg-[#f4f6f9]"
          >
            נקה סימון
          </button>
        )}
      </div>

      {visibleGroups.length === 0 && (
        <div className="rounded-card border border-card-border bg-white p-6 text-center text-sm text-muted shadow-card">
          אין שורות שמתאימות לסינון
        </div>
      )}

      {visibleGroups.map((group) => {
        const groupSelected = group.rows.every((r) => selected.has(keyOf(r)));
        const groupTotal = group.rows.reduce((sum, r) => sum + r.amount, 0);
        return (
          <div key={group.key} className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
            <div className="flex flex-wrap items-center gap-2 border-b border-card-border bg-[#f4f6f9] px-3 py-2">
              <label className="flex items-center gap-2 text-[13px] font-extrabold text-ink">
                <input
                  type="checkbox"
                  checked={groupSelected}
                  onChange={(e) => setMany(group.rows, e.target.checked)}
                  className="h-4 w-4 accent-teal"
                />
                {group.title}
              </label>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-muted">
                {group.rows.length} שורות · {shekels(groupTotal)}
              </span>
              {group.note && <span className="text-[11px] text-muted">{group.note}</span>}
            </div>
            <table className="w-full text-right text-[12.5px]">
              <thead>
                <tr className="border-b border-card-border text-[11px] uppercase tracking-wide text-muted">
                  <th className="w-9 px-2 py-1.5"></th>
                  <th className="px-2 py-1.5 font-bold">תאריך</th>
                  <th className="px-2 py-1.5 font-bold">תיאור</th>
                  <th className="px-2 py-1.5 font-bold">סוג ההוצאה</th>
                  <th className="px-2 py-1.5 font-bold">רישום</th>
                  <th className="px-2 py-1.5 font-bold">הנה&quot;ח</th>
                  <th className="px-2 py-1.5 text-left font-bold">סכום</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => {
                  const isSelected = selected.has(keyOf(row));
                  return (
                    <tr
                      key={keyOf(row)}
                      onClick={() => toggle(row)}
                      className={`cursor-pointer border-b border-card-border last:border-b-0 ${
                        isSelected ? "bg-red-50" : "hover:bg-[#fafbfc]"
                      }`}
                    >
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(row)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 accent-teal"
                        />
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-muted">
                        {row.date || "—"}
                        {row.endDate && <div className="text-[10.5px]">הופסקה: {row.endDate}</div>}
                      </td>
                      <td className="px-2 py-1.5 font-bold text-ink">
                        {row.desc}
                        <div className="text-[10.5px] font-normal text-muted">{payerNote(row)}</div>
                        {row.scopeNote && <div className="text-[10.5px] font-normal text-muted">{row.scopeNote}</div>}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="font-bold text-ink">{typeLabelOf(row)}</span>
                        {row.typeName && row.category && (
                          <div className="text-[10.5px] text-muted">קטגוריה: {row.category}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${KIND_BADGE[row.kind]}`}>
                          {KIND_SHORT[row.kind]}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-[10.5px] text-muted">
                        {row.countsToMain ? "ראשי" : "סניף בלבד"}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1.5 text-left font-extrabold text-red-600">
                        {shekels(row.amount)}
                        {row.kind === "fixed" && <span className="text-[10px] font-normal text-muted"> /חודש</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}

      {selected.size > 0 && (
        <div className="sticky bottom-3 z-50 mx-auto flex items-center gap-3 rounded-full border border-card-border bg-white px-4 py-2 shadow-lg">
          <span className="text-[13px] font-bold text-ink">
            {selected.size} שורות מסומנות · {shekels(selectedTotal)}
          </span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-[13px] font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {isPending ? "מוחק..." : "מחק את כל המסומנים"}
          </button>
        </div>
      )}
      {toastNode}
    </div>
  );
}
