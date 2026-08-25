import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../duxus-tabs";
import { RocksTabs } from "./rocks-tabs";
import {
  getRocksForQuarter,
  getMilestonesForQuarter,
  getReview,
  listReviews,
  listQuarters,
  getQuarter,
} from "./actions";
import { currentQuarterKey } from "./date-utils";
import { QuarterClient } from "./quarter-client";

export default async function RocksQuarterPage({ searchParams }: { searchParams: { q?: string } }) {
  await requireModuleAccess("duxus");
  // בלי `?q=` נכנסים לרבעון הפעיל האחרון; אם עוד לא נפתח אף רבעון - לרבעון הלועזי הנוכחי.
  // רשימת הרבעונים נשלפת פעם אחת ומשמשת גם לבחירת ברירת המחדל וגם לבורר הרבעונים.
  const quarters = await listQuarters();
  const quarterKey = searchParams.q || quarters.find((q) => q.status === "active")?.id || quarters[0]?.id || currentQuarterKey();

  const [quarter, rocks, milestones, review, reviews] = await Promise.all([
    getQuarter(quarterKey),
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
        quarter={quarter}
        quarters={quarters}
        rocks={rocks}
        milestones={milestones}
        initialReviewNotes={review?.notes ?? ""}
        previousReviews={reviews.filter((r) => r.periodKey !== quarterKey)}
      />
    </div>
  );
}
