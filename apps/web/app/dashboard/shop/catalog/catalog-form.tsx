"use client";

import { useState } from "react";
import type { ShopComputerConfig, ShopTier, ShopUseCase } from "@ultranet/shared-types";
import { USE_CASE_LABELS, USE_CASE_ORDER } from "@/lib/shop-recommender";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

const TIER_OPTIONS: { value: ShopTier; label: string }[] = [
  { value: "minimal", label: "מינימלי" },
  { value: "recommended", label: "מומלץ" },
  { value: "extreme", label: "מוגזם" },
];

export function CatalogForm({
  action,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  initial?: Partial<ShopComputerConfig>;
  submitLabel: string;
}) {
  const [useCases, setUseCases] = useState<ShopUseCase[]>(initial?.useCases ?? []);

  const toggleUseCase = (uc: ShopUseCase) => {
    setUseCases((prev) => (prev.includes(uc) ? prev.filter((x) => x !== uc) : [...prev, uc]));
  };

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card">
      <div>
        <label className={LABEL}>שם התצורה (יוצג ללקוח)</label>
        <input name="name" required defaultValue={initial?.name} className={FIELD} placeholder='למשל: "מחשב משרדי בסיסי"' />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>דרגה</label>
          <select name="tier" defaultValue={initial?.tier ?? "recommended"} className={FIELD}>
            {TIER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>רמת עומס מינימלית שמכוסה (1-5)</label>
          <input type="number" min={1} max={5} name="minLoadLevel" defaultValue={initial?.minLoadLevel ?? 1} className={FIELD} />
        </div>
      </div>

      <div>
        <label className={LABEL}>מתאים לתחומי שימוש</label>
        <div className="flex flex-wrap gap-2">
          {USE_CASE_ORDER.map((uc) => (
            <button
              key={uc}
              type="button"
              onClick={() => toggleUseCase(uc)}
              className={
                useCases.includes(uc)
                  ? "rounded-full border border-teal bg-teal-bg px-3 py-1 text-xs font-bold text-teal-dark"
                  : "rounded-full border border-card-border bg-[#f4f6f9] px-3 py-1 text-xs font-bold text-muted"
              }
            >
              {USE_CASE_LABELS[uc]}
            </button>
          ))}
        </div>
        {USE_CASE_ORDER.map((uc) => (
          <input key={uc} type="hidden" name="useCases" value={useCases.includes(uc) ? uc : ""} />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={LABEL}>מעבד</label>
          <input name="cpu" required defaultValue={initial?.cpu} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>זיכרון</label>
          <input name="ram" required defaultValue={initial?.ram} className={FIELD} placeholder="16GB" />
        </div>
        <div>
          <label className={LABEL}>אחסון</label>
          <input name="storage" required defaultValue={initial?.storage} className={FIELD} placeholder="SSD 512GB" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>כרטיס מסך (רשות)</label>
          <input name="gpu" defaultValue={initial?.gpu} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>{'מחיר בש"ח (רשות - ריק = "יימסר בהצעת מחיר")'}</label>
          <input type="number" min={0} name="priceILS" defaultValue={initial?.priceILS} className={FIELD} />
        </div>
      </div>

      <div>
        <label className={LABEL}>תוספות/הערות למפרט (רשות)</label>
        <input name="extras" defaultValue={initial?.extras} className={FIELD} />
      </div>

      <div>
        <label className={LABEL}>הערה פנימית שתוצג ללקוח כהסבר (רשות - ברירת מחדל: הסבר גנרי)</label>
        <textarea name="notes" rows={2} defaultValue={initial?.notes} className={FIELD} />
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" name="active" defaultChecked={initial?.active ?? true} className="h-4 w-4" />
        {"פעיל (מוצג ללקוחות בצ'אטבוט)"}
      </label>

      <button
        type="submit"
        className="mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        {submitLabel}
      </button>
    </form>
  );
}
