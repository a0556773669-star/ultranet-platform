import { History } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type {
  AccountingExpense,
  Branch,
  FixedExpense,
  MultiBranchExpense,
  RecurringVariableExpense,
  VariableExpense,
} from "@ultranet/shared-types";
import { countsToMain } from "@/lib/counts-to-main";
import { currentMonth, fixedExpenseAccrued } from "@/lib/main-ledger";
import { RECURRING_VAR_EXPENSES_COLLECTION, totalToDate } from "@/lib/recurring-expenses";
import { MULTI_BRANCH_EXPENSES_COLLECTION } from "@/lib/multi-branch-expense";
import { AccountingTabs } from "../accounting-tabs";
import { LegacyGroup, type LegacyRow } from "./legacy-group";

/**
 * עדכון רטרואקטיבי — ההחלטה על מה שכבר קיים.
 *
 * דגל `countsToMain` נולד היום, וכל ההוצאות שנרשמו לפניו נמצאות במצב "לא מתחשבן בראשי".
 * זו ברירת מחדל שנבחרה בכוונה: הכיוון ההפוך היה גורם לספר הראשי להיפתח עם סכום ענק
 * שאף אחד לא אישר. המסך הזה הוא המקום להחליט - קבוצה-קבוצה, עם אפשרות לסמן הכל בקבוצה,
 * וכל שורה עם הסכום שלה כדי שההחלטה תתקבל מול המספר ולא מול השם.
 */
export default async function LegacyCountsToMainPage() {
  await requireOwner();
  const db = getAdminFirestore();
  const [branchesSnap, fixedSnap, variableSnap, multiSnap, extraSnap, recurringSnap] = await Promise.all([
    db.collection("n_branches").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection(MULTI_BRANCH_EXPENSES_COLLECTION).get(),
    db.collection("n_ah_expenses").get(),
    db.collection(RECURRING_VAR_EXPENSES_COLLECTION).get(),
  ]);

  const branchNameById = new Map(
    branchesSnap.docs.map((d) => [d.id, (d.data() as Omit<Branch, "id">).name ?? d.id]),
  );
  const originOf = (branchId?: string) =>
    !branchId
      ? "כללי"
      : branchNameById.get(branchId) ?? (branchId.startsWith("shared-") ? "כל הסניפים" : branchId);

  const upto = currentMonth();

  const fixedRows: LegacyRow[] = fixedSnap.docs
    .map((d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense)
    .map((e) => ({
      id: e.id,
      title: e.name,
      subtitle: `${originOf(e.branchId)} · מ-${e.startDate}${e.endDate ? ` עד ${e.endDate}` : ""}`,
      amount: fixedExpenseAccrued(e, upto),
      on: countsToMain(e),
    }))
    .sort((a, b) => b.amount - a.amount);

  const variableRows: LegacyRow[] = variableSnap.docs
    .map((d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense)
    .map((e) => ({
      id: e.id,
      title: e.desc,
      subtitle: `${originOf(e.branchId)} · ${e.date}`,
      amount: e.amount || 0,
      on: countsToMain(e),
    }))
    .sort((a, b) => b.subtitle.localeCompare(a.subtitle));

  const multiRows: LegacyRow[] = multiSnap.docs
    .map((d) => ({ ...(d.data() as Omit<MultiBranchExpense, "id">), id: d.id }) as MultiBranchExpense)
    .map((e) => ({
      id: e.id,
      title: e.desc,
      subtitle: `${e.date} · ${(e.branchIds ?? []).length} סניפים`,
      amount: e.amount || 0,
      on: countsToMain(e),
    }))
    .sort((a, b) => b.subtitle.localeCompare(a.subtitle));

  const extraRows: LegacyRow[] = extraSnap.docs
    .map((d) => ({ ...(d.data() as Omit<AccountingExpense, "id">), id: d.id }) as AccountingExpense)
    .map((e) => ({
      id: e.id,
      title: e.desc,
      subtitle: `${e.date}${e.category ? ` · ${e.category}` : ""}`,
      amount: e.amount || 0,
      on: countsToMain(e),
    }))
    .sort((a, b) => b.subtitle.localeCompare(a.subtitle));

  const recurringRows: LegacyRow[] = recurringSnap.docs
    .map((d) => ({ ...(d.data() as Omit<RecurringVariableExpense, "id">), id: d.id }) as RecurringVariableExpense)
    .map((e) => ({
      id: e.id,
      title: e.name,
      subtitle: `${originOf(e.branchId)} · ${(e.amounts ?? []).length} חודשים נרשמו`,
      amount: totalToDate(e, upto),
      on: countsToMain(e),
    }));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <History className="h-5 w-5" />
            עדכון רטרואקטיבי
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            להחליט על כל ההוצאות שכבר קיימות — האם הן נכנסות להנה&quot;ח הראשית
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/legacy" />
      </div>

      <div className="rounded-card border border-amber-300 bg-amber-50 p-3.5 text-[12px] leading-relaxed text-amber-900">
        כל הוצאה שנרשמה לפני שהדגל הזה נוסף נמצאת במצב <b>&quot;סניף בלבד&quot;</b> — היא לא נספרת בשורה
        התחתונה של העסק. זו ברירת המחדל בכוונה: אף סכום ישן לא מופיע פתאום בספר הראשי בלי שמישהו אמר
        שהוא שייך. כאן מסמנים, שורה-שורה או קבוצה שלמה בבת אחת.
      </div>

      <LegacyGroup
        collection="fixed"
        title="הוצאות קבועות"
        note="הסכום המוצג הוא מה שנצבר מתחילת ההוצאה ועד היום."
        rows={fixedRows}
      />
      <LegacyGroup collection="variable" title="הוצאות חד פעמיות" rows={variableRows} />
      <LegacyGroup collection="multi" title="הוצאות על כמה סניפים" rows={multiRows} />
      <LegacyGroup collection="recurring" title="הוצאות קבועות משתנות" rows={recurringRows} />
      <LegacyGroup collection="extra" title="הוצאות נוספות (הוצאות העסק)" rows={extraRows} />
    </div>
  );
}
