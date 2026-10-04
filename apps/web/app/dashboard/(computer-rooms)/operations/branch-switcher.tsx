"use client";

import type { OpsBranch } from "@/lib/operations-shared";

/**
 * בורר הסניף. לבעלים מוצגים כל סניפי חדרי המחשבים; למנהל סניף מגיע כאן סניף
 * אחד בלבד (הסינון נעשה בשרת), ואז מוצג שם הסניף בלי אפשרות לבחור אחר.
 */
export function BranchSwitcher({
  branches,
  value,
  onChange,
}: {
  branches: OpsBranch[];
  value: string | null;
  onChange: (branchId: string) => void;
}) {
  if (branches.length <= 1) {
    return (
      <span className="rounded-full bg-teal-bg px-3 py-1 text-xs font-bold text-teal-dark">
        {branches[0]?.name ?? "אין סניף משויך"}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {branches.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onChange(b.id)}
          className={
            value === b.id
              ? "rounded-lg bg-teal px-3.5 py-1.5 text-sm font-semibold text-white transition"
              : "rounded-lg border border-card-border bg-white px-3.5 py-1.5 text-sm font-semibold text-muted transition hover:border-teal hover:text-teal"
          }
        >
          {b.name}
        </button>
      ))}
    </div>
  );
}
