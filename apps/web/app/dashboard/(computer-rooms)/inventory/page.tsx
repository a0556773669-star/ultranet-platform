import { Package } from "lucide-react";
import { getInventorySnapshotAction } from "./actions";
import { InventoryClient } from "./inventory-client";
import { requireModuleAccess } from "@/lib/perms";

export default async function InventoryPage() {
  await requireModuleAccess("computers");
  const snapshot = await getInventorySnapshotAction();
  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><Package className="h-5 w-5" />מלאי</h1>
      <InventoryClient snapshot={snapshot} />
    </div>
  );
}
