import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../duxus-tabs";
import { RocksTabs } from "./rocks-tabs";
import { getRocksForQuarter, getMilestonesForQuarter, getReview, listReviews } from "./actions";
import { currentQuarterKey, shiftQuarterKey, quarterLabel } from "./date-utils";
import { QuarterClient } from "./quarter-client";

export default async function RocksQuarterPage({ searchParams }: { searchParams: { q?: string } }) {
  await requireModuleAccess("duxus");
  const quarterKey = searchParams.q || currentQuarterKey();

  const [rocks, milestones, review, reviews] = await Promise.all([
    getRocksForQuarter(quarterKey),
    getMilestonesForQuarter(quarterKey),
    getReview("quarterly", quarterKey),
    listReviews("quarterly"),
  ]);

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Target className="h-5 w-5" />
        משימות ונהלים
      </h1>
      <DuxusTabs />
      <RocksTabs />
      <QuarterClient
        quarterKey={quarterKey}
        quarterLabel={quarterLabel(quarterKey)}
        prevHref={`/dashboard/duxus/rocks?q=${shiftQuarterKey(quarterKey, -1)}`}
        nextHref={`/dashboard/duxus/rocks?q=${shiftQuarterKey(quarterKey, 1)}`}
        rocks={rocks}
        milestones={milestones}
        initialReviewNotes={review?.notes ?? ""}
        previousReviews={reviews.filter((r) => r.periodKey !== quarterKey)}
      />
    </div>
  );
}
