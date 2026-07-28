"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ActiveRentalRow } from "./active-rental-row";
import { HistoryRentalRow } from "./history-rental-row";

type LaptopRates = {
  dayPrice: number;
  weekPrice: number;
  monthPrice: number;
  altPricing?: boolean;
  noInternetDayPrice?: number;
  noInternetWeekPrice?: number;
  noInternetMonthPrice?: number;
};
type StickRates = { day1: number; day2: number; day3plus: number };

export type ItemOption = { id: string; name: string };

export type ActiveRowData = {
  rentalId: string;
  startDate: string;
  kind: "laptop" | "stick";
  pricingVariant?: "normal" | "noInternet";
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientIdNum?: string;
  cardLast4?: string;
  hasCardToken: boolean;
  itemId: string;
  itemName: string;
  itemOptions: ItemOption[];
  branchName: string;
  showBranch: boolean;
  calcPrice: number;
  notes?: string;
  laptopRates?: LaptopRates;
  stickRates?: StickRates;
  hasRoute: boolean;
  nedarimCreds: { mosadId: string; apiValid: string } | null;
  canDelete: boolean;
  canCharge: boolean;
};

export type HistoryRowData = {
  rentalId: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  itemId: string;
  itemName: string;
  itemOptions: ItemOption[];
  branchName: string;
  startDate: string;
  returnDate?: string;
  price: number;
  notes?: string;
  paid: boolean;
  routes: { id: string; name: string }[];
  canDelete: boolean;
};

function matchesSearch(name: string, phone: string | undefined, q: string) {
  return name.toLowerCase().includes(q) || (phone ?? "").includes(q);
}

export function RentalsLists({
  active,
  history,
  showBranchColumn,
}: {
  active: ActiveRowData[];
  history: HistoryRowData[];
  showBranchColumn: boolean;
}) {
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const visibleActive = useMemo(
    () => (q ? active.filter((r) => matchesSearch(r.clientName, r.clientPhone, q)) : active),
    [active, q]
  );
  const visibleHistory = useMemo(
    () => (q ? history.filter((r) => matchesSearch(r.clientName, r.clientPhone, q)) : history),
    [history, q]
  );

  return (
    <>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לקוח לפי שם או טלפון..."
          className="w-full rounded-[10px] border border-card-border bg-white py-1.5 pl-3 pr-9 text-xs focus:border-teal focus:outline-none"
        />
      </div>

      <div className="mb-3 mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
        <span>השכרות פעילות</span>
        <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{visibleActive.length}</span>
      </div>
      {visibleActive.length === 0 ? (
        <div className="mb-8 rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
          {q ? "לא נמצאו השכרות פעילות ללקוח זה" : "אין השכרות פעילות"}
        </div>
      ) : (
        <div className="mb-8 overflow-hidden rounded-card border border-card-border bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead className="bg-[#f4f6f9] text-muted">
              <tr>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">לקוח</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">פריט</th>
                {showBranchColumn && (
                  <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סניף</th>
                )}
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">התחלה</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מחיר משוער</th>
                <th className="px-[11px] py-[9px]"></th>
              </tr>
            </thead>
            <tbody>
              {visibleActive.map((r) => (
                <ActiveRentalRow
                  key={r.rentalId}
                  rentalId={r.rentalId}
                  startDate={r.startDate}
                  kind={r.kind}
                  pricingVariant={r.pricingVariant}
                  clientId={r.clientId}
                  clientName={r.clientName}
                  clientPhone={r.clientPhone}
                  clientIdNum={r.clientIdNum}
                  cardLast4={r.cardLast4}
                  hasCardToken={r.hasCardToken}
                  itemId={r.itemId}
                  itemName={r.itemName}
                  itemOptions={r.itemOptions}
                  branchName={r.branchName}
                  showBranch={r.showBranch}
                  calcPrice={r.calcPrice}
                  notes={r.notes}
                  laptopRates={r.laptopRates}
                  stickRates={r.stickRates}
                  hasRoute={r.hasRoute}
                  nedarimCreds={r.nedarimCreds}
                  canDelete={r.canDelete}
                  canCharge={r.canCharge}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
        <span>היסטוריה אחרונה</span>
        <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{visibleHistory.length}</span>
      </div>
      {visibleHistory.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
          {q ? "לא נמצאה היסטוריה ללקוח זה" : "אין היסטוריה עדיין"}
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead className="bg-[#f4f6f9] text-muted">
              <tr>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">לקוח</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">פריט</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סניף</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">התחלה</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">החזרה</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מחיר</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">תשלום</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody>
              {visibleHistory.map((r) => (
                <HistoryRentalRow key={r.rentalId} r={r} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
