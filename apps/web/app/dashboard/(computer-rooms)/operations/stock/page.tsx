import { ClipboardCheck } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getStockSnapshotAction } from "../actions";
import { StockClient } from "./stock-client";

export default async function OperationsStockPage() {
  await requireModuleAccess("computers");
  const snapshot = await getStockSnapshotAction();
  return (
    <div className="space-y-3">
      <div>
        <h2 className="flex items-center gap-1.5 text-[17px] font-extrabold text-ink">
          <ClipboardCheck className="h-5 w-5" />
          {"עדכון מלאי"}
        </h2>
        <p className="text-[13px] text-muted">
          {"סימון V/X מול הכמות שנקבעה לכל פריט. הרשימה מתאפסת בכל ראשון לחודש."}
        </p>
      </div>
      <StockClient snapshot={snapshot} />
    </div>
  );
}
