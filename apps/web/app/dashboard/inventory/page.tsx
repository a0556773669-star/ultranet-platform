import { getInventorySnapshotAction } from "./actions";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const snapshot = await getInventorySnapshotAction();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800">📦 מלאי</h1>
      <InventoryClient snapshot={snapshot} />
    </div>
  );
}
