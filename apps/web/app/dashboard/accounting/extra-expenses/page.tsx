import { Wallet, Layers } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingExpense, Branch } from "@ultranet/shared-types";
import { loadRecurringVariableExpenses } from "@/lib/recurring-expenses";
import { countsToMain } from "@/lib/counts-to-main";
import { RecurringExpensesCard } from "@/components/recurring-expenses/recurring-expenses-card";
import { CountsToMainBadge } from "@/components/counts-to-main-field";
import { AccountingTabs } from "../accounting-tabs";
import { DeleteEntryButton } from "../delete-entry-button";
import { deleteExtraExpenseAction } from "../actions";
import { ExtraExpenseForm } from "./extra-expense-form";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * הוצאות נוספות — ההוצאות של העסק עצמו, שלא שייכות לאף סניף.
 *
 * שני חלקים, ובכוונה בסדר הזה: קודם ההוצאות שחוזרות כל חודש בסכום משתנה (משכורת
 * מזכירה, מע"מ, חשמל), כי הן אלה שדורשות ממני משהו ב-1 לחודש; ואחריהן הרכישות
 * החד-פעמיות, שנרשמות פעם אחת ונגמרות.
 *
 * רכישה גדולה יכולה לסמן לאילו סניפים היא הלכה פיזית (`linkedBranchIds`) בלי שזה יפתח
 * מולם התחשבנות - ההפרדה הזו היא הסיבה שהשדה קיים: "לאן זה הלך" ו"מי משלם על זה" הן
 * שתי שאלות, וערבוב שלהן הוא בדיוק מה שהיה שבור קודם.
 */
export default async function ExtraExpensesPage() {
  await requireOwner();
  const db = getAdminFirestore();
  const [recurring, expensesSnap, branchesSnap] = await Promise.all([
    loadRecurringVariableExpenses({ scope: "main" }),
    db.collection("n_ah_expenses").get(),
    db.collection("n_branches").get(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const expenses = expensesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<AccountingExpense, "id">), id: d.id }) as AccountingExpense)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const totalToMain = expenses.filter((e) => countsToMain(e)).reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Wallet className="h-5 w-5" />
            הוצאות נוספות
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">הוצאות של העסק עצמו — קבועות משתנות ורכישות חד-פעמיות</p>
        </div>
        <AccountingTabs active="/dashboard/accounting/extra-expenses" />
      </div>

      <RecurringExpensesCard
        scope="main"
        expenses={recurring}
        canManage
        monthsBack={8}
        title="הוצאות קבועות משתנות"
        subtitle='שורה אחת לכל הוצאה שחוזרת כל חודש בסכום אחר — משכורת מזכירה, מע"מ, חשמל. בכל חודש שלא עודכן המערכת מבקשת את הסכום, וההיסטוריה נשמרת לכל החודשים.'
      />

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <ExtraExpenseForm branches={branches} />

        <section>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              רכישות והוצאות חד-פעמיות ({expenses.length})
            </span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-red-600 normal-case">
              {money(totalToMain)} לראשי
            </span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {expenses.length === 0 && <p className="py-6 text-center text-sm text-muted">אין עדיין הוצאות</p>}
            {expenses.map((e) => {
              const bound = deleteExtraExpenseAction.bind(null, e.id);
              return (
                <div
                  key={e.id}
                  className="flex items-start gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-ink">
                      {e.desc}
                      <CountsToMainBadge on={countsToMain(e)} />
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {e.date}
                      {e.category ? ` · ${e.category}` : ""}
                    </div>
                    {e.linkedBranchIds && e.linkedBranchIds.length > 0 && (
                      <div className="mt-0.5 text-[11px] text-muted">
                        שוייך לסניפים (ללא התחשבנות): {e.linkedBranchIds.map((id) => branchNameById.get(id) ?? id).join(" · ")}
                      </div>
                    )}
                  </div>
                  <div className="min-w-[80px] text-left font-extrabold text-red-600">{money(e.amount || 0)}</div>
                  <DeleteEntryButton confirmText="למחוק את ההוצאה?" action={bound} successText="ההוצאה נמחקה" />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
