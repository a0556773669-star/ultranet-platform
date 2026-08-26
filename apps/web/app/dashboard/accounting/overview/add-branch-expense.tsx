import type { Branch } from "@ultranet/shared-types";
import { branchHasPartner, branchPartnerLabel } from "@/lib/accounting-overview";
import { ACCOUNTING_EXPENSE_CATEGORIES } from "@/lib/accounting-categories";
import { addBranchExpenseAction } from "./branch-expense-actions";

const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-[12.5px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-[11px] font-bold text-muted";

/**
 * Adding an expense straight from the branch screen, for the owner and for that branch's own
 * manager. Without it the only way to record a branch expense was the module-level entry screen,
 * which a branch manager can't reach at all.
 */
export function AddBranchExpense({
  branch,
  ownerName,
  restricted,
}: {
  branch: Branch;
  ownerName: string;
  restricted: boolean;
}) {
  const hasPartner = branchHasPartner(branch);
  const partnerName = branchPartnerLabel(branch);
  const action = addBranchExpenseAction.bind(null, branch.id);
  const today = new Date().toISOString().slice(0, 10);

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

      <form action={action} className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className={LABEL}>תאריך</label>
          <input type="date" name="date" defaultValue={today} required className={FIELD} />
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
          <input type="number" name="amount" min={1} step="1" placeholder="0" required className={FIELD} />
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

        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="submit"
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2.5 text-[14px] font-bold text-white shadow-primary transition hover:opacity-90"
          >
            שמירת ההוצאה
          </button>
          {hasPartner && (
            <span className="mr-3 text-[11.5px] text-muted">
              שני השדות האחרונים הם מה שקובע את הקיזוז וההעברה החודשית.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
