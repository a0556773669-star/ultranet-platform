"use client";

import type { ShopAddon, ShopAddonType } from "@ultranet/shared-types";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

const TYPE_OPTIONS: { value: ShopAddonType; label: string }[] = [
  { value: "bag", label: "תיק" },
  { value: "mouse", label: "עכבר" },
  { value: "keyboard", label: "מקלדת" },
  { value: "flashdrive", label: "דיסק און קי" },
  { value: "other", label: "אחר" },
];

export function AddonForm({
  action,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  initial?: Partial<ShopAddon>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card">
      <div>
        <label className={LABEL}>שם הפריט</label>
        <input name="name" required defaultValue={initial?.name} className={FIELD} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>סוג</label>
          <select name="type" defaultValue={initial?.type ?? "other"} className={FIELD}>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>{'מחיר בש"ח (רשות - ריק = "יתומחר בהצעה")'}</label>
          <input type="number" min={0} name="priceILS" defaultValue={initial?.priceILS} className={FIELD} />
        </div>
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
