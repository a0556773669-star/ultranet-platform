import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../../duxus-tabs";
import { RocksTabs } from "../rocks-tabs";
import {
  getMilestonesForQuarter,
  getMilestonesByStage,
  getAllRocks,
  getReview,
  listReviews,
  getQuarter,
  defaultQuarterKey,
} from "../actions";
import { currentWeekKey, shiftWeekKey, weekLabel, weekMonthKey, monthQuarterKey } from "../date-utils";
import { WeekClient } from "./week-client";

export default async function RocksWeekPage({ searchParams }: { searchParams: { w?: string; q?: string } }) {
  await requireModuleAccess("duxus");
  const weekKey = searchParams.w || currentWeekKey();
  const monthKey = weekMonthKey(weekKey);
  // כמו בטאב החודשי: הרבעון הפעיל הוא ברירת המחדל, ואפשר לנעול רבעון אחר דרך `?q=`.
  const quarterKey = searchParams.q || (await defaultQuarterKey(monthQuarterKey(monthKey)));
  const quarterParam = `&q=${encodeURIComponent(quarterKey)}`;

  const [quarter, quarterMilestones, allWeekStage, rocks, review, reviews] = await Promise.all([
    getQuarter(quarterKey),
    getMilestonesForQuarter(quarterKey),
    getMilestonesByStage("week"),
    getAllRocks(),
    getReview("weekly", weekKey),
    listReviews("weekly"),
  ]);

  const overdue = allWeekStage.filter((m) => m.weekKey && m.weekKey !== weekKey && !m.done);

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
        monthKey={monthKey}
        quarterKey={quarterKey}
        quarterTitle={quarter.label}
        weekLabel={weekLabel(weekKey)}
        prevHref={`/dashboard/duxus/rocks/week?w=${shiftWeekKey(weekKey, -1)}${quarterParam}`}
        nextHref={`/dashboard/duxus/rocks/week?w=${shiftWeekKey(weekKey, 1)}${quarterParam}`}
        quarterMilestones={quarterMilestones}
        overdue={overdue}
        rocks={rocks}
        initialReviewNotes={review?.notes ?? ""}
        previousReviews={reviews.filter((r) => r.periodKey !== weekKey)}
        readOnly={quarter.status === "archived"}
      />
    </div>
  );
}
