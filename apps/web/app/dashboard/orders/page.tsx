import { Package } from "lucide-react";
import { getOrdersSnapshotAction } from "./actions";
import { OrdersClient } from "./orders-client";
import { requireModuleAccess } from "@/lib/perms";

export default async function OrdersPage() {
  await requireModuleAccess("computers");
  const snapshot = await getOrdersSnapshotAction();
  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><Package className="h-5 w-5" />הזמנות ודוחות</h1>
      <OrdersClient snapshot={snapshot} />
    </div>
  );
}
