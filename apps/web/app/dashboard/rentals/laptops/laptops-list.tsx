"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Wifi, Users, Check, Minus } from "lucide-react";
import type { Branch, Laptop } from "@ultranet/shared-types";
import { DeleteLaptopButton } from "./delete-button";

type SortKey = "name" | "branch" | "price";

const TH = "px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap text-[13px]";

/** מחיר "עם סטיק", ומתחתיו מחיר "בלי סטיק" אם הוגדר נפרד. */
function priceCell(withStick: number | undefined, withoutStick: number | undefined) {
  return (
    <>
      <div>₪{Math.round(withStick ?? 0)}</div>
      {withoutStick && withoutStick > 0 ? (
        <div className="text-[11px] text-muted">בלי סטיק: ₪{Math.round(withoutStick)}</div>
      ) : null}
    </>
  );
}

export function LaptopsList({
  laptops,
  branches,
  isOwner,
  canDelete,
  deleteActions,
}: {
  laptops: Laptop[];
  branches: Branch[];
  isOwner: boolean;
  canDelete: boolean;
  deleteActions: Record<string, () => void>;
}) {
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "-";

  const toggleBranch = (id: string) => {
    setSelectedBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const filtered = useMemo(() => {
    if (selectedBranchIds.length === 0) return laptops;
    const set = new Set(selectedBranchIds);
    return laptops.filter((l) => set.has(l.branchId));
  }, [laptops, selectedBranchIds]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const nameById = new Map(branches.map((b) => [b.id, b.name]));
    const nameOf = (id: string) => nameById.get(id) ?? "-";
    return [...filtered].sort((a, b) => {
      if (sortKey === "branch") {
        return dir * nameOf(a.branchId).localeCompare(nameOf(b.branchId), "he", { numeric: true });
      }
      if (sortKey === "price") {
        return dir * ((a.dayPrice ?? 0) - (b.dayPrice ?? 0));
      }
      return dir * a.name.localeCompare(b.name, "he", { numeric: true });
    });
  }, [filtered, sortKey, sortDir, branches]);

  return (
    <div>
      {isOwner && branches.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted">סינון לפי סניף:</span>
          <button
            type="button"
            onClick={() => setSelectedBranchIds([])}
            className={`rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${
              selectedBranchIds.length === 0
                ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-primary"
                : "border border-card-border bg-white text-ink hover:bg-[#f4f6f9]"
            }`}
          >
            הכל
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleBranch(b.id)}
              className={`rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${
                selectedBranchIds.includes(b.id)
                  ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-primary"
                  : "border border-card-border bg-white text-ink hover:bg-[#f4f6f9]"
              }`}
            >
              {b.name}
            </button>
          ))}

          <div className="mr-auto flex items-center gap-2">
            <span className="text-xs font-bold text-muted">מיון:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-[10px] border border-card-border bg-white px-2 py-1.5 text-xs font-semibold text-ink focus:border-teal focus:outline-none"
            >
              <option value="name">שם</option>
              <option value="branch">סניף</option>
              <option value="price">מחיר ליום</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
              title="הפוך כיוון מיון"
            >
              {sortDir === "asc" ? "עולה ↑" : "יורד ↓"}
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-card border border-card-border bg-white p-5 text-center text-sm text-muted shadow-card">
          אין מחשבים תואמים
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-card-border bg-[#f4f6f9]">
                  <th className={TH}>שם</th>
                  {isOwner && <th className={TH}>סניף</th>}
                  <th className={TH}>מחיר ליום</th>
                  <th className={TH}>מחיר לשבוע</th>
                  <th className={TH}>מחיר לחודש</th>
                  <th className={TH}>סטיק</th>
                  <th className={TH}>שותפות</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {sorted.map((l, idx) => {
                  const deleteAction = deleteActions[l.id];
                  return (
                    <tr key={l.id} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                      <td className={`${TD} font-bold text-ink`}>
                        <Link href={`/dashboard/rentals/laptops/${l.id}`} className="hover:underline">
                          {l.name}
                        </Link>
                      </td>
                      {isOwner && <td className={`${TD} text-muted`}>{branchName(l.branchId)}</td>}
                      <td className={TD}>{priceCell(l.dayPrice, l.altPricing ? l.noInternetDayPrice : 0)}</td>
                      <td className={TD}>{priceCell(l.weekPrice, l.altPricing ? l.noInternetWeekPrice : 0)}</td>
                      <td className={TD}>{priceCell(l.monthPrice, l.altPricing ? l.noInternetMonthPrice : 0)}</td>
                      <td className={TD}>
                        {l.hasStick ? (
                          <span className="flex items-center gap-1 text-teal-dark">
                            <Wifi className="h-3.5 w-3.5" />
                            {l.simNumber || <Check className="h-3.5 w-3.5" />}
                          </span>
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-muted" />
                        )}
                      </td>
                      <td className={TD}>
                        {l.hasPartner ? (
                          <span className="flex items-center gap-1 text-ink">
                            <Users className="h-3.5 w-3.5" />
                            {`${l.partnerPct ?? 15}%${l.partnerName ? ` (${l.partnerName})` : ""}`}
                          </span>
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-muted" />
                        )}
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/rentals/laptops/${l.id}`}
                            className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
                          >
                            עריכה
                          </Link>
                          {canDelete && deleteAction && <DeleteLaptopButton action={deleteAction} />}
                        </div>
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
