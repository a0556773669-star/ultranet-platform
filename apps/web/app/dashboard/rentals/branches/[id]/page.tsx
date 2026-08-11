import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Banknote, ArrowRight } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, CollectionRoute } from "@ultranet/shared-types";
import { RentalBranchForm } from "../rental-branch-form";
import { DeleteRentalBranchButton } from "../delete-button";
import { updateRentalBranchAction, deleteRentalBranchAction } from "../actions";

export default async function RentalBranchDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "owner") redirect("/dashboard/rentals");

  const db = getAdminFirestore();
  const doc = await db.collection("n_branches").doc(params.id).get();
  if (!doc.exists) notFound();
  const branch = { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;

  const [routesSnap, branchesSnap] = await Promise.all([
    db.collection("n_collection_routes").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
  ]);

  const routes = routesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<CollectionRoute, "id">), id: d.id }) as CollectionRoute)
    .map((r) => ({ id: r.id, name: r.name }));

  const parentOptions = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => b.id !== branch.id && (!b.deleted || b.id === branch.parentBranchId))
    .map((b) => ({ id: b.id, name: b.deleted ? `${b.name} (נמחק)` : b.name }));

  const boundUpdate = updateRentalBranchAction.bind(null, branch.id);
  const boundDelete = deleteRentalBranchAction.bind(null, branch.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
          <Building2 className="h-5 w-5" />
          {branch.name}
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/rentals/expenses/${branch.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
          >
            <Banknote className="h-4 w-4" />
            ניהול הוצאות
            <ArrowRight className="h-4 w-4" />
          </Link>
          <form action={boundDelete}>
            <DeleteRentalBranchButton />
          </form>
        </div>
      </div>
      <RentalBranchForm action={boundUpdate} initial={branch} routes={routes} parentOptions={parentOptions} />
    </div>
  );
}
