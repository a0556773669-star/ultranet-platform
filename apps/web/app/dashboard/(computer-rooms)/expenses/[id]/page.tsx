import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Banknote, ArrowLeft } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { SHARED_EXPENSE_BRANCH_ID } from "@/lib/computer-room-accounting";
import { getOwnerName, resolveSharedPartnerName, branchPartnerName } from "@/lib/owner-name";
import { BranchExpenses } from "../branch-expenses";
import { SharedExpensesForBranch } from "../shared-expenses-for-branch";
import { RecurringExpensesCard } from "@/components/recurring-expenses/recurring-expenses-card";
import { loadRecurringVariableExpenses } from "@/lib/recurring-expenses";
import { loadRecurringPurchaseIndex } from "@/lib/recurring-purchases";
import { RecurringPurchasesSummary } from "@/components/recurring-purchases/recurring-purchases-summary";

export default async function ComputerRoomBranchExpensesPage({ params }: { params: { id: string } }) {
  const session = await requireModuleAccess("computers");
  const isOwner = session.user?.role === "owner";
  const myBranchId = session.user?.branchId;

  const isShared = params.id === SHARED_EXPENSE_BRANCH_ID;
  if (isShared && !isOwner) redirect("/dashboard/expenses");
  if (!isShared && !isOwner && params.id !== myBranchId) redirect("/dashboard/expenses");

  const db = getAdminFirestore();
  let branch: Branch | null = null;
  let isPartner = false;
  let partnerName = "השותף";
  const ownerName = await getOwnerName(isOwner ? session.user?.name : undefined);

  if (!isShared) {
    const doc = await db.collection("n_branches").doc(params.id).get();
    if (!doc.exists) notFound();
    branch = { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;
    if (branch.branchType !== "computers") notFound();
    isPartner = branch.isMine === false;
    partnerName = branchPartnerName(branch);
  } else {
    const resolved = await resolveSharedPartnerName("computers");
    isPartner = resolved.hasPartner;
    partnerName = resolved.partnerName;
  }

  // הסניפים נטענים תמיד: בספר המשותף הם רשימת הבחירה של "על מי ההוצאה חלה", ובמסך של סניף
  // בודד הם המחלק שמסביר כמה הוא נושא מכל הוצאה משותפת.
  const [fixedSnap, variableSnap, recurring, purchaseIndex, branchesSnap, sharedFixedSnap, sharedVariableSnap] =
    await Promise.all([
    db.collection("n_fixed_expenses").where("branchId", "==", params.id).get(),
    db.collection("n_var_expenses").where("branchId", "==", params.id).get(),
    loadRecurringVariableExpenses({ scope: "computers", branchId: params.id }),
    loadRecurringPurchaseIndex(),
    db.collection("n_branches").where("branchType", "==", "computers").get(),
    isShared
      ? Promise.resolve(null)
      : db.collection("n_fixed_expenses").where("branchId", "==", SHARED_EXPENSE_BRANCH_ID).get(),
    isShared
      ? Promise.resolve(null)
      : db.collection("n_var_expenses").where("branchId", "==", SHARED_EXPENSE_BRANCH_ID).get(),
    ]);
  const computerBranches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  const sharedFixed = (sharedFixedSnap?.docs ?? []).map(
    (d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense,
  );
  const sharedVariable = (sharedVariableSnap?.docs ?? []).map(
    (d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense,
  );
  const fixedExpenses = fixedSnap.docs
    .map((d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const variableExpenses = variableSnap.docs
    .map((d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense)
    .sort((a, b) => b.date.localeCompare(a.date));

  // רק הסוגים שבאמת מופיעים בהוצאות של המסך הזה - אבל הסכומים שלהם הם של כל העסק.
  const purchaseSummaries = [
    ...new Set(variableExpenses.map((e) => e.expenseTypeId).filter((id): id is string => Boolean(id))),
  ]
    .map((id) => purchaseIndex.byType.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const hiddenFromPartner = (e: { paidBy?: string; owedBy?: string }) => e.paidBy === "owner" && e.owedBy === "owner";
  const visibleFixed = isOwner || !isPartner ? fixedExpenses : fixedExpenses.filter((e) => !hiddenFromPartner(e));
  const visibleVariable = isOwner || !isPartner ? variableExpenses : variableExpenses.filter((e) => !hiddenFromPartner(e));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
          <Banknote className="h-5 w-5" />
          הוצאות — {isShared ? "כל הסניפים" : branch?.name}
        </h1>
        <Link href="/dashboard/expenses" className="flex items-center gap-1.5 text-xs font-bold text-teal hover:underline">
          <ArrowLeft className="h-4 w-4" />
          בחירת סניף אחר
        </Link>
      </div>
      <BranchExpenses
        branchId={params.id}
        isShared={isShared}
        branches={computerBranches.map((b) => ({ id: b.id, name: b.name }))}
        isPartner={isPartner}
        ownerName={ownerName}
        partnerName={partnerName}
        canManage={isOwner || isPartner}
        canAdd={isOwner || isPartner}
        fixedExpenses={visibleFixed}
        variableExpenses={visibleVariable}
        expenseTypes={purchaseIndex.types}
        purchaseByType={purchaseIndex.byType}
      />
      {!isShared && (
        <SharedExpensesForBranch
          branchId={params.id}
          branches={computerBranches}
          sharedFixed={sharedFixed}
          sharedVariable={sharedVariable}
        />
      )}
      <RecurringPurchasesSummary summaries={purchaseSummaries} />
      <RecurringExpensesCard
        scope="computers"
        branchId={params.id}
        expenses={recurring}
        canManage={isOwner || isPartner}
      />
    </div>
  );
}
