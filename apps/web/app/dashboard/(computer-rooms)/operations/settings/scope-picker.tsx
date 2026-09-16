"use client";

import type { OpsBranch } from "@/lib/operations-shared";
import type { OpsScope } from "@ultranet/shared-types";

/**
 * "לכל הסניפים" מול "סניפים נבחרים". זו הקוביה שמונעת עבודה כפולה: הגדרה אחת
 * שמסומנת "לכולם" מגיעה לכל הסניפים בלי ליצור אותה מחדש לכל סניף.
 */
export function ScopePicker({
  branches,
  scope,
  branchIds,
  onScopeChange,
  onBranchesChange,
}: {
  branches: OpsBranch[];
  scope: OpsScope;
  branchIds: string[];
  onScopeChange: (scope: OpsScope) => void;
  onBranchesChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onBranchesChange(branchIds.includes(id) ? branchIds.filter((b) => b !== id) : [...branchIds, id]);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onScopeChange("all")}
          className={
            scope === "all"
              ? "rounded-full border border-teal bg-teal-bg px-3 py-1 text-xs font-bold text-teal-dark"
              : "rounded-full border border-card-border bg-[#f4f6f9] px-3 py-1 text-xs font-bold text-muted"
          }
        >
          {"לכל הסניפים"}
        </button>
        <button
          type="button"
          onClick={() => onScopeChange("branches")}
          className={
            scope === "branches"
              ? "rounded-full border border-teal bg-teal-bg px-3 py-1 text-xs font-bold text-teal-dark"
              : "rounded-full border border-card-border bg-[#f4f6f9] px-3 py-1 text-xs font-bold text-muted"
          }
        >
          {"סניפים נבחרים"}
        </button>
      </div>
      {scope === "branches" && (
        <div className="flex flex-wrap gap-2">
          {branches.map((b) => (
            <button
              type="button"
              key={b.id}
              onClick={() => toggle(b.id)}
              className={
                branchIds.includes(b.id)
                  ? "rounded-full border border-teal bg-teal-bg px-3 py-1 text-xs font-bold text-teal-dark"
                  : "rounded-full border border-card-border bg-[#f4f6f9] px-3 py-1 text-xs font-bold text-muted"
              }
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
