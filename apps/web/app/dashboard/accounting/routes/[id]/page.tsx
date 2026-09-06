import { notFound } from "next/navigation";
import { CreditCard } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CollectionRoute } from "@ultranet/shared-types";
import { updateCollectionRouteAction } from "../../actions";
import { AccountingTabs } from "../../accounting-tabs";
import { RouteForm } from "../route-form";

export default async function EditCollectionRoutePage({ params }: { params: { id: string } }) {
  await requireOwner();

  const doc = await getAdminFirestore().collection("n_collection_routes").doc(params.id).get();
  if (!doc.exists) notFound();
  const route = { id: doc.id, ...(doc.data() as Omit<CollectionRoute, "id">) } as CollectionRoute;

  const boundUpdate = updateCollectionRouteAction.bind(null, route.id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <CreditCard className="h-5 w-5" />
          עריכת מסלול גביה
        </h1>
        <AccountingTabs active="/dashboard/accounting/routes" />
      </div>
      <div className="rounded-card border border-card-border bg-white p-5 shadow-card">
        <RouteForm action={boundUpdate} submitLabel="שמירת שינויים" initial={route} />
      </div>
    </div>
  );
}
