import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Banknote, ArrowLeft } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { SHARED_EXPENSE_BRANCH_ID } from "@/lib/computer-room-accounting";
import { getOwnerName, resolveSharedPartnerName, branchPartnerName } from "@/lib/owner-name";
import { BranchExpenses } from "../branch-expenses";

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

  const [fixedSnap, variableSnap] = await Promise.all([
    db.collection("n_fixed_expenses").where("branchId", "==", params.id).get(),
    db.collection("n_var_expenses").where("branchId", "==", params.id).get(),
  ]);
  const fixedExpenses = fixedSnap.docs
    .map((d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const variableExpenses = variableSnap.docs
    .map((d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense)
    .sort((a, b) => b.date.localeCompare(a.date));

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
        isPartner={isPartner}
        ownerName={ownerName}
        partnerName={partnerName}
        canManage={isOwner || isPartner}
        canAdd={isOwner || isPartner}
        fixedExpenses={visibleFixed}
        variableExpenses={visibleVariable}
      />
    </div>
  );
}
