import { getTasksSnapshotAction } from "./actions";
import { TasksClient } from "./tasks-client";

export default async function TasksPage() {
  const snapshot = await getTasksSnapshotAction();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-800">✅ משימות</h1>
      <TasksClient snapshot={snapshot} />
    </div>
  );
}
