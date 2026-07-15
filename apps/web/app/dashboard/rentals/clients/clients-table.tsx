"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import type { RentalClient, Branch } from "@ultranet/shared-types";

type Scope = "mine" | "all";

export function ClientsTable({
  clients,
  myScopeBranchIds,
  owedClientIds,
  showBranchColumn,
  branches,
  toggleOwesMeAction,
}: {
  clients: RentalClient[];
  myScopeBranchIds: string[];
  owedClientIds: string[];
  showBranchColumn: boolean;
  branches: Branch[];
  toggleOwesMeAction: (clientId: string, owesMe: boolean) => Promise<void>;
}) {
  const [scope, setScope] = useState<Scope>("mine");
  const [owed, setOwed] = useState<Set<string>>(new Set(owedClientIds));
  const [, startTransition] = useTransition();

  const myScopeSet = useMemo(() => new Set(myScopeBranchIds), [myScopeBranchIds]);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "-";

  const visibleClients =
    scope === "mine" ? clients.filter((c) => myScopeSet.has(c.branchId)) : clients;

  function toggleOwed(clientId: string, next: boolean) {
    setOwed((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(clientId);
      else copy.delete(clientId);
      return copy;
    });
    startTransition(() => {
      toggleOwesMeAction(clientId, next);
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
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
      </div>

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f4f6f9] text-muted">
            <tr>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">שם</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">טלפון</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">פיקדון</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">תקנון</th>
              {showBranchColumn && (
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סניף</th>
              )}
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide" title="גלוי רק לך">
                חייב
              </th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody>
            {visibleClients.map((c) => (
              <tr key={c.id} className="border-t border-card-border transition hover:bg-[#f8fafc]">
                <td className="px-[11px] py-2 font-semibold text-ink">{c.name}</td>
                <td className="px-[11px] py-2 text-muted" dir="ltr">
                  {c.phone ?? "-"}
                </td>
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
                <td className="px-[11px] py-2">
                  {c.signedTerms ? (
                    <Check className="h-4 w-4 text-teal" />
                  ) : (
                    <X className="h-4 w-4 text-red-500" />
                  )}
                </td>
                {showBranchColumn && <td className="px-[11px] py-2 text-muted">{branchName(c.branchId)}</td>}
                <td className="px-[11px] py-2" title="הסימון הזה פרטי - רק אתה רואה אותו">
                  <input
                    type="checkbox"
                    checked={owed.has(c.id)}
                    onChange={(e) => toggleOwed(c.id, e.target.checked)}
                    className="h-4 w-4 rounded border-card-border accent-red-600"
                  />
                </td>
                <td className="px-[11px] py-2 text-left">
                  <Link
                    href={`/dashboard/rentals/clients/${c.id}`}
                    className="text-xs font-bold text-teal hover:underline"
                  >
                    עריכה
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
