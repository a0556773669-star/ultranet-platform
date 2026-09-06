import { redirect } from "next/navigation";
import Link from "next/link";
import { Banknote, Layers } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, FixedExpense, MultiBranchExpense, VariableExpense } from "@ultranet/shared-types";
import { SHARED_EXPENSE_BRANCH_ID } from "@/lib/computer-room-accounting";
import { MULTI_BRANCH_EXPENSES_COLLECTION, splitOf, multiBranchExpenseNote } from "@/lib/multi-branch-expense";
import { countsToMain } from "@/lib/counts-to-main";
import { currentMonth, fixedExpenseAccrued } from "@/lib/main-ledger";
import { BranchExpenseTable, type BranchExpenseRow } from "@/components/expenses/branch-expense-table";
import { CountsToMainBadge } from "@/components/counts-to-main-field";
import { DeleteEntryButton } from "../../accounting/delete-entry-button";
import { MultiBranchExpenseForm } from "../../rentals/expenses/multi-branch-form";
import { deleteMultiBranchExpenseAction } from "../../rentals/expenses/multi-branch-actions";

export default async function ComputerRoomExpensesHomePage() {
  const session = await requireModuleAccess("computers");
  const isOwner = session.user?.role === "owner";
  if (!isOwner) {
    const myBranchId = session.user?.branchId;
    if (!myBranchId) redirect("/dashboard");
    const myDoc = await getAdminFirestore().collection("n_branches").doc(myBranchId).get();
    const myBranch = myDoc.exists ? ({ id: myDoc.id, ...(myDoc.data() as Omit<Branch, "id">) } as Branch) : null;
    if (!myBranch || myBranch.branchType !== "computers") redirect("/dashboard");
    redirect(`/dashboard/expenses/${myBranchId}`);
  }

  const db = getAdminFirestore();
  const [branchesSnap, fixedSnap, variableSnap, multiSnap] = await Promise.all([
    db.collection("n_branches").where("branchType", "==", "computers").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection(MULTI_BRANCH_EXPENSES_COLLECTION).get(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const allFixed = fixedSnap.docs.map((d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense);
  const allVariable = variableSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense,
  );
  const upto = currentMonth();

  const rows: BranchExpenseRow[] = branches.map((branch) => {
    const fixed = allFixed.filter((e) => e.branchId === branch.id);
    const variable = allVariable.filter((e) => e.branchId === branch.id);
    let total = 0;
    let toMain = 0;
    for (const e of fixed) {
      const accrued = fixedExpenseAccrued(e, upto);
      total += accrued;
      if (countsToMain(e)) toMain += accrued;
    }
    for (const e of variable) {
      total += e.amount || 0;
      if (countsToMain(e)) toMain += e.amount || 0;
    }
    return { branch, fixedCount: fixed.length, variableCount: variable.length, total, toMain };
  });

  const multiExpenses = multiSnap.docs
    .map((d) => ({ ...(d.data() as Omit<MultiBranchExpense, "id">), id: d.id }) as MultiBranchExpense)
    .filter((e) => e.module === "computers")
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Banknote className="h-5 w-5" />
            הוצאות — חדרי מחשבים
          </h1>
          <Link
            href={`/dashboard/expenses/${SHARED_EXPENSE_BRANCH_ID}`}
            className="flex items-center gap-1.5 text-xs font-bold text-teal hover:underline"
          >
            <Layers className="h-4 w-4" />
            הוצאות על כל הסניפים יחד
          </Link>
        </div>
        <BranchExpenseTable rows={rows} hrefFor={(id) => `/dashboard/expenses/${id}`} />
        <p className="mt-1.5 px-1 text-[11.5px] leading-relaxed text-muted">
          עמודת <b>&quot;מזה לראשי&quot;</b> היא מה שנספר בהנה&quot;ח הראשית. הוצאה שלא סומנה נשארת בספר של
          הסניף בלבד ולא נכנסת לשורה התחתונה של העסק.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MultiBranchExpenseForm branches={branches} module="computers" />

        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              הוצאות על כמה סניפים
            </span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{multiExpenses.length}</span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {multiExpenses.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">עדיין לא נרשמה הוצאה על כמה סניפים</p>
            )}
            {multiExpenses.map((e) => {
              const split = splitOf(e);
              const bound = deleteMultiBranchExpenseAction.bind(null, e.id);
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
                      {e.date} · {multiBranchExpenseNote(split)}
                      {e.paidBy === "partner" ? " · שילם: השותף" : " · שילם: אני"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {e.branchIds.map((id) => branchNameById.get(id) ?? id).join(" · ")}
                    </div>
                  </div>
                  <div className="min-w-[75px] text-left font-extrabold text-red-600">
                    {Math.round(e.amount).toLocaleString("he-IL")} ₪
                  </div>
                  <DeleteEntryButton
                    confirmText="למחוק את ההוצאה המשותפת? היא תוסר מכל הסניפים שהיא התחלקה ביניהם."
                    action={bound}
                    successText="ההוצאה נמחקה"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
