import { Check } from "lucide-react";
import type { BranchFinancials } from "@/lib/branch-accounting-data";
import type { BranchTransfer } from "@ultranet/shared-types";
import { MarkTransferredButton } from "./mark-transferred-button";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${m ?? ""}/${(y ?? "").slice(2)}`;
}

function Box({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "good" ? "text-teal-dark" : "text-ink";
  return (
    <div className="rounded-card border border-card-border bg-white p-4 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-xl font-extrabold ${color}`}>{money(value)}</div>
    </div>
  );
}

export function BranchAccountingView({
  financials,
  transfer,
  month,
  showSettlement,
  isOwner = false,
}: {
  financials: BranchFinancials;
  transfer: BranchTransfer | undefined;
  month: string;
  showSettlement: boolean;
  isOwner?: boolean;
}) {
  const f = financials;
  const isFirstOfMonth = new Date().getDate() === 1;
  const alreadyTransferred = !!transfer?.transferred && transfer.month === month;

  return (
    <div className="space-y-4 rounded-card border border-card-border bg-[#fafbfc] p-4">
      <h2 className="text-lg font-extrabold text-ink">{f.branch.name}</h2>
      <div className="grid grid-cols-3 gap-3">
        <Box label="הכנסות החודש" value={f.incomeThisMonth} />
        <Box label="הוצאות החודש" value={f.expenseThisMonth} />
        <Box label="מאזן החודש" value={f.balanceThisMonth} tone={f.balanceThisMonth >= 0 ? "good" : "bad"} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Box label="הכנסות עד היום" value={f.incomeToDate} />
        <Box label="הוצאות עד היום" value={f.expenseToDate} />
        <Box label="מאזן עד היום" value={f.balanceToDate} tone={f.balanceToDate >= 0 ? "good" : "bad"} />
      </div>

      {showSettlement && (isFirstOfMonth || alreadyTransferred) && (
        <div className="rounded-card border border-card-border bg-[#f4f6f9] p-4">
          {alreadyTransferred ? (
            <div className="flex items-center gap-1.5 text-sm font-bold text-teal-dark">
              <Check className="h-4 w-4" />
              העברת החודש הזה כבר סומנה כבוצעה
            </div>
          ) : f.settlementNetToOwner > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-ink">
                יש להעביר לבעלים {money(f.settlementNetToOwner)} עבור {month}.
              </div>
              <MarkTransferredButton
                branchId={f.branch.id}
                month={month}
                netToOwner={f.settlementNetToOwner}
                incomeShareToOwner={0}
                expenseNetToOwner={0}
              />
            </div>
          ) : f.settlementNetToOwner < 0 ? (
            <div className="text-sm font-semibold text-ink">
              הבעלים צריך להעביר אליך {money(-f.settlementNetToOwner)} עבור {month}.
            </div>
          ) : (
            <div className="text-sm text-muted">אין העברה נדרשת החודש.</div>
          )}
        </div>
      )}

      {isOwner && (
      <div>
        <h3 className="mb-2 text-sm font-bold text-ink">רווח נטו פר מחשב (יעד: 150 ₪ לחודש)</h3>
        <div className="flex items-end gap-1" style={{ height: 80 }}>
          {f.computerProfitTrend.map((m) => {
            const height = Math.max(4, Math.min(80, Math.abs(m.profitPerComputer) / 3));
            return (
              <div
                key={m.month}
                className="flex flex-1 flex-col items-center justify-end"
                title={`${m.month}: ${Math.round(m.profitPerComputer)} ₪`}
              >
                <div className={`w-full rounded-t ${m.isHealthy ? "bg-teal" : "bg-red-400"}`} style={{ height }} />
                  <span className={`mt-1 text-[9px] font-bold whitespace-nowrap ${m.isHealthy ? "text-teal-dark" : "text-red-600"}`}>{Math.round(m.profitPerComputer)}</span>
                  <span className="mt-0.5 text-[9px] font-medium whitespace-nowrap text-muted">{formatMonthLabel(m.month)}</span>
              </div>
            );
          })}
        </div>
      </div>
      )}
    </div>
  );
}
