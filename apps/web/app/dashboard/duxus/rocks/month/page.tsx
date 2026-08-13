import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../../duxus-tabs";
import { RocksTabs } from "../rocks-tabs";
import { getMilestonesForQuarter, getMilestonesByStage, getAllRocks, getReview, listReviews } from "../actions";
import { currentMonthKey, shiftMonthKey, monthLabel, monthQuarterKey } from "../date-utils";
import { MonthClient } from "./month-client";

export default async function RocksMonthPage({ searchParams }: { searchParams: { m?: string } }) {
  await requireModuleAccess("duxus");
  const monthKey = searchParams.m || currentMonthKey();
  const quarterKey = monthQuarterKey(monthKey);

  const [quarterMilestones, allMonthStage, rocks, review, reviews] = await Promise.all([
    getMilestonesForQuarter(quarterKey),
    getMilestonesByStage("month"),
    getAllRocks(),
    getReview("monthly", monthKey),
    listReviews("monthly"),
  ]);

  const overdue = allMonthStage.filter((m) => m.monthKey && m.monthKey !== monthKey && !m.done);

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
        quarterKey={quarterKey}
        monthLabel={monthLabel(monthKey)}
        prevHref={`/dashboard/duxus/rocks/month?m=${shiftMonthKey(monthKey, -1)}`}
        nextHref={`/dashboard/duxus/rocks/month?m=${shiftMonthKey(monthKey, 1)}`}
        quarterMilestones={quarterMilestones}
        overdue={overdue}
        rocks={rocks}
        initialReviewNotes={review?.notes ?? ""}
        previousReviews={reviews.filter((r) => r.periodKey !== monthKey)}
      />
    </div>
  );
}
