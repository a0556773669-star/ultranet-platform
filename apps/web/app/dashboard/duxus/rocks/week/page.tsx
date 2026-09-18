import { getReview, listReviews } from "../actions";
import { TasksShell, loadTasksPage } from "../board-loader";
import { WeekClient } from "./week-client";

export default async function WeekPage({ searchParams }: { searchParams: { q?: string } }) {
  const { quarters, board, today, weekWarning } = await loadTasksPage(searchParams.q);
  const [review, weeklyReviews] = await Promise.all([
    board.activeWeekKey ? getReview("weekly", board.activeWeekKey) : Promise.resolve(null),
    listReviews("weekly"),
  ]);

  return (
    <TasksShell quarterKey={board.quarter.id}>
      <WeekClient
        board={board}
        quarters={quarters}
        today={today}
        weekWarning={weekWarning}
        reviewNotes={review?.notes ?? ""}
        previousReviews={weeklyReviews.filter((r) => r.periodKey !== board.activeWeekKey)}
      />
    </TasksShell>
  );
}
