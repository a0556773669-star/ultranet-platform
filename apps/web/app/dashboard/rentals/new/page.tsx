import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, RentalClient, Laptop, CollectionRoute } from "@ultranet/shared-types";
import { NewRentalForm } from "./new-rental-form";

export default async function NewRentalPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

  const db = getAdminFirestore();
  const [branchesSnap, clientsSnap, laptopsSnap, routesSnap] = await Promise.all([
    db.collection("n_branches").get(),
    db.collection("n_rental_clients").get(),
    db.collection("n_laptops").get(),
    db.collection("n_collection_routes").get(),
  ]);
  const allBranches = branchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch);
  const branches = role === "owner" ? allBranches : allBranches.filter((b) => b.id === myBranchId);
  const clients = clientsSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<RentalClient, "id">) }) as RentalClient,
  );
  const laptops = laptopsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Laptop, "id">) }) as Laptop);
  const routes = routesSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<CollectionRoute, "id">) }) as CollectionRoute,
  );

  const defaultBranchId = role === "owner" ? (branches[0]?.id ?? "") : (myBranchId ?? "");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-800">השכרה חדשה</h1>
      <NewRentalForm
        branches={branches}
        clients={clients}
        laptops={laptops}
        routes={routes}
        defaultBranchId={defaultBranchId}
        lockBranch={role !== "owner"}
      />
    </div>
  );
}
