"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wifi, Users, Check, Minus, History, ChevronDown, ChevronUp } from "lucide-react";
import type { Branch, Laptop, LaptopSale } from "@ultranet/shared-types";
import { effectiveLaptopRates } from "@/lib/rental-pricing";
import { isLaptopActive, LAPTOP_STATUS_LABELS, laptopStatus } from "@/lib/laptop-names";
import { useToast } from "@/lib/toast";
import { DeleteLaptopButton } from "./delete-button";
import { LaptopExitModal, type BranchFixedExpenseOption } from "./laptop-exit-modal";
import { deleteLaptopSaleAction, reactivateLaptopAction } from "./actions";

type SortKey = "name" | "branch" | "price";

const TH = "px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap text-[13px]";

/**
 * מחיר "עם סטיק" בפועל (אחרי ירושה ממחירון הסניף), ומתחתיו מחיר "בלי סטיק" אם הוגדר.
 * `own` הוא המחיר שהוזן על המחשב עצמו - אם אין, מסומן שהמחיר מגיע ממחירון הסניף.
 */
function priceCell(effective: number, own: number | undefined, withoutStick: number) {
  const inherited = !(own && own > 0);
  return (
    <>
      <div className={inherited ? "text-muted" : ""}>
        {effective > 0 ? `₪${effective}` : "—"}
        {inherited && effective > 0 ? <span className="mr-1 text-[10px]">(סניף)</span> : null}
      </div>
      {withoutStick > 0 ? <div className="text-[11px] text-muted">בלי סטיק: ₪{withoutStick}</div> : null}
    </>
  );
}

const SALE_ITEM_LABELS: Record<string, string> = {
  laptop: "מחשב",
  charger: "מטען",
  stick: "סטיק",
  sim: "סים",
  bag: "תיק",
};

