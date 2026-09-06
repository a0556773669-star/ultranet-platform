"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import type { Branch } from "@ultranet/shared-types";
import { useToast } from "@/lib/toast";
import { CountsToMainField } from "@/components/counts-to-main-field";
import { createExtraExpenseAction } from "../actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

/**
 * רכישה או הוצאה חד-פעמית של העסק.
 *
 * "שיוך לסניפים" כאן הוא תיעוד ולא חישוב: קניתי משטח מחשבים, ההוצאה כולה שלי, ואני רק
 * רוצה לזכור לאילו סניפים הם הלכו. לכן הצ'יפים לא משנים אף סכום, ולכן זה כתוב על הטופס.
 */
export function ExtraExpenseForm({ branches }: { branches: Branch[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createExtraExpenseAction(formData);
        setSelected([]);
        router.refresh();
        showSuccess("ההוצאה נוספה");
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בשמירה");
      }
    });
  }

  return (
    <form
      action={handleSubmit}
      className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card"
    >
      <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
        <Plus className="h-4 w-4" />
        הוספת הוצאה / רכישה
      </h2>

      <div>
        <label className={LABEL}>תיאור</label>
        <input name="desc" placeholder="למשל: משטח מחשבים" required className={FIELD} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={LABEL}>סכום</label>
          <input type="number" name="amount" min={0} step="0.01" required className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>תאריך</label>
          <input type="date" name="date" required className={FIELD} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={LABEL}>קטגוריה</label>
          <input name="category" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>שייך לתחום</label>
          <select name="business" defaultValue="general" className={FIELD}>
            <option value="general">כללי</option>
            <option value="computers">חדרי מחשבים</option>
            <option value="rentals">השכרות</option>
            <option value="coworking">משרד שיתופי</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-bold text-muted">
          שיוך לסניפים ({selected.length}) — תיעוד בלבד, לא פותח התחשבנות מולם
        </span>
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-card-border bg-[#f8fafc] p-2">
          {branches.length === 0 && <span className="text-xs text-muted">אין סניפים</span>}
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
                  name="linkedBranchIds"
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

      <CountsToMainField defaultChecked />

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
