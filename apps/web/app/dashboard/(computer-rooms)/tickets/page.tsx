import { Tag } from "lucide-react";
import { getTicketsSnapshotAction } from "./actions";
import { TicketsClient } from "./tickets-client";
import { requireModuleAccess } from "@/lib/perms";

export default async function TicketsPage() {
  await requireModuleAccess("computers");
  const snapshot = await getTicketsSnapshotAction();
  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><Tag className="h-5 w-5" />פניות ותקלות</h1>
      <TicketsClient snapshot={snapshot} />
    </div>
  );
}
