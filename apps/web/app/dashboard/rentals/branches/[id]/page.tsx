import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, CollectionRoute, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { updateRentalBranchAction, deleteRentalBranchAction } from "../actions";
import { RentalBranchForm } from "../rental-branch-form";
import { DeleteRentalBranchButton } from "../delete-button";
import { BranchExpenses } from "../branch-expenses";

export default async function RentalBranchDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "owner") redirect("/dashboard/rentals");

  const db = getAdminFirestore();
  const doc = await db.collection("n_branches").doc(params.id).get();
  if (!doc.exists) notFound();
  const branch = { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;

  const [routesSnap, branchesSnap, fixedSnap, variableSnap] = await Promise.all([
    db.collection("n_collection_routes").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
    db.collection("n_fixed_expenses").where("branchId", "==", branch.id).get(),
    db.collection("n_var_expenses").where("branchId", "==", branch.id).get(),
  ]);

  const routes = routesSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<CollectionRoute, "id">) }) as CollectionRoute)
    .map((r) => ({ id: r.id, name: r.name }));

  const parentOptions = branchesSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch)
    .filter((b) => b.id !== branch.id)
    .map((b) => ({ id: b.id, name: b.name }));

  const fixedExpenses = fixedSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<FixedExpense, "id">) }) as FixedExpense)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const variableExpenses = variableSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<VariableExpense, "id">) }) as VariableExpense)
    .sort((a, b) => b.date.localeCompare(a.date));

  const isPartner = branch.isMine === false;

  const boundUpdate = updateRentalBranchAction.bind(null, branch.id);
  const boundDelete = deleteRentalBranchAction.bind(null, branch.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-ink">{`🏢 ${branch.name}`}</h2>
        <form action={boundDelete}>
          <DeleteRentalBranchButton />
        </form>
      </div>
      <RentalBranchForm action={boundUpdate} initial={branch} routes={routes} parentOptions={parentOptions} />
      <BranchExpenses
        branchId={branch.id}
        isPartner={isPartner}
        fixedExpenses={fixedExpenses}
        variableExpenses={variableExpenses}
      />
    </div>
  );
}
