import { notFound } from "next/navigation";
import { Backpack } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { ShopAddon } from "@ultranet/shared-types";
import { AddonForm } from "../addon-form";
import { updateAddonAction, deleteAddonAction } from "../actions";
import { DeleteAddonButton } from "../delete-button";

export default async function EditAddonPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string };
}) {
  await requireModuleAccess("shop");
  const db = getAdminFirestore();
  const doc = await db.collection("n_shop_addons").doc(params.id).get();
  if (!doc.exists) notFound();
  const item = { id: doc.id, ...(doc.data() as Omit<ShopAddon, "id">) } as ShopAddon;

  return (
    <div className="max-w-md">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Backpack className="h-4 w-4" />
          {`עריכת פריט – ${item.name}`}
        </h1>
        <DeleteAddonButton action={deleteAddonAction.bind(null, item.id)} />
      </div>
      {searchParams?.error === "missing" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">חובה למלא שם פריט.</div>
      )}
      <AddonForm action={updateAddonAction.bind(null, item.id)} initial={item} submitLabel="עדכון" />
    </div>
  );
}
