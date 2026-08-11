"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { BranchFinancials } from "@/lib/branch-accounting-data";
import { PROFIT_PER_COMPUTER_TARGET } from "@/lib/branch-accounting";
import { ComputerProfitTable } from "./computer-profit-table";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function MiniStats({ f }: { f: BranchFinancials }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
      <div>
        <div className="text-muted">הוצאתי עד היום (עלי / חצי אם משותף)</div>
        <div className="font-bold text-ink">{money(f.ownerInvestedToDate)}</div>
      </div>
      <div>
        <div className="text-muted">הכנסתי עד היום</div>
        <div className="font-bold text-ink">{money(f.ownerEarnedToDate)}</div>
      </div>
      <div>
        <div className="text-muted">מאזן</div>
        <div className={`font-bold ${f.ownerBalanceToDate >= 0 ? "text-teal-dark" : "text-red-600"}`}>
          {money(f.ownerBalanceToDate)}
        </div>
      </div>
      </div>
      {f.computerProfitTrend && f.computerProfitTrend.length > 0 && (
        <div className="mt-2">
          <h3 className="mb-1 text-[10px] font-bold text-ink">{`רווח פר מחשב לחודש (יעד: ${PROFIT_PER_COMPUTER_TARGET} ₪ = 150 ₪ + מע"מ)`}</h3>
          <ComputerProfitTable trend={f.computerProfitTrend} compact />
        </div>
      )}
    </div>
  );
}

type Props = {
  parents: BranchFinancials[];
  childrenByParent: Record<string, BranchFinancials[]>;
};

export function OwnerBranchesOverview({ parents, childrenByParent }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Flat list of every branch (parents + children) for the filter checkboxes and the filtered view.
  const flat = useMemo(() => {
    const rows: { f: BranchFinancials; isChild: boolean; parentName?: string }[] = [];
    for (const p of parents) {
      rows.push({ f: p, isChild: false });
      for (const k of childrenByParent[p.branch.id] ?? []) {
        rows.push({ f: k, isChild: true, parentName: p.branch.name });
      }
    }
    return rows.sort((a, b) => a.f.branch.name.localeCompare(b.f.branch.name, "he"));
  }, [parents, childrenByParent]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const filteredFlat = selectedIds.length > 0 ? flat.filter((r) => selectedIds.includes(r.f.branch.id)) : flat;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold text-ink">מעקב התקדמות הסניפים</h2>

      {flat.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-card border border-card-border bg-white p-3">
          <span className="ml-1 text-xs font-bold text-muted">סימון סניפים לתצוגה:</span>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className={`rounded-[10px] px-2.5 py-1 text-xs font-bold transition ${
              selectedIds.length === 0
                ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-primary"
                : "border border-card-border bg-white text-ink hover:bg-[#f4f6f9]"
            }`}
          >
            הכל
          </button>
          {flat.map(({ f, isChild }) => (
            <label
              key={f.branch.id}
              className={`flex cursor-pointer items-center gap-1.5 rounded-[10px] border px-2.5 py-1 text-xs font-bold transition ${
                selectedIds.includes(f.branch.id)
                  ? "border-teal bg-teal-bg text-teal-dark"
                  : "border-card-border bg-white text-ink hover:bg-[#f4f6f9]"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(f.branch.id)}
                onChange={() => toggle(f.branch.id)}
                className="h-3.5 w-3.5 accent-teal"
              />
              {isChild ? `↳ ${f.branch.name}` : f.branch.name}
            </label>
          ))}
        </div>
      )}

      {selectedIds.length === 0 ? (
        parents.map((p) => {
          const kids = childrenByParent[p.branch.id] ?? [];
          const combined = kids.reduce(
            (acc, k) => ({
              invested: acc.invested + k.ownerInvestedToDate,
              earned: acc.earned + k.ownerEarnedToDate,
              balance: acc.balance + k.ownerBalanceToDate,
            }),
            { invested: p.ownerInvestedToDate, earned: p.ownerEarnedToDate, balance: p.ownerBalanceToDate }
          );
          return (
            <div key={p.branch.id} className="rounded-card border border-card-border bg-white p-4">
              <div className="flex items-center justify-between">
                <Link
                  href={`/dashboard/rentals/accounting?branchId=${p.branch.id}#branch-history`}
                  className="text-sm font-extrabold text-ink hover:underline"
                  title="מעקב היסטוריה מלאה על הסניף הזה"
                >
                  {p.branch.name}
                </Link>
                {kids.length > 0 && <span className="text-[11px] text-muted">כולל {kids.length} תתי-סניף</span>}
              </div>
              {kids.length > 0 ? (
                <div className="mt-2 grid grid-cols-3 gap-2 rounded-[10px] bg-[#f4f6f9] p-2 text-center text-xs">
                  <div>
                    <div className="text-muted">השקעתי (הכל)</div>
                    <div className="font-bold text-ink">{money(combined.invested)}</div>
                  </div>
                  <div>
                    <div className="text-muted">הרווחתי (הכל)</div>
                    <div className="font-bold text-ink">{money(combined.earned)}</div>
                  </div>
                  <div>
                    <div className="text-muted">מאזן (הכל)</div>
                    <div className={`font-bold ${combined.balance >= 0 ? "text-teal-dark" : "text-red-600"}`}>
                      {money(combined.balance)}
                    </div>
                  </div>
                </div>
              ) : null}
              <MiniStats f={p} />
              {kids.map((k) => (
                <div key={k.branch.id} className="mt-2 rounded-[10px] border border-card-border bg-[#fafbfc] p-3">
                  <Link
                    href={`/dashboard/rentals/accounting?branchId=${k.branch.id}#branch-history`}
                    className="text-xs font-bold text-ink hover:underline"
                    title="מעקב היסטוריה מלאה על הסניף הזה"
                  >
                    {k.branch.name} (תת-סניף)
                  </Link>
                  <MiniStats f={k} />
                </div>
              ))}
            </div>
          );
        })
      ) : (
        <div className="space-y-2">
          {filteredFlat.map(({ f, isChild, parentName }) => (
            <div key={f.branch.id} className="rounded-card border border-card-border bg-white p-4">
              <Link
                href={`/dashboard/rentals/accounting?branchId=${f.branch.id}#branch-history`}
                className="text-sm font-extrabold text-ink hover:underline"
                title="מעקב היסטוריה מלאה על הסניף הזה"
              >
                {f.branch.name}
                {isChild && parentName ? ` (תת-סניף של ${parentName})` : ""}
              </Link>
              <MiniStats f={f} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
