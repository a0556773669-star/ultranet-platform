import Link from "next/link";
import { BarChart3, Split } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getOwnerName } from "@/lib/owner-name";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, CollectionRoute, TxBusiness } from "@ultranet/shared-types";
import { isPendingAttribution } from "@/lib/accounting-entries";
import { loadMovements } from "@/lib/accounting-entries-data";
import { loadTransactionModel } from "@/lib/tx-data";
import { flowTotals, FLOW_LABEL, FLOW_HELP } from "@/lib/business-ledger";
import CollectModal from "../collect-modal";
import { AccountingTabs } from "../accounting-tabs";
import { EntryList } from "../entry-list";
import { TransactionForm, type FormBranch } from "./transaction-form";

function businessOf(b: Branch): TxBusiness {
  return b.branchType === "rentals" || b.branchType === "computers" || b.branchType === "coworking"
    ? b.branchType
    : "hq";
}

function hasPartner(b: Branch): boolean {
  if (b.isMine) return false;
  const pct = b.myPct ?? 100 - (b.partnerPct ?? 0);
  return Number.isFinite(pct) ? pct < 100 : false;
}

export default async function AccountingPage() {
  const session = await requireModuleAccess("accounting");

  const db = getAdminFirestore();
  const [{ entries, liveBranches }, routesSnap, model, ownerName] = await Promise.all([
    loadMovements(),
    db.collection("n_collection_routes").get(),
    loadTransactionModel(),
    getOwnerName(session.user?.name),
  ]);

  const routes = routesSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<CollectionRoute, "id">), id: d.id }) as CollectionRoute,
  );

  const incomeRows = entries.filter((e) => e.kind === "income");
  const expenseRows = entries.filter((e) => e.kind === "expense");
  const pendingCount = entries.filter(isPendingAttribution).length;

  const branchGroups = {
    rooms: liveBranches.filter((b) => b.branchType === "computers").map((b) => ({ id: b.id, name: b.name })),
    rentals: liveBranches.filter((b) => b.branchType === "rentals").map((b) => ({ id: b.id, name: b.name })),
    coworking: liveBranches.filter((b) => b.branchType === "coworking").map((b) => ({ id: b.id, name: b.name })),
  };

  const formBranches: FormBranch[] = liveBranches.map((b) => ({
    id: b.id,
    name: b.name,
    business: businessOf(b),
    hasPartner: hasPartner(b),
  }));

  // The flow book, DERIVED from the transactions rather than summed out of n_ah_income /
  // n_ah_expenses. That is what retired the mirror rows: nothing has to be written twice for the
  // owner's cash-out to include his share of a branch expense, and nothing can drift out of sync.
  // It is also why the two hand-made add-ons this screen used to carry - the fixed-expense burden
  // and the computer-room setup cost - are gone: both are ordinary transactions in the model now.
  const totals = flowTotals(model.transactions);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <BarChart3 className="h-5 w-5" />
            רישום ותנועות
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            כל שקל נרשם כאן פעם אחת, ברגע שהוא זז. כל מספר אחר בעסק הוא תצוגה שלו — ראה{" "}
            <Link href="/dashboard/accounting/overview" className="font-bold text-teal hover:underline">
              הסקירה
            </Link>{" "}
            ו
            <Link href="/dashboard/accounting/bottom-line" className="font-bold text-teal hover:underline">
              השורה התחתונה
            </Link>
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/entries" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
        <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
          <span className="absolute right-0 top-0 h-full w-1 bg-emerald-500" />
          <p className="text-[11px] font-bold tracking-wide text-muted">{FLOW_LABEL} — הכנסות</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{Math.round(totals.income).toLocaleString()} ₪</p>
        </div>
        <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
          <span className="absolute right-0 top-0 h-full w-1 bg-red-500" />
          <p className="text-[11px] font-bold tracking-wide text-muted">{FLOW_LABEL} — הוצאות</p>
          <p className="mt-1 text-2xl font-black text-red-600">{Math.round(totals.expense).toLocaleString()} ₪</p>
          <p className="mt-1 text-[11px] text-muted">
            כולל חלקי בהוצאות הקבועות ובהוצאות הסניפים — נגזר מהתנועות, לא נרשם פעמיים
          </p>
        </div>
        <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
          <span className="absolute right-0 top-0 h-full w-1 bg-teal" />
          <p className="text-[11px] font-bold tracking-wide text-muted">מאזן תפעולי</p>
          <p className={`mt-1 text-2xl font-black ${totals.balance >= 0 ? "text-teal-dark" : "text-red-600"}`}>
            {Math.round(totals.balance).toLocaleString()} ₪
          </p>
        </div>
        <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
          <span className="absolute right-0 top-0 h-full w-1 bg-[#6b46c1]" />
          <p className="text-[11px] font-bold tracking-wide text-muted">השקעה בציוד (הוני)</p>
          <p className="mt-1 text-2xl font-black text-[#6b46c1]">{Math.round(totals.capital).toLocaleString()} ₪</p>
          <p className="mt-1 text-[11px] text-muted">
            מתחת לשורה התחתונה — זה הון, לא הוצאה
            {totals.capitalIn > 0 && ` · חזרו ${Math.round(totals.capitalIn).toLocaleString()} ₪ ממכירת ציוד`}
          </p>
        </div>
      </div>

      <p className="mb-4 text-[11.5px] leading-relaxed text-muted">
        <b className="text-ink">{FLOW_LABEL}</b> — {FLOW_HELP}. הוצאה שהשותף שילם בפועל לא מופיעה כאן גם
        אם חלק ממנה עליי: הכסף לא יצא מהחשבון שלי, והחלק שלי מתקזז מול ההעברה החודשית ממנו.
        רכישת ציוד מוצגת בנפרד, כי היא לא הוצאה אלא המרה של כסף לנכס.
      </p>

      {pendingCount > 0 && (
        <Link
          href="/dashboard/accounting/attribute"
          className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-card border border-[#e6a23c] bg-[#fff9ef] px-4 py-3 shadow-card transition hover:bg-[#fff4e0]"
        >
          <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-[#8a5a00]">
            <Split className="h-4 w-4" />
            {pendingCount} תנועות ישנות ממתינות לשיוך לסניפים
          </span>
          <span className="text-[12.5px] font-bold text-[#8a5a00] underline">למסך השיוך ←</span>
        </Link>
      )}

      <div className="mb-6 grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TransactionForm branches={formBranches} ownerName={ownerName} />
        <CollectModal routes={routes} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EntryList kind="income" entries={incomeRows} branches={branchGroups} />
        <EntryList kind="expense" entries={expenseRows} branches={branchGroups} />
      </div>
    </div>
  );
}