export function LaptopsList({
  laptops: allLaptops,
  branches,
  isOwner,
  canDelete,
  canSell,
  deleteActions,
  expensesByBranch,
  sales,
}: {
  laptops: Laptop[];
  branches: Branch[];
  isOwner: boolean;
  canDelete: boolean;
  /** בעלים או שותף — מכירה פתוחה לשניהם, הוצאה לבעלים בלבד */
  canSell: boolean;
  deleteActions: Record<string, () => void>;
  /** ההוצאות הקבועות הפעילות של כל סניף, לשאלה "האם להוריד הוצאה חודשית קבועה" */
  expensesByBranch: Record<string, BranchFixedExpenseOption[]>;
  sales: LaptopSale[];
}) {
  const laptops = useMemo(() => allLaptops.filter((l) => isLaptopActive(l)), [allLaptops]);
  const exited = useMemo(
    () =>
      allLaptops
        .filter((l) => !isLaptopActive(l))
        .sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? "")),
    [allLaptops],
  );
  const [exit, setExit] = useState<{ mode: "sell" | "remove"; laptop: Laptop } | null>(null);
  const [showExited, setShowExited] = useState(false);
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "-";
  const branchPricingOf = (id: string) => branches.find((b) => b.id === id)?.rentalPricing;

  const toggleBranch = (id: string) => {
    setSelectedBranchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));
  };

  const filtered = useMemo(() => {
    if (selectedBranchIds.length === 0) return laptops;
    const set = new Set(selectedBranchIds);
    return laptops.filter((l) => set.has(l.branchId));
  }, [laptops, selectedBranchIds]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const nameById = new Map(branches.map((b) => [b.id, b.name]));
    const nameOf = (id: string) => nameById.get(id) ?? "-";
    return [...filtered].sort((a, b) => {
      if (sortKey === "branch") {
        return dir * nameOf(a.branchId).localeCompare(nameOf(b.branchId), "he", { numeric: true });
      }
      if (sortKey === "price") {
        // ממיינים לפי המחיר בפועל, כולל מחשבים שיורשים את המחיר ממחירון הסניף.
        const pricingById = new Map(branches.map((br) => [br.id, br.rentalPricing]));
        const dayOf = (l: Laptop) => effectiveLaptopRates(l, pricingById.get(l.branchId)).dayPrice;
        return dir * (dayOf(a) - dayOf(b));
      }
      return dir * a.name.localeCompare(b.name, "he", { numeric: true });
    });
  }, [filtered, sortKey, sortDir, branches]);

  return (
    <div>
      {isOwner && branches.length > 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted">סינון לפי סניף:</span>
          <button
            type="button"
            onClick={() => setSelectedBranchIds([])}
            className={`rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${
              selectedBranchIds.length === 0
                ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-primary"
                : "border border-card-border bg-white text-ink hover:bg-[#f4f6f9]"
            }`}
          >
            הכל
          </button>
          {branches.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleBranch(b.id)}
              className={`rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${
                selectedBranchIds.includes(b.id)
                  ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-primary"
                  : "border border-card-border bg-white text-ink hover:bg-[#f4f6f9]"
              }`}
            >
              {b.name}
            </button>
          ))}

          <div className="mr-auto flex items-center gap-2">
            <span className="text-xs font-bold text-muted">מיון:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-[10px] border border-card-border bg-white px-2 py-1.5 text-xs font-semibold text-ink focus:border-teal focus:outline-none"
            >
              <option value="name">שם</option>
              <option value="branch">סניף</option>
              <option value="price">מחיר ליום</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              className="rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
              title="הפוך כיוון מיון"
            >
              {sortDir === "asc" ? "עולה ↑" : "יורד ↓"}
            </button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-card border border-card-border bg-white p-5 text-center text-sm text-muted shadow-card">
          אין מחשבים תואמים
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr className="border-b border-card-border bg-[#f4f6f9]">
                  <th className={TH}>שם</th>
                  {isOwner && <th className={TH}>סניף</th>}
                  <th className={TH}>מחיר ליום</th>
                  <th className={TH}>מחיר לשבוע</th>
                  <th className={TH}>מחיר לחודש</th>
                  <th className={TH}>סטיק</th>
                  <th className={TH}>שותפות</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {sorted.map((l, idx) => {
                  const deleteAction = deleteActions[l.id];
                  const eff = effectiveLaptopRates(l, branchPricingOf(l.branchId));
                  return (
                    <tr key={l.id} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                      <td className={`${TD} font-bold text-ink`}>
                        <Link href={`/dashboard/rentals/laptops/${l.id}`} className="hover:underline">
                          {l.name}
                        </Link>
                      </td>
                      {isOwner && <td className={`${TD} text-muted`}>{branchName(l.branchId)}</td>}
                      <td className={TD}>{priceCell(eff.dayPrice, l.dayPrice, eff.noInternetDayPrice)}</td>
                      <td className={TD}>{priceCell(eff.weekPrice, l.weekPrice, eff.noInternetWeekPrice)}</td>
                      <td className={TD}>{priceCell(eff.monthPrice, l.monthPrice, eff.noInternetMonthPrice)}</td>
                      <td className={TD}>
                        {l.hasStick ? (
                          <span className="flex items-center gap-1 text-teal-dark">
                            <Wifi className="h-3.5 w-3.5" />
                            {l.simNumber || <Check className="h-3.5 w-3.5" />}
                          </span>
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-muted" />
                        )}
                      </td>
                      <td className={TD}>
                        {l.hasPartner ? (
                          /* שותפות בלי שם היא חוב בלי נושה: היא כבר יורדת מהרווח ומופיעה
                             בטבלת ההעברות, אבל אין למי להעביר אותה. נאמר כאן ולא רק שם. */
                          <span
                            className={`flex items-center gap-1 ${
                              l.partnerName?.trim() ? "text-ink" : "font-bold text-amber-700"
                            }`}
                            title={
                              l.partnerName?.trim()
                                ? undefined
                                : "שותפות בלי שם - צריך למלא שם או להסיר את הסימון"
                            }
                          >
                            <Users className="h-3.5 w-3.5" />
                            {l.partnerName?.trim()
                              ? `${l.partnerPct ?? 15}% (${l.partnerName.trim()})`
                              : `${l.partnerPct ?? 15}% — חסר שם`}
                          </span>
                        ) : (
                          <Minus className="h-3.5 w-3.5 text-muted" />
                        )}
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/dashboard/rentals/laptops/${l.id}`}
                            className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
                          >
                            עריכה
                          </Link>
                          {canSell && (
                            <button
                              type="button"
                              onClick={() => setExit({ mode: "sell", laptop: l })}
                              className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-bold text-sky-700 hover:bg-sky-50"
                            >
                              מכירה
                            </button>
                          )}
                          {isOwner && (
                            <button
                              type="button"
                              onClick={() => setExit({ mode: "remove", laptop: l })}
                              className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50"
                              title="לקחתי את המחשב מהסניף — מאותו יום יש בסניף מחשב אחד פחות"
                            >
                              הוצאה
                            </button>
                          )}
                          {canDelete && deleteAction && <DeleteLaptopButton action={deleteAction} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {exited.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowExited((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-extrabold text-ink"
          >
            <History className="h-4 w-4" />
            מחשבים שיצאו מהסניף ({exited.length})
            {showExited ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showExited && (
            <div className="mt-2 overflow-hidden rounded-card border border-card-border bg-white shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="border-b border-card-border bg-[#f4f6f9]">
                      <th className={TH}>שם</th>
                      {isOwner && <th className={TH}>סניף</th>}
                      <th className={TH}>מה קרה</th>
                      <th className={TH}>תאריך</th>
                      <th className={TH}>פרטים</th>
                      {isOwner && <th className={TH}></th>}
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {exited.map((l, idx) => {
                      const status = laptopStatus(l);
                      const sale = sales.find((s) => s.laptopId === l.id && s.items.laptop);
                      return (
                        <tr key={l.id} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                          <td className={`${TD} font-bold text-ink`}>{l.name}</td>
                          {isOwner && <td className={`${TD} text-muted`}>{branchName(l.branchId)}</td>}
                          <td className={TD}>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                status === "sold" ? "bg-sky-50 text-sky-700" : "bg-amber-50 text-amber-800"
                              }`}
                            >
                              {LAPTOP_STATUS_LABELS[status]}
                            </span>
                          </td>
                          <td className={TD}>{l.endedAt ?? "-"}</td>
                          <td className={`${TD} whitespace-normal text-[12px] text-muted`}>
                            {sale ? (
                              <>
                                <b className="text-ink">{sale.price.toLocaleString("he-IL")} ₪</b> ·{" "}
                                {Object.entries(sale.items)
                                  .filter(([, v]) => v)
                                  .map(([k]) => SALE_ITEM_LABELS[k] ?? k)
                                  .join(", ")}
                                {sale.items.sim && (
                                  <>
                                    {" "}· סים {sale.simTransferred ? "הועבר" : "לא הועבר"} · נטפרי{" "}
                                    {sale.netfreeTransferred ? "הועבר" : "לא הועבר"}
                                  </>
                                )}
                                {sale.buyerName ? ` · ${sale.buyerName}` : ""}
                              </>
                            ) : (
                              l.endNote || "-"
                            )}
                          </td>
                          {isOwner && (
                            <td className={TD}>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!confirm(`להחזיר את ${l.name} להיות פעיל בסניף?`)) return;
                                    const r = await reactivateLaptopAction(l.id);
                                    if (r.ok) {
                                      showSuccess(r.message);
                                      router.refresh();
                                    } else showError(r.message);
                                  }}
                                  className="rounded-lg border border-card-border bg-white px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-[#f4f6f9]"
                                >
                                  החזרה לפעיל
                                </button>
                                {sale && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!confirm("למחוק את רישום המכירה? הסכום יירד מההעברה של אותו חודש.")) return;
                                      const r = await deleteLaptopSaleAction(sale.id);
                                      if (r.ok) {
                                        showSuccess(r.message);
                                        router.refresh();
                                      } else showError(r.message);
                                    }}
                                    className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50"
                                  >
                                    מחיקת המכירה
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {exit && (
        <LaptopExitModal
          mode={exit.mode}
          laptopId={exit.laptop.id}
          laptopName={exit.laptop.name}
          hasStick={!!exit.laptop.hasStick}
          expenses={expensesByBranch[exit.laptop.branchId] ?? []}
          onClose={() => setExit(null)}
          onDone={(message) => {
            setExit(null);
            showSuccess(message);
          }}
        />
      )}
      {toastNode}
    </div>
  );
}
