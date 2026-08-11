import Link from "next/link";
import type { BranchFinancials } from "@/lib/branch-accounting-data";
import { PROFIT_PER_COMPUTER_TARGET } from "@/lib/branch-accounting";
import { ComputerProfitTable } from "./computer-profit-table";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function MiniStats({ f }: { f: BranchFinancials }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
      <div>
        <div className="text-muted">הוצאתי עד היום (עלי / חצי אם משותף)</div>
        <div className="font-bold text-ink">{money(f.ownerInvestedToDate)}</div>
      </div>
      <div>
        <div className="text-muted">הכנסתי עד היום</div>
        <div className="font-bold text-ink">{money(f.ownerEarnedToDate)}</div>
      </div>
      <div>
        <div className="text-muted">מאזן</div>
        <div className={`font-bold ${f.ownerBalanceToDate >= 0 ? "text-teal-dark" : "text-red-600"}`}>
          {money(f.ownerBalanceToDate)}
        </div>
      </div>
      </div>
      {f.computerProfitTrend && f.computerProfitTrend.length > 0 && (
        <div className="mt-2">
          <h3 className="mb-1 text-[10px] font-bold text-ink">{`רווח פר מחשב לחודש (יעד: ${PROFIT_PER_COMPUTER_TARGET} ₪ = 150 ₪ + מע"מ)`}</h3>
          <ComputerProfitTable trend={f.computerProfitTrend} compact />
        </div>
      )}
    </div>
  );
}

export function OwnerBranchesOverview({ parents, childrenByParent }: {
  parents: BranchFinancials[];
  childrenByParent: Map<string, BranchFinancials[]>;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold text-ink">מעקב התקדמות הסניפים</h2>
      {parents.map((p) => {
        const kids = childrenByParent.get(p.branch.id) ?? [];
        const combined = kids.reduce(
          (acc, k) => ({
            invested: acc.invested + k.ownerInvestedToDate,
            earned: acc.earned + k.ownerEarnedToDate,
            balance: acc.balance + k.ownerBalanceToDate,
          }),
          { invested: p.ownerInvestedToDate, earned: p.ownerEarnedToDate, balance: p.ownerBalanceToDate }
        );
        return (
          <div key={p.branch.id} className="rounded-card border border-card-border bg-white p-4">
            <div className="flex items-center justify-between">
              <Link href={`/dashboard/rentals/accounting?branchId=${p.branch.id}`} className="text-sm font-extrabold text-ink hover:underline">
                {p.branch.name}
              </Link>
              {kids.length > 0 && <span className="text-[11px] text-muted">כולל {kids.length} תתי-סניף</span>}
            </div>
            {kids.length > 0 ? (
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-[10px] bg-[#f4f6f9] p-2 text-center text-xs">
                <div>
                  <div className="text-muted">השקעתי (הכל)</div>
                  <div className="font-bold text-ink">{money(combined.invested)}</div>
                </div>
                <div>
                  <div className="text-muted">הרווחתי (הכל)</div>
                  <div className="font-bold text-ink">{money(combined.earned)}</div>
                </div>
                <div>
                  <div className="text-muted">מאזן (הכל)</div>
                  <div className={`font-bold ${combined.balance >= 0 ? "text-teal-dark" : "text-red-600"}`}>
                    {money(combined.balance)}
                  </div>
                </div>
              </div>
            ) : null}
            <MiniStats f={p} />
            {kids.map((k) => (
              <div key={k.branch.id} className="mt-2 rounded-[10px] border border-card-border bg-[#fafbfc] p-3">
                <Link
                  href={`/dashboard/rentals/accounting?branchId=${k.branch.id}`}
                  className="text-xs font-bold text-ink hover:underline"
                >
                  {k.branch.name} (תת-סניף)
                </Link>
                <MiniStats f={k} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
