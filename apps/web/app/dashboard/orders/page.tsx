import { getOrdersSnapshotAction } from "./actions";
import { OrdersClient } from "./orders-client";
import { requireModuleAccess } from "@/lib/perms";

export default async function OrdersPage() {
  await requireModuleAccess("computers");
  const snapshot = await getOrdersSnapshotAction();
  return (
    <div>
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">📦 הזמנות ודוחות</h1>
      <OrdersClient snapshot={snapshot} />
    </div>
  );
}
