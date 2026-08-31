"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { ActiveRentalRow } from "./active-rental-row";
import { HistoryRentalRow } from "./history-rental-row";

/** המחירון בפועל של המחשב אחרי ירושה ממחירון הסניף (effectiveLaptopRates). */
type LaptopRates = {
  dayPrice: number;
  weekPrice: number;
  monthPrice: number;
  noInternetDayPrice: number;
  noInternetWeekPrice: number;
  noInternetMonthPrice: number;
};
type StickRates = {
  day1: number;
  day2: number;
  day3plus: number;
  weekPrice?: number;
  monthPrice?: number;
};

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
  /** business name the client's saved gatewayToken is actually chargeable through, or null if
   *  this client has a token but no valid route resolves for it (button hidden in that case) */
  tokenRouteName: string | null;
  /** all connected Nedarim Plus businesses, for the no-token (fresh card entry) charge flow */
  chargeRoutes: { id: string; name: string; mosadId: string; apiValid: string; defaultForNewCards: boolean }[];
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

const PAGE_SIZE = 20;

function matchesSearch(name: string, phone: string | undefined, q: string) {
  return name.toLowerCase().includes(q) || (phone ?? "").includes(q);
}

function HistoryTableHead() {
  return (
    <thead className="bg-[#f4f6f9] text-muted">
      <tr>
        <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">לקוח</th>
        <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">פריט</th>
        <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סניף</th>
        <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">התחלה</th>
        <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">החזרה</th>
        <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מחיר</th>
        <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">תשלום</th>
        <th className="px-[11px] py-[9px]"></th>
      </tr>
    </thead>
  );
}

export function RentalsLists({
  active,
  unpaid,
  history,
  showBranchColumn,
}: {
  active: ActiveRowData[];
  unpaid: HistoryRowData[];
  history: HistoryRowData[];
  showBranchColumn: boolean;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const q = search.trim().toLowerCase();
  const visibleActive = useMemo(
    () => (q ? active.filter((r) => matchesSearch(r.clientName, r.clientPhone, q)) : active),
    [active, q]
  );
  const visibleUnpaid = useMemo(
    () => (q ? unpaid.filter((r) => matchesSearch(r.clientName, r.clientPhone, q)) : unpaid),
    [unpaid, q]
  );
  const visibleHistory = useMemo(
    () => (q ? history.filter((r) => matchesSearch(r.clientName, r.clientPhone, q)) : history),
    [history, q]
  );

  // Any search/data change can shrink the result set below the current page - snap back to a
  // valid page instead of showing an empty page 4 of 2.
  const pageCount = Math.max(1, Math.ceil(visibleHistory.length / PAGE_SIZE));
  useEffect(() => {
    setPage(1);
  }, [q]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const pagedHistory = useMemo(
    () => visibleHistory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [visibleHistory, page]
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
                  tokenRouteName={r.tokenRouteName}
                  chargeRoutes={r.chargeRoutes}
                  canDelete={r.canDelete}
                  canCharge={r.canCharge}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
        <span className="flex items-center gap-1.5 text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          השכרות שלא שולמו
        </span>
        <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-red-700 normal-case">{visibleUnpaid.length}</span>
      </div>
      {visibleUnpaid.length === 0 ? (
        <div className="mb-8 rounded-card border border-dashed border-card-border bg-white py-6 text-center text-sm text-muted">
          {q ? "לא נמצאו השכרות שלא שולמו ללקוח זה" : "כל ההשכרות שולמו"}
        </div>
      ) : (
        <div className="mb-8 overflow-hidden rounded-card border border-red-200 bg-white shadow-card">
          <table className="w-full text-[13px]">
            <HistoryTableHead />
            <tbody>
              {visibleUnpaid.map((r) => (
                <HistoryRentalRow key={r.rentalId} r={r} />
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
        <>
          <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
            <table className="w-full text-[13px]">
              <HistoryTableHead />
              <tbody>
                {pagedHistory.map((r) => (
                  <HistoryRentalRow key={r.rentalId} r={r} />
                ))}
              </tbody>
            </table>
          </div>
          {pageCount > 1 && (
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted">
                {`מציג ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, visibleHistory.length)} מתוך ${visibleHistory.length}`}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-1 rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-[#f4f6f9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-4 w-4" />
                  הקודם
                </button>
                <span className="text-xs font-semibold text-muted">{`עמוד ${page} מתוך ${pageCount}`}</span>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="flex items-center gap-1 rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-[#f4f6f9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  הבא
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
