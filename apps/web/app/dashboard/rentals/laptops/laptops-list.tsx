"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Wifi, Users } from "lucide-react";
import type { Branch, Laptop } from "@ultranet/shared-types";
import { DeleteLaptopButton } from "./delete-button";

type SortKey = "name" | "branch" | "price";

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

      <div className="flex flex-col gap-2">
        {sorted.length === 0 && (
          <div className="rounded-card border border-card-border bg-white p-5 text-center text-sm text-muted shadow-card">
            אין מחשבים תואמים
          </div>
        )}
        {sorted.map((l) => {
          const deleteAction = deleteActions[l.id];
          return (
          <div
            key={l.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-card-border bg-white p-4 shadow-card"
          >
            <Link href={`/dashboard/rentals/laptops/${l.id}`} className="flex-1 min-w-[220px]">
              <p className="font-bold text-ink">{l.name}</p>
              <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
                <span>
                  ₪{l.dayPrice ?? 0}/יום · ₪{l.weekPrice ?? 0}/שבוע · ₪{l.monthPrice ?? 0}/חודש
                </span>
                {l.hasStick && (
                  <span className="flex items-center gap-1">
                    {"·"}
                    <Wifi className="h-3 w-3" />
                    {`סטיק${l.simNumber ? ` (${l.simNumber})` : ""}`}
                  </span>
                )}
                {l.hasPartner && (
                  <span className="flex items-center gap-1">
                    {"·"}
                    <Users className="h-3 w-3" />
                    {`שותפות ${l.partnerPct ?? 15}%${l.partnerName ? ` (${l.partnerName})` : ""}`}
                  </span>
                )}
                {isOwner && <span>{`· ${branchName(l.branchId)}`}</span>}
              </p>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/rentals/laptops/${l.id}`}
                className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
              >
                עריכה
              </Link>
              {canDelete && deleteAction && <DeleteLaptopButton action={deleteAction} />}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
