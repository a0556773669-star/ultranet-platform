import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../../duxus-tabs";
import { RocksTabs } from "../rocks-tabs";
import { getQuarter, getRocksForQuarter, getMilestonesForQuarter, defaultQuarterKey } from "../actions";
import { currentQuarterKey } from "../date-utils";
import { RolloverClient } from "./rollover-client";

export default async function RocksRolloverPage({ searchParams }: { searchParams: { q?: string } }) {
  await requireModuleAccess("duxus");
  const quarterKey = searchParams.q || (await defaultQuarterKey(currentQuarterKey()));

  const [quarter, rocks, milestones] = await Promise.all([
    getQuarter(quarterKey),
    getRocksForQuarter(quarterKey),
    getMilestonesForQuarter(quarterKey),
  ]);

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Target className="h-5 w-5" />
        משימות ונהלים
      </h1>
      <DuxusTabs />
      <RocksTabs />
      <RolloverClient quarter={quarter} rocks={rocks} milestones={milestones} />
    </div>
  );
}
