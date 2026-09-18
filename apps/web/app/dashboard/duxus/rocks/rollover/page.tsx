import { TasksShell, loadTasksPage } from "../board-loader";
import { RolloverClient } from "./rollover-client";

export default async function RolloverPage({ searchParams }: { searchParams: { q?: string } }) {
  const { board } = await loadTasksPage(searchParams.q);

  return (
    <TasksShell quarterKey={board.quarter.id}>
      <RolloverClient quarter={board.quarter} rocks={board.rocks} milestones={board.milestones} />
    </TasksShell>
  );
}
