import { Repeat } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import {
  RECURRING_PURCHASE_MODULE_LABELS,
  buildRecurringPurchaseReport,
  currentYear,
  loadPurchaseRows,
  loadRecurringPurchaseTypes,
  suggestPurchasesForType,
} from "@/lib/recurring-purchases";
import { AccountingTabs } from "../accounting-tabs";
import { RecurringPurchaseTypeCard, BranchScopeField } from "./type-card";
import { createExpenseTypeAction } from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * רכישות חוזרות — המסך שעונה על "כמה בעצם הולך על נייר".
 *
 * נייר למדפסת, שקיות אשפה ופחיות נקנים כשנגמר, ולכן כל קנייה נרשמה ותמשיך להירשם כהוצאה
 * חד-פעמית רגילה. **המסך הזה לא מזיז אף שקל** — הוא רק סופר יחד את כל הקניות של אותו
 * מוצר, ומראה אותן בשני חתכים שקנייה בודדת אף פעם לא נותנת: חלוקה ל-12 חודשים (כמה זה
 * עולה בחודש ממוצע, כדי שאפשר יהיה להשוות את זה להוצאה קבועה) וחלוקה בין הסניפים.
 *
 * שלוש קניות נייר של 300 ₪ מפוזרות על השנה נראות כלום כל אחת לחוד. ביחד הן 900 ₪, וזה
 * מספר שמישהו צריך לראות.
 */
export default async function RecurringPurchasesPage() {
  await requireOwner();
  const db = getAdminFirestore();

  const [types, { tagged: purchases, untagged }, branchesSnap] = await Promise.all([
    loadRecurringPurchaseTypes({ includeArchived: true }),
    loadPurchaseRows(),
    db.collection("n_branches").get(),
  ]);

  const allBranches = (
    branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
  )
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
  const branchNameById = new Map(allBranches.map((b) => [b.id, b.name]));

  const reports = types
    .map((t) => buildRecurringPurchaseReport(t, purchases, allBranches))
    .sort((a, b) => (b.years[0]?.total ?? 0) - (a.years[0]?.total ?? 0));

  const year = currentYear();
  const thisYearTotal = purchases.filter((p) => p.year === year).reduce((s, p) => s + p.amount, 0);
  const thisYearCount = purchases.filter((p) => p.year === year).length;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Repeat className="h-5 w-5" />
            רכישות חוזרות
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            מוצרים שקונים שוב ושוב כשנגמר — נייר למדפסת, שקיות אשפה, פחיות — ומעקב שנתי אחריהם
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/recurring-purchases" />
      </div>

      <div className="rounded-card border border-card-border bg-white p-3.5 shadow-card">
        <p className="text-[12px] leading-relaxed text-muted">
          כל קנייה כאן היא הוצאה חד-פעמית רגילה שנרשמה במסך של הסניף או כהוצאה על כמה סניפים,
          והיא נספרת בהנה&quot;ח בחודש שבו הכסף יצא — <b className="text-ink">המסך הזה לא משנה שום סכום</b>.
          מה שהוא מוסיף הוא הידיעה ששתי הקניות האלה הן אותו מוצר, ושני החתכים שנובעים מזה:
          חלוקה ל-12 חודשים כדי לראות כמה המוצר עולה בחודש ממוצע, וחלוקה בין הסניפים שהוא משרת.
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-2 md:grid-cols-4">
          <div className="rounded-lg border border-card-border bg-[#f9fafb] px-2.5 py-2">
            <div className="text-[10.5px] font-semibold text-muted">{`סה"כ רכישות חוזרות ${year}`}</div>
            <div className="text-[19px] font-black tabular-nums text-red-600">{money(thisYearTotal)}</div>
          </div>
          <div className="rounded-lg border border-card-border bg-[#f9fafb] px-2.5 py-2">
            <div className="text-[10.5px] font-semibold text-muted">בחלוקה ל-12 חודשים</div>
            <div className="text-[19px] font-black tabular-nums text-teal-dark">{money(thisYearTotal / 12)}</div>
          </div>
          <div className="rounded-lg border border-card-border bg-[#f9fafb] px-2.5 py-2">
            <div className="text-[10.5px] font-semibold text-muted">קניות השנה</div>
            <div className="text-[19px] font-black tabular-nums text-ink">{thisYearCount}</div>
          </div>
          <div className="rounded-lg border border-card-border bg-[#f9fafb] px-2.5 py-2">
            <div className="text-[10.5px] font-semibold text-muted">סוגים במעקב</div>
            <div className="text-[19px] font-black tabular-nums text-ink">
              {types.filter((t) => !t.archived).length}
            </div>
          </div>
        </div>
      </div>

      {reports.length === 0 ? (
        <p className="rounded-card border border-dashed border-card-border bg-white p-6 text-center text-sm text-muted shadow-card">
          עוד לא הוגדר אף סוג רכישה חוזרת. מוסיפים אחד בטופס שלמטה, ומשם הוא מופיע בכל טופס של
          הוצאה חד-פעמית.
        </p>
      ) : (
        reports.map((report) => (
          <RecurringPurchaseTypeCard
            key={report.type.id}
            report={report}
            allBranches={allBranches}
            branchNameById={branchNameById}
            suggestions={suggestPurchasesForType(report.type, untagged)}
          />
        ))
      )}

      <form
        action={createExpenseTypeAction}
        className="grid grid-cols-2 gap-2 rounded-card border border-card-border bg-white p-4 shadow-card md:grid-cols-4"
      >
        <h2 className="col-span-2 text-sm font-bold text-ink md:col-span-4">+ סוג רכישה חוזרת חדש</h2>
        <div>
          <label className={LABEL}>שם המוצר</label>
          <input name="name" placeholder="נייר למדפסת / שקיות אשפה" className={FIELD} required />
        </div>
        <div>
          <label className={LABEL}>קטגוריה</label>
          <input name="category" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>מודול</label>
          <select name="module" defaultValue="general" className={FIELD}>
            {Object.entries(RECURRING_PURCHASE_MODULE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>הערה</label>
          <input name="note" className={FIELD} />
        </div>
        <div className="col-span-2 md:col-span-4">
          <BranchScopeField allBranches={allBranches} idPrefix="new-type-scope" />
        </div>
        <div className="col-span-2 md:col-span-4">
          <button
            type="submit"
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
          >
            + הוספת סוג
          </button>
        </div>
      </form>
    </div>
  );
}
