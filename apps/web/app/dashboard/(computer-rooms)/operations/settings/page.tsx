import { Settings2 } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getOpsSettingsSnapshotAction } from "../actions";
import { STOCK_MODULE_HIDDEN } from "@/lib/feature-flags";
import { SettingsClient } from "./settings-client";

export default async function OperationsSettingsPage() {
  await requireOwner();
  const snapshot = await getOpsSettingsSnapshotAction();
  return (
    <div className="space-y-3">
      <div>
        <h2 className="flex items-center gap-1.5 text-[17px] font-extrabold text-ink">
          <Settings2 className="h-5 w-5" />
          {"הגדרות תפעול"}
        </h2>
        <p className="text-[13px] text-muted">
          {STOCK_MODULE_HIDDEN
            ? "כאן נקבע אילו משימות הסניפים רואים. משימה שמוגדרת \"לכל הסניפים\" נוצרת פעם אחת ומופיעה אצל כולם."
            : "כאן נקבע מה הסניפים רואים: אילו פריטי מלאי ובאיזו כמות, ואילו משימות. פריט או משימה שמוגדרים \"לכל הסניפים\" נוצרים פעם אחת ומופיעים אצל כולם."}
        </p>
      </div>
      <SettingsClient snapshot={snapshot} />
    </div>
  );
}
