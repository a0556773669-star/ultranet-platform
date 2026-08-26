import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CollectionRoute, Branch } from "@ultranet/shared-types";
import { createCollectionRouteAction, deleteCollectionRouteAction } from "../actions";
import { AccountingTabs } from "../accounting-tabs";
import { DeleteRouteButton } from "./delete-route-button";
import { RouteForm } from "./route-form";

const PROVIDER_LABELS: Record<string, string> = {
  manual: "ידני",
  nedarim_plus: "Nedarim Plus",
  tranzila: "Tranzila",
  cardcom: "Cardcom",
};

export default async function CollectionRoutesPage() {
  const session = await requireModuleAccess("accounting");
  const isOwner = session.user?.role === "owner";

  const db = getAdminFirestore();
  const [routesSnap, branchesSnap] = await Promise.all([
    db.collection("n_collection_routes").get(),
    db.collection("n_branches").get(),
  ]);
  const routes = routesSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<CollectionRoute, "id">), id: d.id }) as CollectionRoute,
  );
  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const branchName = (id: string | null) =>
    id ? (branches.find((b) => b.id === id)?.name ?? "-") : "כל הסניפים";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <CreditCard className="h-5 w-5" />
          מסלולי גביה
        </h1>
        <AccountingTabs active="/dashboard/accounting/routes" />
      </div>

      {isOwner && <RouteForm action={createCollectionRouteAction} submitLabel="הוספת מסלול" />}

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f4f6f9] text-muted">
            <tr>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">שם</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">ספק</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">היקף</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">יעד הפקדה</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">כרטיסים חדשים</th>
              <th className="px-[11px] py-[9px]"></th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => {
              const bound = deleteCollectionRouteAction.bind(null, r.id);
              return (
                <tr key={r.id} className="border-t border-card-border transition hover:bg-[#f8fafc]">
                  <td className="px-[11px] py-2 font-semibold text-ink">{r.name}</td>
                  <td className="px-[11px] py-2 text-muted">{PROVIDER_LABELS[r.provider] ?? r.provider}</td>
                  <td className="px-[11px] py-2 text-muted">{branchName(r.branchScope)}</td>
                  <td className="px-[11px] py-2 text-muted">{r.depositsTo === "owner" ? "בעלים" : "סניף"}</td>
                  <td className="px-[11px] py-2">
                    {r.defaultForNewCards && (
                      <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">
                        ברירת מחדל
                      </span>
                    )}
                  </td>
                  <td className="px-[11px] py-2">
                    {isOwner && (
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/dashboard/accounting/routes/${r.id}`}
                          className="text-xs font-bold text-teal hover:underline"
                        >
                          עריכה
                        </Link>
                        <form action={bound}>
                          <DeleteRouteButton />
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
