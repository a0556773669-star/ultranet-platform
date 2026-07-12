import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { RentalClient, Branch } from "@ultranet/shared-types";
import { updateClientAction, deleteClientAction } from "../../actions";
import { ClientForm } from "../client-form";
import { DeleteClientButton } from "../delete-client-button";
import { ClientCardSection } from "../client-card-section";
import { ClientChargeSection } from "../client-charge-section";
import { resolveNedarimCreds } from "@/lib/nedarim";

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

  const db = getAdminFirestore();
  const [clientDoc, branchesSnap] = await Promise.all([
    db.collection("n_rental_clients").doc(params.id).get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
  ]);
  if (!clientDoc.exists) notFound();
  const client = { id: clientDoc.id, ...(clientDoc.data() as Omit<RentalClient, "id">) } as RentalClient;
  if (!isOwner && client.branchId !== myBranchId) notFound();

  const branches = branchesSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch
  );
  const nedarimCreds = await resolveNedarimCreds(client.branchId);

  const boundUpdate = updateClientAction.bind(null, params.id);
  const boundDelete = deleteClientAction.bind(null, params.id);

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">עריכת לקוח 👥</h1>
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
      {nedarimCreds && (
        <ClientCardSection
          clientId={client.id}
          mosadId={nedarimCreds.mosadId}
          apiValid={nedarimCreds.apiValid}
          clientName={client.name}
          clientPhone={client.phone}
          currentLast4={client.cardLast4}
          autoOpen={searchParams?.openCard === "1"}
        />
      )}
      {nedarimCreds && (
        <ClientChargeSection
          mosadId={nedarimCreds.mosadId}
          apiValid={nedarimCreds.apiValid}
          clientName={client.name}
          clientPhone={client.phone}
          clientIdNum={client.idNum}
        />
      )}
      {isOwner && <DeleteClientButton action={boundDelete} />}
    </div>
  );
}
