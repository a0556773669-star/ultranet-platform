"use client";

import { useState, useTransition } from "react";
import type { Branch } from "@ultranet/shared-types";
import { ACCOUNTING_EXPENSE_CATEGORIES } from "@/lib/accounting-categories";
import { addBranchExpenseAction, type SaveResult } from "./branch-expense-actions";

const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-2 text-[13px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-[11px] font-bold text-muted";

/**
 * Adding an expense straight from the branch screen, for the owner and for that branch's own
 * manager. Deliberately a client component: the save reports back into the page - a green line
 * on success, a red line with the reason on failure - instead of a form that silently does
 * nothing when the server rejects it.
 */
export function AddBranchExpense({
  branch,
  ownerName,
  partnerName,
  hasPartner,
  restricted,
}: {
  branch: Branch;
  ownerName: string;
  partnerName: string;
  hasPartner: boolean;
  restricted: boolean;
}) {
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setResult(null);
    startTransition(async () => {
      const res = await addBranchExpenseAction(branch.id, formData);
      setResult(res);
      if (res.ok) form.reset();
    });
  }

  return (
    <section className="rounded-card border border-card-border bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">הוספת הוצאה לסניף</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {restricted
              ? "ההוצאה נרשמת לסניף שלך בלבד"
              : `ההוצאה נרשמת בספר של ${branch.name} ומופיעה מיד בפירוט למעלה`}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={LABEL}>תאריך</label>
          <input type="date" name="date" defaultValue={today} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>תיאור</label>
          <input name="desc" placeholder="למשל: חשמל לחודש יולי" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>קטגוריה</label>
          <select name="category" defaultValue="" className={FIELD}>
            <option value="">ללא קטגוריה</option>
            {ACCOUNTING_EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>סכום (₪)</label>
          <input type="number" name="amount" min={1} step="1" placeholder="0" className={FIELD} />
        </div>

        {hasPartner && (
          <>
            <div>
              <label className={LABEL}>על מי ההוצאה</label>
              <select name="owedBy" defaultValue="owner" className={FIELD}>
                <option value="owner">על {ownerName} (100%)</option>
                <option value="shared">משותף (50% / 50%)</option>
                <option value="partner">על {partnerName} (100%)</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>מי שילם בפועל</label>
              <select name="paidBy" defaultValue={restricted ? "partner" : "owner"} className={FIELD}>
                <option value="owner">{ownerName}</option>
                <option value="partner">{partnerName}</option>
              </select>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-7 py-2.5 text-[14px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "שומר..." : "שמור"}
          </button>

          {result && (
            <span
              className={`text-[13px] font-bold ${result.ok ? "text-emerald-600" : "text-red-600"}`}
              role="status"
            >
              {result.ok ? "✓ " : "✕ "}
              {result.message}
            </span>
          )}

          {!result && hasPartner && (
            <span className="text-[11.5px] text-muted">
              &quot;על מי ההוצאה&quot; ו&quot;מי שילם בפועל&quot; הם מה שקובע את הקיזוז וההעברה החודשית.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
