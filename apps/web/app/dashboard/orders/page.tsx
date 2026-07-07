import { getOrdersSnapshotAction } from "./actions";
import { OrdersClient } from "./orders-client";

export default async function OrdersPage() {
  const snapshot = await getOrdersSnapshotAction();
  return (
    <div>
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">📦 הזמנות ודוחות</h1>
      <OrdersClient snapshot={snapshot} />
    </div>
  );
}
