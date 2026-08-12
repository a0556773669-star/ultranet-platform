import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../../duxus-tabs";
import { RocksTabs } from "../rocks-tabs";
import { getMilestonesByMonthKey, getMilestonesByStage, getMilestonesForQuarter, getAllRocks, getReview, listReviews } from "../actions";
import { currentMonthKey, shiftMonthKey, monthLabel, monthQuarterKey } from "../date-utils";
import { MonthClient } from "./month-client";

export default async function RocksMonthPage({ searchParams }: { searchParams: { m?: string } }) {
  await requireModuleAccess("duxus");
  const monthKey = searchParams.m || currentMonthKey();
  const quarterKey = monthQuarterKey(monthKey);

  const [monthMilestones, allMonthStage, quarterMilestones, rocks, review, reviews] = await Promise.all([
    getMilestonesByMonthKey(monthKey),
    getMilestonesByStage("month"),
    getMilestonesForQuarter(quarterKey),
    getAllRocks(),
    getReview("monthly", monthKey),
    listReviews("monthly"),
  ]);

  const overdue = allMonthStage.filter((m) => m.monthKey && m.monthKey !== monthKey && !m.done);
  const quarterBacklog = quarterMilestones.filter((m) => m.stage === "backlog");

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Target className="h-5 w-5" />
        משימות ונהלים
      </h1>
      <DuxusTabs />
      <RocksTabs />
      <MonthClient
        monthKey={monthKey}
        monthLabel={monthLabel(monthKey)}
        prevHref={`/dashboard/duxus/rocks/month?m=${shiftMonthKey(monthKey, -1)}`}
        nextHref={`/dashboard/duxus/rocks/month?m=${shiftMonthKey(monthKey, 1)}`}
        milestones={monthMilestones}
        overdue={overdue}
        quarterBacklog={quarterBacklog}
        rocks={rocks}
        initialReviewNotes={review?.notes ?? ""}
        previousReviews={reviews.filter((r) => r.periodKey !== monthKey)}
      />
    </div>
  );
}
