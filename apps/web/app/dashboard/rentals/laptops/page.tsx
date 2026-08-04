import Link from "next/link";
import { Laptop as LaptopIcon } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Laptop, Branch } from "@ultranet/shared-types";
import { deleteLaptopAction, syncAllSticksAction } from "./actions";
import { LaptopsList } from "./laptops-list";

export default async function LaptopsPage({
  searchParams,
}: {
  searchParams?: { synced?: string };
}) {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;
  const isOwner = role === "owner";

  const db = getAdminFirestore();
  const [laptopsSnap, branchesSnap] = await Promise.all([
    db.collection("n_laptops").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
  ]);
  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const allLaptops = laptopsSnap.docs.map((d) => ({ ...(d.data() as Omit<Laptop, "id">), id: d.id }) as Laptop);
  const laptops = isOwner ? allLaptops : allLaptops.filter((l) => l.branchId === myBranchId);
  const deleteActions = Object.fromEntries(
    laptops.map((l) => [l.id, deleteLaptopAction.bind(null, l.id)])
  ) as Record<string, () => void>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <LaptopIcon className="h-4 w-4" />
          {"מלאי מחשבים"}
        </h1>
        <div className="flex items-center gap-2">
          {isOwner && (
            <form action={syncAllSticksAction}>
              <button
                type="submit"
                className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
                title="יוצר סטיק להשכרה לכל מחשב שעדיין אין לו סטיק תואם (גם אם 'יש סטיק משוייך' לא סומן - זה יסומן אוטומטית)"
              >
                יצירת סטיקים לכל המחשבים
              </button>
            </form>
          )}
          <Link
            href="/dashboard/rentals/laptops/new"
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
          >
            + הוסף מחשב
          </Link>
        </div>
      </div>

      {searchParams?.synced !== undefined && (
        <div className="mb-4 rounded-card border border-teal bg-teal-bg p-3 text-sm font-semibold text-teal-dark">
          {Number(searchParams.synced) > 0
            ? `נוצרו ${searchParams.synced} סטיקים חדשים להשכרה.`
            : "לכל המחשבים כבר יש סטיק להשכרה - אין מה לעדכן."}
        </div>
      )}

      <LaptopsList
        laptops={laptops}
        branches={branches}
        isOwner={isOwner}
        canDelete={role === "owner"}
        deleteActions={deleteActions}
      />
    </div>
  );
}
