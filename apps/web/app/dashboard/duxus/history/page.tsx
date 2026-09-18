import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../duxus-tabs";
import { loadHistory } from "../rocks/actions";
import { HistoryClient } from "./history-client";

export default async function DuxusHistoryPage() {
  await requireModuleAccess("duxus");
  const data = await loadHistory();

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Target className="h-5 w-5" />
        משימות ונהלים
      </h1>
      <DuxusTabs />
      <HistoryClient data={data} />
    </div>
  );
}
