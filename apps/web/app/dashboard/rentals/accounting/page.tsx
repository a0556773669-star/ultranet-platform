import { BarChart3, Plus, Minus, Wallet, Banknote, Users } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingIncome, AccountingExpense } from "@ultranet/shared-types";
import {
  createIncomeAction,
  createExpenseAction,
  deleteIncomeAction,
  deleteExpenseAction,
} from "../../accounting/actions";
import { DeleteEntryButton } from "../../accounting/delete-entry-button";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

import { loadBranchAccountingRawData, computeBranchFinancials, currentMonth as getCurrentMonth } from "@/lib/branch-accounting-data";
import { buildBranchLedger } from "@/lib/branch-ledger";
import { computePartnerSettlement } from "@/lib/partner-settlement";
import { monthsBetween } from "@/lib/branch-accounting";
import { loadReportRecipients, loadOwnerEmail } from "@/lib/branch-report-recipients";
import { monthLabel } from "@/lib/branch-month-report";
import { mailerConfigError } from "@/lib/mailer";
import { BranchAccountingView } from "./branch-view";
import { OwnerBranchesOverview } from "./owner-overview";
import { UnifiedBranchesTable } from "./unified-branches-table";
import { MonthPicker } from "./month-picker";
import { ReportButtons } from "./report-buttons";
import { BalanceSummaryCard, BranchLedgerTable } from "../ledger/branch-ledger-table";

/** The months the picker offers: the last two years up to (never past) the current month, since
 *  the ledger every figure reads is only built up to today. */
function selectableMonths(now: string): string[] {
  const [y, m] = now.split("-").map(Number);
  let startY = y ?? new Date().getFullYear();
  let startM = (m ?? 1) - 23;
  while (startM < 1) {
    startM += 12;
    startY -= 1;
  }
  return monthsBetween(`${startY}-${String(startM).padStart(2, "0")}`, now).reverse();
}

