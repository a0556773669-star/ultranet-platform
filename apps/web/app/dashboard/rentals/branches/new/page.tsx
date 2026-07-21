import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, CollectionRoute } from "@ultranet/shared-types";
import { createRentalBranchAction } from "../actions";
import { RentalBranchForm } from "../rental-branch-form";

export default async function NewRentalBranchPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "owner") redirect("/dashboard/rentals");

  const db = getAdminFirestore();
  const [routesSnap, branchesSnap] = await Promise.all([
    db.collection("n_collection_routes").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
  ]);

  const routes = routesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<CollectionRoute, "id">), id: d.id }) as CollectionRoute)
    .map((r) => ({ id: r.id, name: r.name }));

  const parentOptions = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
        <Plus className="h-4 w-4" />
        {"הוספת סניף השכרות"}
      </h2>
      <RentalBranchForm action={createRentalBranchAction} routes={routes} parentOptions={parentOptions} />
    </div>
  );
}
