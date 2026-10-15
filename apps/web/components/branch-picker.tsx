"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Building2, ChevronDown } from "lucide-react";

/**
 * בורר סניפים (אפיון שדרוג v2, סעיף 2): אחד, כמה, כולם וניקוי. הבחירה נשמרת בכתובת (`?b=id,id`),
 * כך שחזרה מכרטיס מחזירה לאותו סינון. **הרשימה מגיעה מהשרת וכוללת רק סניפים שמותרים למשתמש**,
 * והשרת מסנן לפי הכתובת רק בתוך אותה רשימה — הבחירה כאן לעולם לא מרחיבה הרשאה.
 */
export function BranchPicker({ branches, selected }: { branches: { id: string; name: string }[]; selected: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  function apply(ids: string[]) {
    const next = new URLSearchParams(params?.toString() ?? "");
    if (ids.length === 0 || ids.length === branches.length) next.delete("b");
    else next.set("b", ids.join(","));
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname ?? "", { scroll: false });
  }

  const toggle = (id: string) => apply(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const label =
    selected.length === 0
      ? "כל הסניפים"
      : selected.length === 1
        ? (branches.find((b) => b.id === selected[0])?.name ?? "סניף אחד")
        : `${selected.length} סניפים`;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="btn-outline flex items-center gap-1.5" aria-expanded={open}>
        <Building2 className="h-4 w-4" />
        {label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {selected.length > 0 && (
        <span className="mr-2 text-xs font-bold text-teal-dark">
          סינון פעיל
          <button type="button" onClick={() => apply([])} className="mr-1.5 text-teal hover:underline">
            הצג הכול
          </button>
        </span>
      )}
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 max-h-80 w-64 overflow-y-auto rounded-card border border-card-border bg-white p-2 shadow-card">
          <div className="mb-1 flex gap-2 border-b border-card-border pb-1.5 text-xs font-bold">
            <button type="button" onClick={() => apply(branches.map((b) => b.id))} className="text-teal hover:underline">
              כולם
            </button>
            <button type="button" onClick={() => apply([])} className="text-muted hover:underline">
              ניקוי
            </button>
          </div>
          {branches.map((b) => (
            <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-[#f4f6f9]">
              <input type="checkbox" checked={selected.includes(b.id)} onChange={() => toggle(b.id)} />
              {b.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

