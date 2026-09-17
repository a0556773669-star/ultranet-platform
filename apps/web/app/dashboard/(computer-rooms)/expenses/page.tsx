import { redirect } from "next/navigation";
import Link from "next/link";
import { Banknote, Layers } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { SHARED_EXPENSE_BRANCH_ID } from "@/lib/computer-room-accounting";
import { countsToMain } from "@/lib/counts-to-main";
import { currentMonth, fixedExpenseAccrued } from "@/lib/main-ledger";
import { BranchExpenseTable, type BranchExpenseRow } from "@/components/expenses/branch-expense-table";

export default async function ComputerRoomExpensesHomePage() {
  // מנהלים בלבד: עובד חדר מחשבים מתפעל מלאי ומשימות, ואת הוצאות הסניף רואה מי שמנהל אותו.
  const session = await requireModuleAccess("computers", { managerOnly: true });
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
  const [branchesSnap, fixedSnap, variableSnap] = await Promise.all([
    db.collection("n_branches").where("branchType", "==", "computers").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

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

  // הספר המשותף כשורה בטבלה, עם המספרים שלו - כדי שהוצאה שנרשמה על כל הסניפים לא תהיה
  // המספר היחיד במסך שאי אפשר לראות לפני שהוא כבר התחלק בין הסניפים.
  const sharedFixed = allFixed.filter((e) => e.branchId === SHARED_EXPENSE_BRANCH_ID);
  const sharedVariable = allVariable.filter((e) => e.branchId === SHARED_EXPENSE_BRANCH_ID);
  let sharedTotal = 0;
  let sharedToMain = 0;
  for (const e of sharedFixed) {
    const accrued = fixedExpenseAccrued(e, upto);
    sharedTotal += accrued;
    if (countsToMain(e)) sharedToMain += accrued;
  }
  for (const e of sharedVariable) {
    sharedTotal += e.amount || 0;
    if (countsToMain(e)) sharedToMain += e.amount || 0;
  }

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
        <BranchExpenseTable
          rows={rows}
          hrefFor={(id) => `/dashboard/expenses/${id}`}
          sharedRow={{
            href: `/dashboard/expenses/${SHARED_EXPENSE_BRANCH_ID}`,
            label: "הוצאות על כל הסניפים יחד",
            fixedCount: sharedFixed.length,
            variableCount: sharedVariable.length,
            total: sharedTotal,
            toMain: sharedToMain,
          }}
        />
        <p className="mt-1.5 px-1 text-[11.5px] leading-relaxed text-muted">
          השורה העליונה היא <b>הספר המשותף</b> — הוצאות שנרשמו על כמה סניפים יחד ומתחלקות ביניהם
          בהנה&quot;ח. אפשר לבחור לכל הוצאה כזו על אילו סניפים היא חלה, כך שסניף חדש לא יירש
          אוטומטית הוצאה שלא קשורה אליו.
        </p>
        <p className="mt-1 px-1 text-[11.5px] leading-relaxed text-muted">
          עמודת <b>&quot;מזה לראשי&quot;</b> היא מה שנספר בהנה&quot;ח הראשית. הוצאה שלא סומנה נשארת בספר של
          הסניף בלבד ולא נכנסת לשורה התחתונה של העסק.
        </p>
      </div>
    </div>
  );
}