export default async function RentalsAccountingPage({
  searchParams,
}: {
  searchParams?: { branchId?: string; month?: string };
}) {
  const session = await requireModuleAccess("rentals");
  const isOwner = session.user?.role === "owner";
  const myBranchId = session.user?.branchId;

  const db = getAdminFirestore();
  const raw = await loadBranchAccountingRawData();
  const thisMonth = getCurrentMonth();
  const monthOptions = selectableMonths(thisMonth);
  const requested = searchParams?.month;
  // Anything malformed or in the future falls back to the current month rather than rendering an
  // empty table for a month the ledger was never built for.
  const month =
    requested && /^\d{4}-\d{2}$/.test(requested) && requested <= thisMonth && monthOptions.includes(requested)
      ? requested
      : thisMonth;
  // Deleted branches stay in Firestore (soft-delete, see deleteRentalBranchAction) precisely so
  // their accounting history remains resolvable - `allRentalsBranches` includes them (for the
  // history section + drilldown-by-id below), `rentalsBranches` excludes them (for every
  // "active management" section: the unified table, progress tracking, add-income/expense forms).
  const allRentalsBranches = raw.branches.filter((b) => b.branchType === "rentals");
  const rentalsBranches = allRentalsBranches.filter((b) => !b.deleted);

  if (!isOwner) {
    const myBranch = allRentalsBranches.find((b) => b.id === myBranchId);
    if (myBranch) {
      const financials = computeBranchFinancials(myBranch, raw, month);
      const transfer = raw.transfersByBranchMonth.get(`${myBranch.id}|${month}`);
      return (
        <div className="max-w-3xl">
          <h1 className="mb-4 text-[21px] font-extrabold text-ink">הנה&quot;ח - {myBranch.name}</h1>
          <BranchAccountingView financials={financials} transfer={transfer} month={month} showSettlement />
        </div>
      );
    }
  }

  const branchNameById = new Map(raw.branches.map((b) => [b.id, b.name]));
  const partnerSettlement = isOwner ? await computePartnerSettlement(month) : [];

  let ownerDrillDown: JSX.Element | null = null;
  let historySection: JSX.Element | null = null;
  if (isOwner) {
    const parents = rentalsBranches.filter((b) => !b.parentBranchId);
    const childrenByParent: Record<string, ReturnType<typeof computeBranchFinancials>[]> = {};
    for (const b of rentalsBranches) {
      if (b.parentBranchId) {
        (childrenByParent[b.parentBranchId] ??= []).push(computeBranchFinancials(b, raw, month));
      }
    }
    const parentFinancials = parents.map((p) => computeBranchFinancials(p, raw, month));

    // Deleted branches can't be selected from the (active-only) progress-tracking section, but
    // they CAN be reached via a history-section link below, so look them up across ALL branches.
    const selectedBranch = searchParams?.branchId ? allRentalsBranches.find((b) => b.id === searchParams.branchId) : undefined;

    const [recipients, ownerEmail] = await Promise.all([
      loadReportRecipients(rentalsBranches),
      loadOwnerEmail(session.user?.email),
    ]);

    ownerDrillDown = (
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MonthPicker month={month} months={monthOptions} />
          <ReportButtons
            month={month}
            monthLabel={monthLabel(month)}
            recipients={recipients}
            ownerEmail={ownerEmail}
            mailerError={mailerConfigError()}
          />
        </div>
        <UnifiedBranchesTable branches={rentalsBranches} raw={raw} month={month} />
        <OwnerBranchesOverview parents={parentFinancials} childrenByParent={childrenByParent} month={month} />
        {selectedBranch && (
          <BranchAccountingView
            financials={computeBranchFinancials(selectedBranch, raw, month)}
            transfer={raw.transfersByBranchMonth.get(`${selectedBranch.id}|${month}`)}
            month={month}
            showSettlement={false}
            isOwner
          />
        )}
      </div>
    );

    // Includes deleted branches (allRentalsBranches) - deleting a branch must not delete access to
    // its accounting history. When a branch is focused via ?branchId=, narrow the history down to
    // just that branch too, so a click from progress-tracking/above gives "everything about this
    // branch" in one place instead of the full list of every branch's history.
    const historyBranches = selectedBranch ? [selectedBranch] : allRentalsBranches;
    const ledgers = [...historyBranches]
      .sort((a, b) => a.name.localeCompare(b.name, "he"))
      .map((b) => buildBranchLedger(b, raw));

    historySection =
      ledgers.length > 0 ? (
        <div id="branch-history" className="scroll-mt-4">
          <details className="rounded-card border border-card-border bg-white shadow-card" open={!!selectedBranch}>
            <summary className="flex flex-wrap items-center justify-between gap-2 cursor-pointer p-4 text-sm font-extrabold text-ink">
              <span>
                {selectedBranch ? `היסטוריה מלאה - ${selectedBranch.name}` : "היסטוריה מלאה לכל הסניפים (כולל סניפים שנמחקו)"}
              </span>
              {selectedBranch && (
                <a
                  href={`/dashboard/rentals/accounting?month=${month}#branch-history`}
                  className="text-xs font-bold text-teal hover:underline"
                >
                  הצג היסטוריה של כל הסניפים
                </a>
              )}
            </summary>
            <div className="space-y-3 border-t border-card-border p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ledgers.map((l) => (
                  <BalanceSummaryCard key={l.branch.id} ledger={l} />
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {ledgers.map((l) => (
                  <BranchLedgerTable key={l.branch.id} ledger={l} />
                ))}
              </div>
            </div>
          </details>
        </div>
      ) : null;
  }

  const [incomeSnap, expenseSnap] = await Promise.all([
    db.collection("n_ah_income").get(),
    db.collection("n_ah_expenses").get(),
  ]);

  const income = incomeSnap.docs
    .map((d) => ({ ...(d.data() as Omit<AccountingIncome, "id">), id: d.id }) as AccountingIncome)
    .filter((i) => i.business === "rentals")
    .sort((a, b) => b.date.localeCompare(a.date));
  const expenses = expenseSnap.docs
    .map((d) => ({ ...(d.data() as Omit<AccountingExpense, "id">), id: d.id }) as AccountingExpense)
    .filter((e) => e.business === "rentals")
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthIncome = income
    .filter((i) => i.date.slice(0, 7) === currentMonth)
    .reduce((sum, i) => sum + i.amount, 0);
  const monthExpenses = expenses
    .filter((e) => e.date.slice(0, 7) === currentMonth)
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <BarChart3 className="h-5 w-5" />
          {"הנה\"ח השכרות"}
        </h1>
        <p className="text-sm text-muted">גביה ותמונת מצב של מודול ההשכרות</p>
      </div>

      {ownerDrillDown}

      {isOwner && partnerSettlement.length > 0 && (
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
            <Users className="h-4 w-4" />
            {`שותפי מחשבים - להעברה בגין ${month}`}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-right text-sm">
              <thead>
                <tr className="border-b border-card-border text-xs font-bold uppercase tracking-wide text-muted">
                  <th className="px-2 py-1.5">שותף</th>
                  <th className="px-2 py-1.5">סניף</th>
                  <th className="px-2 py-1.5">מחשבים</th>
                  <th className="px-2 py-1.5">אחוז</th>
                  <th className="px-2 py-1.5">מס&apos; השכרות</th>
                  <th className="px-2 py-1.5">סה&quot;כ הכנסה</th>
                  <th className="px-2 py-1.5">להעברה לשותף</th>
                </tr>
              </thead>
              <tbody>
                {partnerSettlement.map((line) => (
                  <tr key={`${line.branchId}|${line.partnerName}|${line.pct}`} className="border-b border-card-border last:border-b-0">
                    <td className="px-2 py-1.5 font-semibold text-ink">{line.partnerName}</td>
                    <td className="px-2 py-1.5 text-muted">{branchNameById.get(line.branchId) ?? "-"}</td>
                    <td className="px-2 py-1.5 text-muted">{line.computerNames.join(", ")}</td>
                    <td className="px-2 py-1.5 text-muted">{line.pct}%</td>
                    <td className="px-2 py-1.5 text-muted">{line.rentalCount}</td>
                    <td className="px-2 py-1.5 text-muted">{line.totalRevenue.toLocaleString()} ₪</td>
                    <td className="px-2 py-1.5 font-black text-teal-dark">{line.amountOwed.toLocaleString()} ₪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            מבוסס על השכרות שהוחזרו במהלך {month} של מחשבים (וסטיקים משוייכים) המסומנים כבעלי שותפות (עמוד &quot;מחשבים&quot;).
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{"סה\"כ הכנסות"}</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{totalIncome.toLocaleString()} ₪</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{"סה\"כ הוצאות"}</p>
          <p className="mt-1 text-2xl font-black text-red-600">{totalExpenses.toLocaleString()} ₪</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{"רווח נקי כולל"}</p>
          <p className={`mt-1 text-2xl font-black ${totalIncome - totalExpenses >= 0 ? "text-teal-dark" : "text-red-600"}`}>
            {(totalIncome - totalExpenses).toLocaleString()} ₪
          </p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{"רווח החודש"}</p>
          <p className={`mt-1 text-2xl font-black ${monthIncome - monthExpenses >= 0 ? "text-teal-dark" : "text-red-600"}`}>
            {(monthIncome - monthExpenses).toLocaleString()} ₪
          </p>
        </div>
      </div>

      {isOwner && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form
            action={createIncomeAction}
            className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card"
          >
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <Plus className="h-4 w-4" />
              {"הוספת הכנסה — ניידים"}
            </h2>
            <input type="hidden" name="type" value="laptops" />
            <input type="date" name="date" required className={FIELD} />
            <select name="branchId" required defaultValue="" className={FIELD}>
              <option value="" disabled>בחר סניף ניידים</option>
              {rentalsBranches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <input name="desc" placeholder="תיאור (לא חובה)" className={FIELD} />
            <input type="number" name="amount" min={0} placeholder="סכום" required className={FIELD} />
            <button
              type="submit"
              className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              הוספה
            </button>
          </form>
          <form
            action={createExpenseAction}
            className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card"
          >
            <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              <Minus className="h-4 w-4" />
              {"הוספת הוצאה"}
            </h2>
            <input type="hidden" name="business" value="rentals" />
            <input type="date" name="date" required className={FIELD} />
            <input name="desc" placeholder="תיאור" className={FIELD} />
            <input type="number" name="amount" min={0} placeholder="סכום" required className={FIELD} />
            <button
              type="submit"
              className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              הוספה
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              {"הכנסות"}
            </span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{income.length}</span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {income.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">{"אין הכנסות עדיין"}</p>
            )}
            {income.slice(0, 20).map((i) => {
              const bound = deleteIncomeAction.bind(null, i.id);
              return (
                <div key={i.id} className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                  <div className="flex-1">
                    <div className="font-bold text-ink">{i.desc || "הכנסה"}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{i.date}</div>
                  </div>
                  <div className="min-w-[75px] text-left font-extrabold text-emerald-600">{i.amount.toLocaleString()} ₪</div>
                  {isOwner && (
                    <DeleteEntryButton confirmText="למחוק את ההכנסה?" action={bound} successText="ההכנסה נמחקה בהצלחה" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span className="flex items-center gap-1.5">
              <Banknote className="h-4 w-4" />
              {"הוצאות"}
            </span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{expenses.length}</span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {expenses.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">{"אין הוצאות עדיין"}</p>
            )}
            {expenses.slice(0, 20).map((e) => {
              const bound = deleteExpenseAction.bind(null, e.id);
              return (
                <div key={e.id} className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                  <div className="flex-1">
                    <div className="font-bold text-ink">{e.desc || "הוצאה"}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{e.date}</div>
                  </div>
                  <div className="min-w-[75px] text-left font-extrabold text-red-600">{e.amount.toLocaleString()} ₪</div>
                  {isOwner && (
                    <DeleteEntryButton confirmText="למחוק את ההוצאה?" action={bound} successText="ההוצאה נמחקה בהצלחה" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {historySection}
    </div>
  );
}
