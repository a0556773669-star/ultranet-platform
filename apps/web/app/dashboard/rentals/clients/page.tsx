import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { RentalClient, Branch } from "@ultranet/shared-types";
import { createClientAction, importClientsAction } from "../actions";
import { ClientsHeader } from "./clients-header";
import { ClientsTable } from "./clients-table";

export default async function RentalClientsPage({
  searchParams,
}: {
  searchParams?: {
    error?: string;
    importError?: string;
    imported?: string;
    updated?: string;
    skipped?: string;
    reason?: string | string[];
    reasonMore?: string;
  };
}) {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;
  const isOwner = role === "owner";
  const viewClientBranchIds = (session.user as { viewClientBranchIds?: string[] } | undefined)?.viewClientBranchIds ?? [];
  const perms = (session.user as { perms?: Partial<Record<string, boolean>> } | undefined)?.perms;
  const canCharge = isOwner || !!perms?.charging;

  const db = getAdminFirestore();
  const [clientsSnap, branchesSnap] = await Promise.all([
    db.collection("n_rental_clients").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
  ]);
  const branches = branchesSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch
  );
  const allClients = clientsSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<RentalClient, "id">), id: d.id }) as RentalClient
  );
  const clients = isOwner
    ? allClients
    : allClients.filter((c) => c.branchId === myBranchId || viewClientBranchIds.includes(c.branchId));
  // "מה ששלי" = הסניף שלי + סניפים שמוגדרים תחתיו (parentBranchId)
  const myScopeBranchIds = new Set(
    branches.filter((b) => b.id === myBranchId || b.parentBranchId === myBranchId).map((b) => b.id)
  );

  return (
    <div>
      <ClientsHeader
        action={createClientAction}
        branches={branches}
        isOwner={isOwner}
        myBranchId={myBranchId}
        defaultOpen={searchParams?.error === "missing"}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <a
          href="/api/rentals/clients/export"
          className="rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-[#f4f6f9]"
        >
          יצוא לאקסל
        </a>
        <a
          href="/api/rentals/clients/template"
          className="rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-[#f4f6f9]"
        >
          הורדת תבנית לייבוא
        </a>
        <a
          href="/dashboard/rentals/clients/complete-cards"
          className="rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-[#f4f6f9]"
        >
          השלמת כרטיסים חסרים
        </a>
        <form
          action={importClientsAction}
          className="flex items-center gap-2 rounded-[10px] border border-card-border bg-white px-3 py-1.5"
        >
          <input type="file" name="file" accept=".xlsx,.xls" required className="text-xs" />
          <button type="submit" className="text-xs font-bold text-teal hover:underline">
            ייבוא מאקסל
          </button>
        </form>
      </div>

      {searchParams?.importError === "missing" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          יש לבחור קובץ אקסל לפני לחיצה על ייבוא מאקסל.
        </div>
      )}
      {(searchParams?.imported !== undefined || searchParams?.updated !== undefined) && (
        <div className="mb-4 rounded-card border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-700">
          <div>
            הייבוא הסתיים: נוצרו {searchParams?.imported ?? 0} לקוחות חדשים, עודכנו {searchParams?.updated ?? 0} קיימים
            {Number(searchParams?.skipped ?? 0) > 0 && `, דולגו ${searchParams?.skipped} שורות`}.
          </div>
          {searchParams?.reason && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs font-normal text-teal-800">
              {(Array.isArray(searchParams.reason) ? searchParams.reason : [searchParams.reason]).map(
                (reason, i) => (
                  <li key={i}>{reason}</li>
                )
              )}
              {searchParams?.reasonMore && <li>ועוד {searchParams.reasonMore} שורות שדולגו מסיבות דומות</li>}
            </ul>
          )}
        </div>
      )}

      {searchParams?.error === "missing" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          חובה לבחור סניף ולמלא שם לקוח לפני השמירה.
        </div>
      )}
      {searchParams?.error === "forbidden" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          פעולה זו מותרת רק לבעלים.
        </div>
      )}

      <ClientsTable
        clients={clients}
        myScopeBranchIds={Array.from(myScopeBranchIds)}
        showBranchColumn={isOwner || viewClientBranchIds.length > 0}
        branches={branches}
        canCharge={canCharge}
      />
    </div>
  );
}
