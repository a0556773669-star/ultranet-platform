import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { BranchExpenses } from "../branch-expenses";

export default async function BranchExpensesPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "owner") redirect("/dashboard/rentals");

  const db = getAdminFirestore();
  const doc = await db.collection("n_branches").doc(params.id).get();
  if (!doc.exists) notFound();
  const branch = { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;

  const [fixedSnap, variableSnap] = await Promise.all([
    db.collection("n_fixed_expenses").where("branchId", "==", branch.id).get(),
    db.collection("n_var_expenses").where("branchId", "==", branch.id).get(),
  ]);
  const fixedExpenses = fixedSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<FixedExpense, "id">) }) as FixedExpense)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const variableExpenses = variableSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<VariableExpense, "id">) }) as VariableExpense)
    .sort((a, b) => b.date.localeCompare(a.date));

  const isPartner = branch.isMine === false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-ink">💸 הוצאות — {branch.name}</h1>
        <Link href="/dashboard/rentals/expenses" className="text-xs font-bold text-teal hover:underline">
          ← בחירת סניף אחר
        </Link>
      </div>
      <BranchExpenses branchId={branch.id} isPartner={isPartner} fixedExpenses={fixedExpenses} variableExpenses={variableExpenses} />
    </div>
  );
}
