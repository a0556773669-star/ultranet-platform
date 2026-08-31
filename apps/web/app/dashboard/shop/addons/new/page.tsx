import { Backpack } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { AddonForm } from "../addon-form";
import { createAddonAction } from "../actions";

export default async function NewAddonPage({ searchParams }: { searchParams?: { error?: string } }) {
  await requireModuleAccess("shop");

  return (
    <div className="max-w-md">
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Backpack className="h-4 w-4" />
        פריט ציוד נלווה חדש
      </h1>
      {searchParams?.error === "missing" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">חובה למלא שם פריט.</div>
      )}
      <AddonForm action={createAddonAction} submitLabel="שמירה" />
    </div>
  );
}
