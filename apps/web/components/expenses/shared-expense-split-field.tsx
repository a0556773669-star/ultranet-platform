"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Layers } from "lucide-react";
import { DEFAULT_SHARED_OWNER_PCT } from "@/lib/expense-shared-scope";
import { splitMultiBranchExpense } from "@/lib/multi-branch-expense";

/**
 * איך הוצאה בספר המשותף מתחלקת — **על אילו סניפים, וכמה מזה עליי.**
 *
 * שתי השאלות האלה נשאלות תמיד יחד ("פרסום משותף לחמישה סניפים, חצי עליי"), ולכן הן שדה
 * אחד ולא שניים: בלי הסניפים אין במה לחלק את החצי השני, ובלי האחוז אין מה לחלק. עד היום
 * התשובה לשתיהן הייתה קיימת רק בטופס נפרד לגמרי (`n_multi_branch_expenses`) שלא ידע
 * הוצאות קבועות — כאן היא יושבת על ההוצאה עצמה, ולכן עובדת גם לקבועה וגם לחד-פעמית.
 *
 * **בטפסי ההוספה המתג דלוק כברירת מחדל**: הוצאה שנרשמת בספר המשותף היא כמעט תמיד הוצאה
 * שחלה על הסניפים, ולכן החלוקה היא המצב הרגיל ולא החריג. מי שרוצה שורה שנשארת בספר
 * המשותף בלבד מכבה את המתג. בחלון העריכה ברירת המחדל נגזרת מהשורה עצמה, כדי ששורות
 * שנרשמו לפני השינוי לא ישנו התנהגות בשקט.
 *
 * הטופס שולח: `splitToBranches` (המתג), `branchScope` ("all"/"selected"), `branchIds`
 * ו-`ownerPct`. בצד השרת קוראים אותם `sharedExpenseBranchIdsFromForm` +
 * `sharedOwnerPctFromForm` מ-`lib/expense-shared-scope.ts`.
 *
 * התצוגה החיה משתמשת באותה `splitMultiBranchExpense` שהחישוב בשרת משתמש בה, כדי שמה
 * שרואים כאן יהיה בדיוק מה שנרשם.
 */
export function SharedExpenseSplitField({
  branches,
  defaultOn = false,
  defaultOwnerPct = DEFAULT_SHARED_OWNER_PCT,
  defaultBranchIds,
  idPrefix = "shared-split",
  amountLabel = "הסכום",
}: {
  branches: { id: string; name: string }[];
  defaultOn?: boolean;
  defaultOwnerPct?: number;
  /** הסניפים ששמורים כרגע על ההוצאה; ריק/undefined = כל הסניפים */
  defaultBranchIds?: string[];
  idPrefix?: string;
  /** "הסכום" בהוצאה חד-פעמית, "הסכום החודשי" בהוצאה קבועה */
  amountLabel?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [amount, setAmount] = useState(0);
  const [on, setOn] = useState(defaultOn);
  const [scope, setScope] = useState<"all" | "selected">(
    (defaultBranchIds?.length ?? 0) > 0 ? "selected" : "all",
  );
  const [selected, setSelected] = useState<string[]>(defaultBranchIds ?? []);
  const [ownerPct, setOwnerPct] = useState(String(defaultOwnerPct));

  /**
   * הסכום נקרא מהטופס עצמו ולא מתקבל כ-prop, כדי שהתצוגה החיה תתעדכן בלי להפוך את שני
   * טופסי ההוספה ואת שני חלונות העריכה לקומפוננטות client רק בשביל מספר אחד.
   */
  useEffect(() => {
    const form = rootRef.current?.closest("form");
    if (!form) return;
    const read = () => {
      const field = form.elements.namedItem("amount");
      setAmount(Number((field as HTMLInputElement | null)?.value) || 0);
    };
    read();
    form.addEventListener("input", read);
    return () => form.removeEventListener("input", read);
  }, []);

  const effectiveBranches = scope === "all" ? branches.map((b) => b.id) : selected;
  const split = useMemo(
    () => splitMultiBranchExpense(amount, Number(ownerPct) || 0, effectiveBranches.length || 1),
    [amount, ownerPct, effectiveBranches.length],
  );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div ref={rootRef} className="rounded-lg border border-card-border bg-[#f8fafc] p-3">
      <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-ink">
        <input
          type="checkbox"
          name="splitToBranches"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="h-4 w-4 accent-teal"
        />
        <Layers className="h-3.5 w-3.5" />
        ההוצאה מתחלקת בין הסניפים
      </label>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">
        {on
          ? "אתה קובע כמה אחוז ממנה עליך, והשאר מתחלק שווה בשווה בין הסניפים שהיא חלה עליהם — וכל סניף רואה את החלק שלו בספר שלו."
          : "לא מסומן — ההוצאה נשארת בספר המשותף בלבד ואינה נכנסת לספר של אף סניף (ההתנהגות שהייתה עד היום)."}
      </p>

      {on && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div>
            <p className="mb-1 text-[11px] font-bold text-muted">על אילו סניפים</p>
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
              <div className="mt-2 flex flex-wrap gap-1.5">
                {branches.length === 0 && <span className="text-[11px] text-muted">אין סניפים פעילים</span>}
                {branches.map((b) => {
                  const chosen = selected.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition ${
                        chosen
                          ? "border-teal bg-teal text-white"
                          : "border-card-border bg-white text-ink hover:border-teal"
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="branchIds"
                        value={b.id}
                        checked={chosen}
                        onChange={() => toggle(b.id)}
                        className="hidden"
                      />
                      {b.name}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <label className="flex max-w-[180px] flex-col gap-1">
            <span className="text-[11px] font-bold text-muted">כמה אחוז מההוצאה עליי</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                name="ownerPct"
                min={0}
                max={100}
                value={ownerPct}
                onChange={(e) => setOwnerPct(e.target.value)}
                className="w-20 rounded-lg border border-card-border bg-white px-2 py-1.5 text-sm focus:border-teal focus:outline-none"
              />
              <span className="text-xs text-muted">%</span>
              {[0, 50, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setOwnerPct(String(p))}
                  className="rounded-md border border-card-border bg-white px-1.5 py-1 text-[11px] font-bold text-muted transition hover:border-teal hover:text-ink"
                >
                  {p}%
                </button>
              ))}
            </div>
          </label>

          <div className="rounded-lg border border-teal/30 bg-teal/5 px-3 py-2 text-[11.5px] leading-relaxed text-ink">
            <span className="font-bold">כך זה יתחלק: </span>
            {effectiveBranches.length === 0 ? (
              "לא נבחר אף סניף — ההוצאה תישמר כחלה על כל הסניפים."
            ) : (
              <>
                מתוך {amountLabel} — {money(split.ownerTotal)} עליי ({split.ownerPct}%) ·{" "}
                {money(split.branchesTotal)} על הסניפים ·{" "}
                <span className="font-bold">{money(split.perBranch)} לכל סניף</span> (
                {effectiveBranches.length} סניפים)
              </>
            )}
          </div>
        </div>
      )}

      {/* נשלח תמיד, כדי שהשרת ידע אם לקרוא את `branchIds` או להתייחס ל"כל הסניפים" */}
      <input type="hidden" name="branchScope" value={scope} />
    </div>
  );
}

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}
