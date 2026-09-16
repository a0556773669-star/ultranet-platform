import { ListChecks } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getOpsTasksSnapshotAction } from "../actions";
import { OpsTasksClient } from "./tasks-client";

export default async function OperationsTasksPage() {
  await requireModuleAccess("computers");
  const snapshot = await getOpsTasksSnapshotAction();
  return (
    <div className="space-y-3">
      <div>
        <h2 className="flex items-center gap-1.5 text-[17px] font-extrabold text-ink">
          <ListChecks className="h-5 w-5" />
          {"משימות"}
        </h2>
        <p className="text-[13px] text-muted">
          {"משימות שבועיות וחודשיות לסניף. משימה שבועית מתאפסת בכל שבוע, חודשית בכל ראשון לחודש."}
        </p>
      </div>
      <OpsTasksClient snapshot={snapshot} />
    </div>
  );
}
