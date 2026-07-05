import { getTicketsSnapshotAction } from "./actions";
import { TicketsClient } from "./tickets-client";

export default async function TicketsPage() {
  const snapshot = await getTicketsSnapshotAction();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800">🏷️ פניות ותקלות</h1>
      <TicketsClient snapshot={snapshot} />
    </div>
  );
}
