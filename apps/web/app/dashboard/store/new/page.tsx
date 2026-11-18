import { ShoppingBag } from "lucide-react";
import { currentModuleScope, requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { StoreTabs } from "../store-tabs";
import { advisorConfigured } from "@/lib/store-advisor";
import { RequestWizard } from "./request-wizard";

export default async function NewStoreRequestPage() {
  await requireModuleAccess("store");
  const scope = await currentModuleScope("store");
  const snap = await getAdminFirestore().collection("n_branches").get();
  const branches = snap.docs
    .map((d) => ({ id: d.id, name: String((d.data() as { name?: string }).name ?? ""), deleted: Boolean((d.data() as { deleted?: boolean }).deleted) }))
    .filter((b) => !b.deleted && b.name && (scope?.isOwner || scope?.allows(b.id)))
    .sort((a, b) => a.name.localeCompare(b.name, "he"))
    .map(({ id, name }) => ({ id, name }));

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <ShoppingBag className="h-5 w-5" />
        התאמת מחשב ללקוח
      </h1>
      <StoreTabs isOwner={Boolean(scope?.isOwner)} />
      <RequestWizard branches={branches} aiEnabled={advisorConfigured()} />
    </div>
  );
}
