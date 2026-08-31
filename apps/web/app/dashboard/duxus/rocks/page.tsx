import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../duxus-tabs";
import { RocksTabs } from "./rocks-tabs";
import { getRocksForQuarter, getMilestonesForQuarter, getReview, listReviews, listQuarters, getQuarter } from "./actions";
import { currentQuarterKey, latestMonthKey, latestWeekKey } from "./date-utils";
import { BoardClient } from "./board-client";

export default async function RocksBoardPage({ searchParams }: { searchParams: { q?: string } }) {
  await requireModuleAccess("duxus");
  // בלי `?q=` נכנסים לרבעון הפעיל האחרון; אם עוד לא נפתח אף רבעון - לרבעון הלועזי הנוכחי.
  // רשימת הרבעונים נשלפת פעם אחת ומשמשת גם לבחירת ברירת המחדל וגם לבורר הרבעונים.
  const quarters = await listQuarters();
  const quarterKey = searchParams.q || quarters.find((q) => q.status === "active")?.id || quarters[0]?.id || currentQuarterKey();

  const [quarter, rocks, milestones, quarterReview, quarterlyReviews, monthlyReviews, weeklyReviews] = await Promise.all([
    getQuarter(quarterKey),
    getRocksForQuarter(quarterKey),
    getMilestonesForQuarter(quarterKey),
    getReview("quarterly", quarterKey),
    listReviews("quarterly"),
    listReviews("monthly"),
    listReviews("weekly"),
  ]);

  // רבעונים שנוצרו לפני שדות ה"תקופה הפתוחה" נופלים למפתח המאוחר ביותר שקיים בדאטה,
  // כדי שהלוח ייפתח על השבוע/חודש האחרונים שעבדו עליהם ולא ייראה ריק.
  const activeMonthKey = quarter.activeMonthKey || latestMonthKey(milestones.map((m) => m.monthKey ?? ""));
  const activeWeekKey = quarter.activeWeekKey || latestWeekKey(milestones.map((m) => m.weekKey ?? ""));

  const [monthReview, weekReview] = await Promise.all([
    activeMonthKey ? getReview("monthly", activeMonthKey) : Promise.resolve(null),
    activeWeekKey ? getReview("weekly", activeWeekKey) : Promise.resolve(null),
  ]);

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Target className="h-5 w-5" />
        משימות ונהלים
      </h1>
      <DuxusTabs />
      <RocksTabs />
      <BoardClient
        quarter={quarter}
        quarters={quarters}
        rocks={rocks}
        milestones={milestones}
        quarterReviewNotes={quarterReview?.notes ?? ""}
        monthReviewNotes={monthReview?.notes ?? ""}
        weekReviewNotes={weekReview?.notes ?? ""}
        quarterlyReviews={quarterlyReviews}
        monthlyReviews={monthlyReviews}
        weeklyReviews={weeklyReviews}
      />
    </div>
  );
}
