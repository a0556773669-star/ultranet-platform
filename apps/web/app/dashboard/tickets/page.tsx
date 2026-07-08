import { getTicketsSnapshotAction } from "./actions";
import { TicketsClient } from "./tickets-client";
import { requireModuleAccess } from "@/lib/perms";

export default async function TicketsPage() {
  await requireModuleAccess("computers");
  const snapshot = await getTicketsSnapshotAction();
  return (
    <div>
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">🏷️ פניות ותקלות</h1>
      <TicketsClient snapshot={snapshot} />
    </div>
  );
}
