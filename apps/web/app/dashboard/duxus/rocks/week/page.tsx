import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../../duxus-tabs";
import { RocksTabs } from "../rocks-tabs";
import { getMilestonesByWeekKey, getMilestonesByStage, getMilestonesByMonthKey, getAllRocks, getReview, listReviews } from "../actions";
import { currentWeekKey, shiftWeekKey, weekLabel, weekMonthKey } from "../date-utils";
import { WeekClient } from "./week-client";

export default async function RocksWeekPage({ searchParams }: { searchParams: { w?: string } }) {
  await requireModuleAccess("duxus");
  const weekKey = searchParams.w || currentWeekKey();
  const monthKey = weekMonthKey(weekKey);

  const [weekMilestones, allWeekStage, monthMilestones, rocks, review, reviews] = await Promise.all([
    getMilestonesByWeekKey(weekKey),
    getMilestonesByStage("week"),
    getMilestonesByMonthKey(monthKey),
    getAllRocks(),
    getReview("weekly", weekKey),
    listReviews("weekly"),
  ]);

  const overdue = allWeekStage.filter((m) => m.weekKey && m.weekKey !== weekKey && !m.done);
  const monthPool = monthMilestones.filter((m) => m.stage === "month" && !m.done);

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Target className="h-5 w-5" />
        משימות ונהלים
      </h1>
      <DuxusTabs />
      <RocksTabs />
      <WeekClient
        weekKey={weekKey}
        weekLabel={weekLabel(weekKey)}
        prevHref={`/dashboard/duxus/rocks/week?w=${shiftWeekKey(weekKey, -1)}`}
        nextHref={`/dashboard/duxus/rocks/week?w=${shiftWeekKey(weekKey, 1)}`}
        milestones={weekMilestones}
        overdue={overdue}
        monthPool={monthPool}
        rocks={rocks}
        initialReviewNotes={review?.notes ?? ""}
        previousReviews={reviews.filter((r) => r.periodKey !== weekKey)}
      />
    </div>
  );
}
