import { Layers } from "lucide-react";
import type { MultiBranchExpense } from "@ultranet/shared-types";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { MULTI_BRANCH_EXPENSES_COLLECTION, splitOf, multiBranchExpenseNote } from "@/lib/multi-branch-expense";
import { countsToMain } from "@/lib/counts-to-main";
import { CountsToMainBadge } from "@/components/counts-to-main-field";
import { DeleteEntryButton } from "../../accounting/delete-entry-button";
import { deleteMultiBranchExpenseAction } from "./multi-branch-actions";

/**
 * הוצאות רב-סניפיות ישנות (`n_multi_branch_expenses`) — **קריאה ומחיקה בלבד.**
 *
 * הקולקשן הזה נולד כדי לענות על שאלה אחת שהספר המשותף לא ידע לענות עליה: איזה אחוז מההוצאה
 * על הבעלים. מאז `ownerPct` יושב על ההוצאה עצמה (ראה `lib/expense-shared-scope.ts`), הספר
 * המשותף עונה עליה בעצמו — גם בהוצאה קבועה, מה שהקולקשן הזה מעולם לא ידע — ולכן הטופס
 * שיצר אותו הוסר. השורות שכבר נרשמו ממשיכות להתחשבן בדיוק כמו קודם, ומוצגות כאן כדי שלא
 * יהיה בספרים כסף שאי אפשר לראות ואי אפשר להסיר.
 */
export async function LegacyMultiBranchExpenses({
  branchNameById,
}: {
  branchNameById: ReadonlyMap<string, string>;
}) {
  const snap = await getAdminFirestore().collection(MULTI_BRANCH_EXPENSES_COLLECTION).get();
  const expenses = snap.docs
    .map((d) => ({ ...(d.data() as Omit<MultiBranchExpense, "id">), id: d.id }) as MultiBranchExpense)
    .filter((e) => e.module === "rentals")
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  if (expenses.length === 0) return null;

  return (
    <details className="rounded-card border border-card-border bg-white px-4 py-3 shadow-card">
      <summary className="cursor-pointer text-xs font-bold text-muted">
        <span className="inline-flex items-center gap-1.5 align-middle">
          <Layers className="h-3.5 w-3.5" />
          הוצאות רב-סניפיות שנרשמו בשיטה הישנה ({expenses.length})
        </span>
      </summary>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
        נרשמו לפני שהספר המשותף ידע לחלק בעצמו. הן ממשיכות להתחשבן כרגיל ואפשר רק למחוק אותן —
        הוצאה חדשה כזו נרשמת היום כאן למעלה, עם &quot;ההוצאה מתחלקת בין הסניפים&quot;.
      </p>
      <div className="mt-2">
        {expenses.map((e) => (
          <div
            key={e.id}
            className="flex items-start gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0"
          >
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-1.5 font-bold text-ink">
                {e.desc}
                <CountsToMainBadge on={countsToMain(e)} />
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                {e.date} · {multiBranchExpenseNote(splitOf(e))}
                {e.paidBy === "partner" ? " · שילם: השותף" : " · שילם: אני"}
              </div>
              <div className="mt-0.5 text-[11px] text-muted">
                {(e.branchIds ?? []).map((id) => branchNameById.get(id) ?? "סניף שנמחק").join(" · ")}
              </div>
            </div>
            <div className="min-w-[75px] text-left font-extrabold text-red-600">
              {Math.round(e.amount).toLocaleString("he-IL")} ₪
            </div>
            <DeleteEntryButton
              confirmText="למחוק את ההוצאה המשותפת? היא תוסר מכל הסניפים שהיא התחלקה ביניהם."
              action={deleteMultiBranchExpenseAction.bind(null, e.id)}
              successText="ההוצאה נמחקה"
            />
          </div>
        ))}
      </div>
    </details>
  );
}
