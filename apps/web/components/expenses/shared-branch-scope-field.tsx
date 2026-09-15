"use client";

import { useState } from "react";
import { Layers } from "lucide-react";

/**
 * בחירת הסניפים שהוצאה משותפת חלה עליהם.
 *
 * הבעיה שזה פותר: הוצאה משותפת נרשמה תחת "כל הסניפים", וסניף שנפתח היום ירש אותה מיד -
 * גם כשההוצאה כלל לא נוגעת אליו. כאן בוחרים: כל הסניפים (כולל כאלה שייפתחו, ההתנהגות
 * הישנה וברירת המחדל) או רשימה מפורשת.
 *
 * הטופס שולח `branchScope` ("all" / "selected") ואת `branchIds` שנבחרו; בצד השרת קורא את
 * שניהם `sharedExpenseBranchIdsFromForm()` מ-`lib/expense-shared-scope.ts`.
 */
export function SharedBranchScopeField({
  branches,
  defaultBranchIds,
  idPrefix = "scope",
}: {
  branches: { id: string; name: string }[];
  /** הסניפים ששמורים כרגע על ההוצאה; ריק/undefined = כל הסניפים */
  defaultBranchIds?: string[];
  /** מפריד בין כמה מופעים של הרכיב באותו מסך (id-ים של label/input) */
  idPrefix?: string;
}) {
  const hasExplicit = (defaultBranchIds?.length ?? 0) > 0;
  const [scope, setScope] = useState<"all" | "selected">(hasExplicit ? "selected" : "all");
  const [selected, setSelected] = useState<string[]>(defaultBranchIds ?? []);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="rounded-lg border border-card-border bg-[#f8fafc] p-3">
      <input type="hidden" name="branchScope" value={scope} />
      <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink">
        <Layers className="h-3.5 w-3.5" />
        על אילו סניפים ההוצאה מתחלקת
      </p>
      <div className="flex flex-wrap gap-4">
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink">
          <input
            type="radio"
            name={`${idPrefix}-branchScopeChoice`}
            checked={scope === "all"}
            onChange={() => setScope("all")}
          />
          כל הסניפים (כולל סניפים שייפתחו)
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink">
          <input
            type="radio"
            name={`${idPrefix}-branchScopeChoice`}
            checked={scope === "selected"}
            onChange={() => setScope("selected")}
          />
          סניפים נבחרים בלבד
        </label>
      </div>

      {scope === "selected" && (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {branches.length === 0 && <span className="text-[11px] text-muted">אין סניפים פעילים</span>}
            {branches.map((b) => {
              const on = selected.includes(b.id);
              return (
                <label
                  key={b.id}
                  className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                    on ? "border-teal bg-teal text-white" : "border-card-border bg-white text-ink hover:border-teal"
                  }`}
                >
                  <input
                    type="checkbox"
                    name="branchIds"
                    value={b.id}
                    checked={on}
                    onChange={() => toggle(b.id)}
                    className="hidden"
                  />
                  {b.name}
                </label>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            {selected.length > 0
              ? `ההוצאה תתחלק בין ${selected.length} סניפים שנבחרו. סניף חדש לא ייכנס אליה אוטומטית.`
              : "לא נבחר אף סניף — ההוצאה תישמר כחלה על כל הסניפים."}
          </p>
        </>
      )}
    </div>
  );
}
