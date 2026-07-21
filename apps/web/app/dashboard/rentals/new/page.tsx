import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, RentalClient, Laptop, Stick, CollectionRoute, Rental } from "@ultranet/shared-types";
import { NewRentalForm } from "./new-rental-form";

export default async function NewRentalPage({
  searchParams,
}: {
  searchParams?: { error?: string; mine?: string };
}) {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;
  const onlyMine = searchParams?.mine === "1";

  const db = getAdminFirestore();
  const [branchesSnap, clientsSnap, laptopsSnap, sticksSnap, routesSnap, activeRentalsSnap] = await Promise.all([
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
    db.collection("n_rental_clients").get(),
    db.collection("n_laptops").get(),
    db.collection("n_sticks").get(),
    db.collection("n_collection_routes").get(),
    db.collection("n_rentals").where("status", "==", "active").get(),
  ]);
  const allBranches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const branches = role === "owner" ? (onlyMine ? allBranches.filter((b) => b.isMine === true) : allBranches) : allBranches.filter((b) => b.id === myBranchId);
  const clients = clientsSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<RentalClient, "id">), id: d.id }) as RentalClient
  );
  const laptops = laptopsSnap.docs.map((d) => ({ ...(d.data() as Omit<Laptop, "id">), id: d.id }) as Laptop);
  const sticks = sticksSnap.docs.map((d) => ({ ...(d.data() as Omit<Stick, "id">), id: d.id }) as Stick);
  const routes = routesSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<CollectionRoute, "id">), id: d.id }) as CollectionRoute
  );
  const activeRentals = activeRentalsSnap.docs.map((d) => d.data() as Omit<Rental, "id">);
  const rentedLaptopIds = activeRentals.filter((r) => r.kind === "laptop").map((r) => r.itemId);
  const rentedStickIds = activeRentals.filter((r) => r.kind === "stick").map((r) => r.itemId);

  const ownerHomeBranchId = myBranchId && myBranchId !== "all" && branches.some((b) => b.id === myBranchId) ? myBranchId : "";
  const defaultBranchId =
    role === "owner" ? (ownerHomeBranchId || branches[0]?.id || "") : (myBranchId ?? "");
  const noBranch = (role !== "owner" || onlyMine) && branches.length === 0;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-[21px] font-extrabold text-ink">השכרה חדשה</h1>
      {(searchParams?.error === "missing" ||
        searchParams?.error === "no-branch" ||
        searchParams?.error === "already-rented" ||
        noBranch) && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {noBranch || searchParams?.error === "no-branch"
            ? "החשבון שלך לא משויך כרגע לסניף. נסה להתנתק ולהתחבר מחדש (השיוך מתעדכן אוטומטית תוך כ-2 דקות), או פנה לבעלים לשיוך סניף בעמוד המשתמשים."
            : searchParams?.error === "already-rented"
            ? "מחשב/סטיק זה כבר מושכר כרגע - יש להחזיר את ההשכרה הפעילה שלו לפני פתיחת השכרה חדשה."
            : "חובה לבחור לקוח, מחשב/סטיק ותאריך התחלה לפני השמירה."}
        </div>
      )}
      {!noBranch && (
        <NewRentalForm
          branches={branches}
          clients={clients}
          laptops={laptops}
          sticks={sticks}
          routes={routes}
          defaultBranchId={defaultBranchId}
          lockBranch={role !== "owner" || onlyMine}
          rentedLaptopIds={rentedLaptopIds}
          rentedStickIds={rentedStickIds}
        />
      )}
    </div>
  );
}
