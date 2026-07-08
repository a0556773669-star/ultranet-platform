import { getTasksSnapshotAction } from "./actions";
import { TasksClient } from "./tasks-client";
import { requireModuleAccess } from "@/lib/perms";

export default async function TasksPage() {
  await requireModuleAccess("tasks");
  const snapshot = await getTasksSnapshotAction();
  return (
    <div>
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">✅ משימות</h1>
      <TasksClient snapshot={snapshot} />
    </div>
  );
}
