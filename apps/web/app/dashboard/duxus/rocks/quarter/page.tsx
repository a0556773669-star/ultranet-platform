import { getReview, listReviews } from "../actions";
import { TasksShell, loadTasksPage } from "../board-loader";
import { QuarterClient } from "./quarter-client";

export default async function QuarterPage({ searchParams }: { searchParams: { q?: string } }) {
  const { quarters, board, today, weekWarning } = await loadTasksPage(searchParams.q);
  const [review, quarterlyReviews] = await Promise.all([getReview("quarterly", board.quarter.id), listReviews("quarterly")]);

  return (
    <TasksShell quarterKey={board.quarter.id}>
      <QuarterClient
        board={board}
        quarters={quarters}
        today={today}
        weekWarning={weekWarning}
        reviewNotes={review?.notes ?? ""}
        previousReviews={quarterlyReviews.filter((r) => r.periodKey !== board.quarter.id)}
      />
    </TasksShell>
  );
}
