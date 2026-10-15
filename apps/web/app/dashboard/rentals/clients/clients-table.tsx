"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Search, X } from "lucide-react";
import type { RentalClient, Branch } from "@ultranet/shared-types";
import { TokenChargeButton } from "../manage/token-charge-button";
import { CopyButton } from "@/components/copy-button";
import { ColumnsMenu, useHiddenColumns, type ColumnOption } from "@/components/column-chooser";

type Scope = "mine" | "all";

/** "נוספו לאחרונה" = 30 הימים האחרונים, לפי זמן יצירת המסמך ב-Firestore (נתון אמיתי, לא מוערך). */
const RECENT_DAYS = 30;

export function ClientsTable({
  clients,
  myScopeBranchIds,
  showBranchColumn,
  branches,
  canCharge,
  routeNameById,
  isOwner,
  createdAtById,
}: {
  /** זמן יצירת מסמך הלקוח (ms) — מ-`createTime` של Firestore; ללקוחות אין שדה תאריך משלהם. */
  createdAtById: Record<string, number>;
  clients: RentalClient[];
  myScopeBranchIds: string[];
  showBranchColumn: boolean;
  branches: Branch[];
  canCharge: boolean;
  routeNameById: Record<string, string>;
  isOwner: boolean;
}) {
  const [scope, setScope] = useState<Scope>("mine");
  const [search, setSearch] = useState("");
  const [recentOnly, setRecentOnly] = useState(false);
  const [openChargeId, setOpenChargeId] = useState<string | null>(null);
  const [chargeResult, setChargeResult] = useState<Record<string, string>>({});
  // בחירת עמודות (פריט 33): רק עמודות שכבר מוצגות למשתמש הזה; "שם" ו"עריכה" תמיד גלויות.
  const cols = useHiddenColumns("rental-clients");
  const columnOptions: ColumnOption[] = [
    { key: "phone", label: "טלפון" },
    { key: "deposit", label: "פיקדון" },
    { key: "terms", label: "תקנון" },
    ...(showBranchColumn ? [{ key: "branch", label: "סניף" }] : []),
    ...(canCharge ? [{ key: "charge", label: "חיוב" }] : []),
  ];
  const showPhone = cols.show("phone");
  const showDeposit = cols.show("deposit");
  const showTerms = cols.show("terms");
  const showBranch = showBranchColumn && cols.show("branch");
  const showCharge = canCharge && cols.show("charge");
  const visibleColCount = 2 + [showPhone, showDeposit, showTerms, showBranch, showCharge].filter(Boolean).length;

  const myScopeSet = useMemo(() => new Set(myScopeBranchIds), [myScopeBranchIds]);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "-";

  const scopedClients = isOwner && scope === "all" ? clients : clients.filter((c) => myScopeSet.has(c.branchId));

  const visibleClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? scopedClients.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q))
      : scopedClients;
    if (recentOnly) {
      const since = Date.now() - RECENT_DAYS * 86_400_000;
      list = list
        .filter((c) => (createdAtById[c.id] ?? 0) >= since)
        .sort((a, b) => (createdAtById[b.id] ?? 0) - (createdAtById[a.id] ?? 0));
    }
    return list;
  }, [scopedClients, search, recentOnly, createdAtById]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {isOwner && (
          <>
            <button
              type="button"
              onClick={() => setScope("mine")}
              className={`rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${
                scope === "mine"
                  ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-primary"
                  : "border border-card-border bg-white text-ink hover:bg-[#f4f6f9]"
              }`}
            >
              הצג את שלי
            </button>
            <button
              type="button"
              onClick={() => setScope("all")}
              className={`rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${
                scope === "all"
                  ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-primary"
                  : "border border-card-border bg-white text-ink hover:bg-[#f4f6f9]"
              }`}
            >
              הצג את של כולם
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setRecentOnly((v) => !v)}
          aria-pressed={recentOnly}
          className={`rounded-[10px] px-3 py-1.5 text-xs font-bold transition ${
            recentOnly
              ? "bg-teal-bg text-teal-dark"
              : "border border-card-border bg-white text-ink hover:bg-[#f4f6f9]"
          }`}
        >
          {`נוספו לאחרונה (${RECENT_DAYS} יום)`}
        </button>
        <div className="relative mr-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לקוח לפי שם או טלפון..."
            className="w-full rounded-[10px] border border-card-border bg-white py-1.5 pl-3 pr-9 text-xs focus:border-teal focus:outline-none"
          />
        </div>
        <ColumnsMenu columns={columnOptions} hidden={cols.hidden} onToggle={cols.toggle} onReset={cols.reset} />
      </div>
      {(search || recentOnly) && (
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
          נמצאו {visibleClients.length} לקוחות תואמים
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setRecentOnly(false);
            }}
            className="font-bold text-teal hover:underline"
          >
            הצג הכול
          </button>
        </p>
      )}

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f4f6f9] text-muted">
            <tr>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">שם</th>
              {showPhone && <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">טלפון</th>}
              {showDeposit && <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">פיקדון</th>}
              {showTerms && <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">תקנון</th>}
              {showBranch && (
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סניף</th>
              )}
              {showCharge && (
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide"></th>
              )}
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody>
            {visibleClients.map((c) => {
              const routeName = routeNameById[c.id];
              const hasToken = !!(c.gatewayToken && c.cardExpiry && routeName);
              return (
                <Fragment key={c.id}>
                <tr className="border-t border-card-border transition hover:bg-[#f8fafc]">
                  <td className="px-[11px] py-2 font-semibold text-ink">{c.name}</td>
                  {showPhone && (
                  <td className="px-[11px] py-2 text-muted">
                    <span className="inline-flex items-center gap-1">
                      <span dir="ltr">{c.phone ?? "-"}</span>
                      {c.phone && <CopyButton value={c.phone} label="טלפון" />}
                    </span>
                  </td>
                  )}
                  {showDeposit && (
                  <td className="px-[11px] py-2">
                    {(!c.depositType || c.depositType === "none") && (
                      <span className="rounded-full bg-[#fdecea] px-2 py-0.5 text-[11px] font-bold text-red-600">
                        ללא פיקדון
                      </span>
                    )}
                    {c.depositType === "check" && (
                      <span className="rounded-full bg-[#eaf3ff] px-2 py-0.5 text-[11px] font-bold text-blue-600">
                        צ׳ק
                      </span>
                    )}
                    {c.depositType === "credit" && (
                      <span
                        className="rounded-full bg-[#eafaf0] px-2 py-0.5 text-[11px] font-bold text-teal"
                        dir="ltr"
                      >
                        אשראי •••• {c.cardLast4 ?? "----"}
                      </span>
                    )}
                  </td>
                  )}
                  {showTerms && (
                  <td className="px-[11px] py-2">
                    {c.signedTerms ? (
                      <Check className="h-4 w-4 text-teal" />
                    ) : (
                      <X className="h-4 w-4 text-red-500" />
                    )}
                  </td>
                  )}
                  {showBranch && <td className="px-[11px] py-2 text-muted">{branchName(c.branchId)}</td>}
                  {showCharge && (
                    <td className="px-[11px] py-2">
                      {hasToken && (
                        <button
                          type="button"
                          onClick={() => setOpenChargeId((v) => (v === c.id ? null : c.id))}
                          className="rounded-full bg-gradient-to-br from-teal to-teal-light px-2.5 py-1 text-[11px] font-bold text-white transition hover:opacity-90"
                        >
                          חייב
                        </button>
                      )}
                      {chargeResult[c.id] && (
                        <p className="mt-1 text-[11px] font-semibold text-muted">{chargeResult[c.id]}</p>
                      )}
                    </td>
                  )}
                  <td className="px-[11px] py-2 text-left">
                    <Link
                      href={`/dashboard/rentals/clients/${c.id}`}
                      className="text-xs font-bold text-teal hover:underline"
                    >
                      עריכה
                    </Link>
                  </td>
                </tr>
                {showCharge && openChargeId === c.id && (
                  <tr>
                    <td colSpan={visibleColCount} className="border-t border-card-border bg-[#f8fafc] px-[11px] py-3">
                      <TokenChargeButton
                        clientId={c.id}
                        initialAmount={0}
                        cardLast4={c.cardLast4}
                        routeName={routeName!}
                        onDone={(result) => {
                          setChargeResult((prev) => ({
                            ...prev,
                            [c.id]: result.ok ? "החיוב בוצע בהצלחה" : result.message ?? "החיוב נכשל",
                          }));
                          if (result.ok) setOpenChargeId(null);
                        }}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
