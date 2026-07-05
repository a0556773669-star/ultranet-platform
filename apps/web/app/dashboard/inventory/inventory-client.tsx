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
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-gray-700">סניף:</label>
        <select
          value={branch}
          onChange={(e) => setBranch(e.target.value as BranchKey)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
        >
          {branches.map((b) => (
            <option key={b.key} value={b.key}>{b.label}</option>
          ))}
        </select>
        {lowStockCount > 0 && (
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
            ⚠️ {lowStockCount} פריטים במלאי נמוך
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-2 text-right font-medium">מוצר</th>
              <th className="px-4 py-2 text-right font-medium">כמות</th>
              <th className="px-4 py-2 text-right font-medium">מינימום</th>
            </tr>
          </thead>
          <tbody>
            {visibleProducts.map((p) => {
              const item = branchItems[p] ?? { qty: 0, min: 2 };
              const low = item.qty < item.min;
              const zero = item.qty === 0;
              return (
                <tr key={p} className={zero ? "bg-red-50" : low ? "bg-yellow-50" : ""}>
                  <td className="border-t border-gray-100 px-4 py-2">{p}</td>
                  <td className="border-t border-gray-100 px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      value={item.qty}
                      onChange={(e) => updateField(p, "qty", Number(e.target.value) || 0)}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-center"
                    />
                  </td>
                  <td className="border-t border-gray-100 px-4 py-2">
                    <input
                      type="number"
                      min={0}
                      value={item.min}
                      onChange={(e) => updateField(p, "min", Number(e.target.value) || 0)}
                      className="w-20 rounded border border-gray-300 px-2 py-1 text-center"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-lg bg-teal px-5 py-2 font-medium text-white transition hover:bg-teal-dark disabled:opacity-60"
      >
        {isPending ? "שומר..." : "💾 שמור עדכון"}
      </button>
    </div>
  );
}
