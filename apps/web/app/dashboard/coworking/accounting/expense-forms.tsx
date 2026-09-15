import type { RecurringPurchaseType } from "@ultranet/shared-types";
import { CountsToMainField } from "@/components/counts-to-main-field";
import { ExpenseTypeField } from "@/components/recurring-purchases/expense-type-field";
import { createCoworkingFixedExpenseAction, createCoworkingVariableExpenseAction } from "../actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";
const BTN =
  "rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90";

/** טופס אחד לשני סוגי ההוצאה — מה שמשתנה ביניהם הוא שדה אחד ותווית הכפתור. */
export function CoworkingExpenseForm({
  branchId,
  kind,
  expenseTypes = [],
}: {
  branchId: string;
  kind: "fixed" | "variable";
  expenseTypes?: RecurringPurchaseType[];
}) {
  if (kind === "fixed") {
    const action = createCoworkingFixedExpenseAction.bind(null, branchId);
    return (
      <form action={action} className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div>
          <label className={LABEL}>שם ההוצאה</label>
          <input name="name" className={FIELD} required />
        </div>
        <div>
          <label className={LABEL}>סכום חודשי</label>
          <input name="amount" type="number" step="0.01" className={FIELD} required />
        </div>
        <div>
          <label className={LABEL}>תאריך התחלה</label>
          <input name="startDate" type="date" className={FIELD} required />
        </div>
        <div>
          <label className={LABEL}>קטגוריה</label>
          <input name="category" className={FIELD} />
        </div>
        <div className="col-span-2 md:col-span-4">
          <CountsToMainField />
        </div>
        <div className="col-span-2 md:col-span-4">
          <button type="submit" className={BTN}>
            + הוסף הוצאה קבועה
          </button>
        </div>
      </form>
    );
  }

  const action = createCoworkingVariableExpenseAction.bind(null, branchId);
  return (
    <form action={action} className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
      <div>
        <label className={LABEL}>תיאור</label>
        <input name="desc" className={FIELD} required />
      </div>
      <div>
        <label className={LABEL}>סכום</label>
        <input name="amount" type="number" step="0.01" className={FIELD} required />
      </div>
      <div>
        <label className={LABEL}>תאריך</label>
        <input name="date" type="date" className={FIELD} required />
      </div>
      <div>
        <label className={LABEL}>קטגוריה</label>
        <input name="category" className={FIELD} />
      </div>
      <div className="col-span-2">
        <ExpenseTypeField types={expenseTypes} idPrefix="coworking-new-variable-type" />
      </div>
      <div className="col-span-2 md:col-span-4">
        <CountsToMainField />
      </div>
      <div className="col-span-2 md:col-span-4">
        <button type="submit" className={BTN}>
          + הוסף הוצאה משתנה
        </button>
      </div>
    </form>
  );
}
