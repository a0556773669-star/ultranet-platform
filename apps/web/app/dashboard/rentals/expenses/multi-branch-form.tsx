"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import type { Branch } from "@ultranet/shared-types";
import { useToast } from "@/lib/toast";
import { DEFAULT_MULTI_BRANCH_OWNER_PCT, splitMultiBranchExpense } from "@/lib/multi-branch-expense";
import { createMultiBranchExpenseAction } from "./multi-branch-actions";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * הוספת הוצאה חד-פעמית שמתחלקת בין כמה סניפים.
 * Live preview of the split as you type - imports the same pure splitMultiBranchExpense() the
 * server action and the accounting calc use, so what you see here is exactly what gets charged.
 */
export function MultiBranchExpenseForm({ branches }: { branches: Branch[] }) {
  const [amount, setAmount] = useState("");
  const [ownerPct, setOwnerPct] = useState(String(DEFAULT_MULTI_BRANCH_OWNER_PCT));
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  const split = useMemo(
    () => splitMultiBranchExpense(Number(amount) || 0, Number(ownerPct) || 0, selected.length || 1),
    [amount, ownerPct, selected.length]
  );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit(formData: FormData) {
    if (selected.length === 0) {
      showError("חובה לבחור לפחות סניף אחד");
      return;
    }
    startTransition(async () => {
      try {
        await createMultiBranchExpenseAction(formData);
        setAmount("");
        setSelected([]);
        router.refresh();
        showSuccess("ההוצאה נוספה והתחלקה בין הסניפים");
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בשמירה");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card">
      <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        <Layers className="h-4 w-4" />
        הוצאה על כמה סניפים
      </h2>
      <p className="text-[11px] leading-relaxed text-muted">
        הוצאה אחת שמתחלקת בין הסניפים שתבחר. אתה קובע כמה אחוז ממנה עליך, והשאר מתחלק שווה בשווה
        בין הסניפים שנבחרו.
      </p>

      <input name="desc" placeholder="תיאור (למשל: פרסום קרית ספר)" required className={FIELD} />
      <div className="grid grid-cols-2 gap-2.5">
        <input
          type="number"
          name="amount"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder='סכום כולל'
          required
          className={FIELD}
        />
        <input type="date" name="date" required className={FIELD} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-muted">כמה אחוז עליי</span>
          <input
            type="number"
            name="ownerPct"
            min={0}
            max={100}
            value={ownerPct}
            onChange={(e) => setOwnerPct(e.target.value)}
            required
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-muted">מי שילם בפועל</span>
          <select name="paidBy" defaultValue="owner" className={FIELD}>
            <option value="owner">אני</option>
            <option value="partner">השותף</option>
          </select>
        </label>
      </div>
      <input name="category" placeholder="קטגוריה (לא חובה)" className={FIELD} />

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold text-muted">על אילו סניפים ({selected.length} נבחרו)</span>
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-card-border bg-[#f8fafc] p-2">
          {branches.length === 0 && <span className="text-xs text-muted">אין סניפי השכרות פעילים</span>}
          {branches.map((b) => {
            const on = selected.includes(b.id);
            return (
              <label
                key={b.id}
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                  on ? "border-teal bg-teal text-white" : "border-card-border bg-white text-ink hover:bg-[#f1f5f9]"
                }`}
              >
                <input
                  type="checkbox"
                  name="branchIds"
                  value={b.id}
                  checked={on}
                  onChange={() => toggle(b.id)}
                  className="sr-only"
                />
                {b.name}
              </label>
            );
          })}
        </div>
      </div>

      {selected.length > 0 && Number(amount) > 0 && (
        <div className="rounded-lg border border-teal/30 bg-teal/5 px-3 py-2 text-xs leading-relaxed text-ink">
          <span className="font-bold">כך זה יתחלק: </span>
          {money(split.ownerTotal)} עליי ({split.ownerPct}%) · {money(split.branchesTotal)} על הסניפים ·{" "}
          <span className="font-bold">{money(split.perBranch)} לכל סניף</span> ({split.branchCount} סניפים)
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "שומר..." : "הוספה"}
      </button>
      {toastNode}
    </form>
  );
}
