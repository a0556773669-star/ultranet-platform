import { Tag } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { loadPriceGuide } from "@/lib/store-price-guide";
import { advisorConfigured } from "@/lib/store-advisor";
import { StoreTabs } from "../store-tabs";
import { PricesForm } from "./prices-form";

export const dynamic = "force-dynamic";

export default async function PricesPage() {
  await requireOwner();
  const guide = await loadPriceGuide();
  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Tag className="h-5 w-5" />
        מחירון שוק
      </h1>
      <StoreTabs isOwner />
      <PricesForm guide={guide} aiEnabled={advisorConfigured()} />
    </div>
  );
}
