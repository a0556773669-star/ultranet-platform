import { getReview, listReviews } from "../actions";
import { TasksShell, loadTasksPage } from "../board-loader";
import { MonthClient } from "./month-client";

export default async function MonthPage({ searchParams }: { searchParams: { q?: string } }) {
  const { quarters, board, today, weekWarning } = await loadTasksPage(searchParams.q);
  const [review, monthlyReviews] = await Promise.all([
    board.activeMonthKey ? getReview("monthly", board.activeMonthKey) : Promise.resolve(null),
    listReviews("monthly"),
  ]);

  return (
    <TasksShell quarterKey={board.quarter.id}>
      <MonthClient
        board={board}
        quarters={quarters}
        today={today}
        weekWarning={weekWarning}
        reviewNotes={review?.notes ?? ""}
        previousReviews={monthlyReviews.filter((r) => r.periodKey !== board.activeMonthKey)}
      />
    </TasksShell>
  );
}
