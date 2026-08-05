import { notFound } from "next/navigation";
import { Cpu } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { ShopComputerConfig } from "@ultranet/shared-types";
import { CatalogForm } from "../catalog-form";
import { updateCatalogItemAction, deleteCatalogItemAction } from "../actions";
import { DeleteCatalogItemButton } from "../delete-button";

export default async function EditCatalogItemPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string };
}) {
  await requireModuleAccess("shop");
  const db = getAdminFirestore();
  const doc = await db.collection("n_shop_catalog").doc(params.id).get();
  if (!doc.exists) notFound();
  const item = { id: doc.id, ...(doc.data() as Omit<ShopComputerConfig, "id">) } as ShopComputerConfig;

  return (
    <div className="max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Cpu className="h-4 w-4" />
          {`עריכת תצורה – ${item.name}`}
        </h1>
        <DeleteCatalogItemButton action={deleteCatalogItemAction.bind(null, item.id)} />
      </div>
      {searchParams?.error === "missing" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          חובה למלא שם, מעבד, זיכרון, אחסון ולבחור לפחות תחום שימוש אחד.
        </div>
      )}
      <CatalogForm action={updateCatalogItemAction.bind(null, item.id)} initial={item} submitLabel="עדכון" />
    </div>
  );
}
