import { Cpu } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { CatalogForm } from "../catalog-form";
import { createCatalogItemAction } from "../actions";

export default async function NewCatalogItemPage({ searchParams }: { searchParams?: { error?: string } }) {
  await requireModuleAccess("shop");

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Cpu className="h-4 w-4" />
        תצורה חדשה
      </h1>
      {searchParams?.error === "missing" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          חובה למלא שם, מעבד, זיכרון, אחסון ולבחור לפחות תחום שימוש אחד.
        </div>
      )}
      <CatalogForm action={createCatalogItemAction} submitLabel="שמירה" />
    </div>
  );
}
