import Link from "next/link";
import { Laptop as LaptopIcon } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Laptop, Branch, FixedExpense, LaptopSale } from "@ultranet/shared-types";
import { LAPTOP_SALES_COLLECTION } from "@/lib/branch-accounting-data";
import { deleteLaptopAction, syncAllSticksAction } from "./actions";
import { LaptopsList } from "./laptops-list";
import { LaptopRenameTool } from "./laptop-rename-tool";
import type { BranchFixedExpenseOption } from "./laptop-exit-modal";

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
  const [laptopsSnap, branchesSnap, fixedSnap, salesSnap] = await Promise.all([
    db.collection("n_laptops").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection(LAPTOP_SALES_COLLECTION).get(),
  ]);
  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted);
  const allLaptops = laptopsSnap.docs.map((d) => ({ ...(d.data() as Omit<Laptop, "id">), id: d.id }) as Laptop);
  const laptops = isOwner ? allLaptops : allLaptops.filter((l) => l.branchId === myBranchId);
  const visibleBranchIds = new Set(laptops.map((l) => l.branchId));
  const today = new Date().toISOString().slice(0, 10);
  // ההוצאות הקבועות הפעילות של כל סניף (לא של הספר המשותף) — לשאלה שנשאלת כשמחשב יוצא.
  const expensesByBranch: Record<string, BranchFixedExpenseOption[]> = {};
  for (const d of fixedSnap.docs) {
    const e = d.data() as Omit<FixedExpense, "id">;
    if (!visibleBranchIds.has(e.branchId)) continue;
    if (e.endDate && e.endDate < today) continue;
    (expensesByBranch[e.branchId] ??= []).push({
      id: d.id,
      name: e.name || "הוצאה קבועה",
      amount: e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0,
      category: e.category,
    });
  }
  const sales = salesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<LaptopSale, "id">), id: d.id }) as LaptopSale)
    .filter((sale) => visibleBranchIds.has(sale.branchId));
  const canSell = isOwner || role === "partner";

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
          {isOwner && <LaptopRenameTool branchNames={Object.fromEntries(branches.map((b) => [b.id, b.name]))} />}
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
        canSell={canSell}
        deleteActions={deleteActions}
        expensesByBranch={expensesByBranch}
        sales={sales}
      />
    </div>
  );
}
