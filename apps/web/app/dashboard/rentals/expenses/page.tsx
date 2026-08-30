import { redirect } from "next/navigation";
import Link from "next/link";
import { Banknote, Building2, Layers, ArrowRight } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, MultiBranchExpense } from "@ultranet/shared-types";
import { SHARED_RENTALS_BRANCH_ID } from "@/lib/expense-shared-scope";
import { MULTI_BRANCH_EXPENSES_COLLECTION, splitOf, multiBranchExpenseNote } from "@/lib/multi-branch-expense";
import { DeleteEntryButton } from "../../accounting/delete-entry-button";
import { MultiBranchExpenseForm } from "./multi-branch-form";
import { deleteMultiBranchExpenseAction } from "./multi-branch-actions";

export default async function ExpensesHomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const isOwner = session.user?.role === "owner";
  if (!isOwner) {
    const myBranchId = session.user?.branchId;
    if (!myBranchId) redirect("/dashboard/rentals");
    const myDoc = await getAdminFirestore().collection("n_branches").doc(myBranchId).get();
    const myBranch = myDoc.exists ? ({ id: myDoc.id, ...(myDoc.data() as Omit<Branch, "id">) } as Branch) : null;
    if (!myBranch || myBranch.parentBranchId) redirect("/dashboard/rentals");
    redirect(`/dashboard/rentals/expenses/${myBranchId}`);
  }

  const db = getAdminFirestore();
  const [snap, multiSnap] = await Promise.all([
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
    db.collection(MULTI_BRANCH_EXPENSES_COLLECTION).get(),
  ]);
  const branches = snap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted);
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const multiExpenses = multiSnap.docs
    .map((d) => ({ ...(d.data() as Omit<MultiBranchExpense, "id">), id: d.id }) as MultiBranchExpense)
    .filter((e) => e.module === "rentals")
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Banknote className="h-5 w-5" />
          הוצאות — בחר סניף
        </h1>
        <div className="flex flex-col gap-2">
          <Link
            href={`/dashboard/rentals/expenses/${SHARED_RENTALS_BRANCH_ID}`}
            className="flex items-center justify-between rounded-card border border-dashed border-card-border bg-[#f8fafc] p-4 shadow-card transition hover:bg-[#f1f5f9]"
          >
            <span className="flex items-center gap-1.5 font-bold text-ink">
              <Layers className="h-4 w-4" />
              הוצאות משותפות (כל הסניפים)
            </span>
            <ArrowRight className="h-4 w-4 text-muted" />
          </Link>
          {branches.length === 0 && (
            <div className="rounded-card border border-card-border bg-white p-5 text-center text-sm text-muted shadow-card">
              אין עדיין סניפים
            </div>
          )}
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/rentals/expenses/${b.id}`}
              className="flex items-center justify-between rounded-card border border-card-border bg-white p-4 shadow-card transition hover:bg-[#f8fafc]"
            >
              <span className="flex items-center gap-1.5 font-bold text-ink">
                <Building2 className="h-4 w-4" />
                {b.name}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted">
                {b.isMine === false ? "שותפות" : "קלאסי"}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MultiBranchExpenseForm branches={branches} />

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
                <div key={e.id} className="flex items-start gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                  <div className="flex-1">
                    <div className="font-bold text-ink">{e.desc}</div>
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
