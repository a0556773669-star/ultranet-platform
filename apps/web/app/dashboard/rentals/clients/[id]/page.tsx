import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { RentalClient, Branch } from "@ultranet/shared-types";
import { updateClientAction, deleteClientAction } from "../../actions";
import { ClientForm } from "../client-form";
import { DeleteClientButton } from "../delete-client-button";
import { ClientCardSection } from "../client-card-section";
import { ClientChargeSection } from "../client-charge-section";
import { resolveNedarimCreds, listNedarimRoutes } from "@/lib/nedarim";

export default async function EditClientPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string; openCard?: string };
}) {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;
  const isOwner = role === "owner";
  const perms = (session.user as { perms?: Partial<Record<string, boolean>> } | undefined)?.perms;
  const canCharge = isOwner || !!perms?.charging;
  const canDeleteClient = isOwner || role === "partner";

  const db = getAdminFirestore();
  const [clientDoc, branchesSnap, routes] = await Promise.all([
    db.collection("n_rental_clients").doc(params.id).get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
    listNedarimRoutes(),
  ]);
  if (!clientDoc.exists) notFound();
  const client = { id: clientDoc.id, ...(clientDoc.data() as Omit<RentalClient, "id">) } as RentalClient;
  if (!isOwner && client.branchId !== myBranchId) notFound();

  const branches = branchesSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch
  );
  // route the client's saved token is actually effective through - used only to show its business
  // name in the migration nudge, never to decide which route new cards get saved under
  const currentRouteCreds = client.cardLast4
    ? await resolveNedarimCreds(client.branchId, client.collectionRouteId ?? undefined)
    : null;

  const boundUpdate = updateClientAction.bind(null, params.id);
  const boundDelete = deleteClientAction.bind(null, params.id);

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        עריכת לקוח
        <Users className="h-5 w-5" />
      </h1>
      {searchParams?.error === "missing" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          חובה לבחור סניף ולמלא שם לקוח לפני השמירה.
        </div>
      )}
      <ClientForm
        action={boundUpdate}
        branches={branches}
        isOwner={isOwner}
        myBranchId={myBranchId}
        initial={client}
      />
      {routes.length > 0 && (
        <ClientCardSection
          clientId={client.id}
          routes={routes}
          clientName={client.name}
          clientPhone={client.phone}
          currentLast4={client.cardLast4}
          currentRouteId={client.collectionRouteId}
          currentRouteName={currentRouteCreds?.name}
          autoOpen={searchParams?.openCard === "1"}
        />
      )}
      {routes.length > 0 && canCharge && (
        <ClientChargeSection
          routes={routes}
          clientName={client.name}
          clientPhone={client.phone}
          clientIdNum={client.idNum}
        />
      )}
      {canDeleteClient && <DeleteClientButton action={boundDelete} />}
    </div>
  );
}
