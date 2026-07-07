"use client";

import { useMemo, useState, useTransition } from "react";
import type { InventorySnapshot, SaveInventoryResult } from "./actions";
import { saveInventoryAction } from "./actions";
import type { BranchKey, InventoryItem } from "@/lib/legacy-inventory";

export function InventoryClient({ snapshot }: { snapshot: InventorySnapshot }) {
  const { branches, products, visibility, inventory } = snapshot;
  const [branch, setBranch] = useState<BranchKey>((branches[0]?.key ?? "lohamim") as BranchKey);
  const [localInventory, setLocalInventory] = useState(inventory);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const branchItems = localInventory[branch] ?? {};
  const branchVisibility = visibility[branch] ?? {};

  const visibleProducts = useMemo(
    () => products.filter((p) => branchVisibility[p] !== false),
    [products, branchVisibility]
  );

  const lowStockCount = useMemo(() => {
    let count = 0;
    for (const p of visibleProducts) {
      const item = branchItems[p] ?? { qty: 0, min: 2 };
      if (item.qty < item.min) count++;
    }
    return count;
  }, [visibleProducts, branchItems]);

  function updateField(product: string, field: "qty" | "min", value: number) {
    setLocalInventory((prev) => {
      const branchData = { ...(prev[branch] ?? {}) };
      const current = branchData[product] ?? { qty: 0, min: 2 };
      branchData[product] = { ...current, [field]: value };
      return { ...prev, [branch]: branchData };
    });
  }

  function handleSave() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const items: Record<string, InventoryItem> = {};
      for (const p of products) {
        items[p] = branchItems[p] ?? { qty: 0, min: 2 };
      }
      const result: SaveInventoryResult = await saveInventoryAction(branch, items);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage("העדכון נשמר בהצלחה");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {branches.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setBranch(b.key as BranchKey)}
            className={
              branch === b.key
                ? "rounded-lg bg-teal px-3.5 py-1.5 text-sm font-semibold text-white transition"
                : "rounded-lg border border-card-border bg-white px-3.5 py-1.5 text-sm font-semibold text-muted transition hover:border-teal hover:text-teal"
            }
          >
            {b.label}
          </button>
        ))}
        {lowStockCount > 0 && (
          <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
            ⚠️ {lowStockCount} פריטים במלאי נמוך
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f4f6f9] text-muted">
            <tr>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מוצר</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">כמות</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מינימום</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((p) => {
              const item = branchItems[p] ?? { qty: 0, min: 2 };
              const low = item.qty < item.min;
              const zero = item.qty === 0;
              return (
                <tr
                  key={p}
                  className={`border-t border-card-border transition hover:bg-[#f8fafc] ${
                    zero ? "bg-red-50" : low ? "bg-amber-50" : ""
                  }`}
                >
                  <td className="px-[11px] py-2 font-semibold text-ink">{p}</td>
                  <td className="px-[11px] py-2">
                    <input
                      type="number"
                      min={0}
                      value={item.qty}
                      onChange={(e) => updateField(p, "qty", Number(e.target.value) || 0)}
                      className="w-20 rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1 text-center focus:border-teal focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-[11px] py-2">
                    <input
                      type="number"
                      min={0}
                      value={item.min}
                      onChange={(e) => updateField(p, "min", Number(e.target.value) || 0)}
                      className="w-20 rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1 text-center focus:border-teal focus:bg-white focus:outline-none"
                    />
                  </td>
                  <td className="px-[11px] py-2">
                    {zero ? (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">חסר</span>
                    ) : low ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">נמוך</span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">תקין</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {message && <p className="text-sm font-medium text-emerald-600">{message}</p>}
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2.5 text-[14px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "שומר..." : "💾 שמור עדכון"}
      </button>
    </div>
  );
}
