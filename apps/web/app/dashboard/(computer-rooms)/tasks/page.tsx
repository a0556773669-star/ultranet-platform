import { CheckCircle2 } from "lucide-react";
import { getTasksSnapshotAction } from "./actions";
import { TasksClient } from "./tasks-client";
import { requireModuleAccess } from "@/lib/perms";

export default async function TasksPage() {
  await requireModuleAccess("tasks");
  const snapshot = await getTasksSnapshotAction();
  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><CheckCircle2 className="h-5 w-5" />משימות</h1>
      <TasksClient snapshot={snapshot} />
    </div>
  );
}
