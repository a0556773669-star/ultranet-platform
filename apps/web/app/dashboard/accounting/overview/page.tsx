import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getOwnerName } from "@/lib/owner-name";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  loadAccountingOverview,
  currentMonth,
  branchMonthOf,
  branchActivityOf,
  bookOf,
  BOOK_LABEL,
  type AccountingBook,
} from "@/lib/accounting-overview";
import { BookSwitcher, type BookSummary } from "./book-switcher";
import { AccountingTabs } from "../accounting-tabs";
import { MyLedgerCard, RulesCard } from "./panels";
import {
  BranchesTable,
  BranchMiniCards,
  FlowCard,
  KpiRow,
  ModeTabs,
  MonthPills,
  OverviewReportTable,
  mLabel,
  money,
} from "./ui";

const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * All-time totals of the owner's own ledger, with no month window at all.
 * The monthly report deliberately shows a 12-month window, which silently hides everything
 * older than that - and most of this business's spending (branch setup) predates it. This strip
 * is the "מתחילת הדרך" answer that used to be the whole of the old accounting screen.
 */
async function AllTimeStrip() {
  const db = getAdminFirestore();
  const [incomeSnap, expenseSnap] = await Promise.all([
    db.collection("n_ah_income").get(),
    db.collection("n_ah_expenses").get(),
  ]);
  const income = incomeSnap.docs.reduce((s, d) => s + ((d.data() as { amount?: number }).amount ?? 0), 0);
  const expense = expenseSnap.docs.reduce((s, d) => s + ((d.data() as { amount?: number }).amount ?? 0), 0);
  const balance = income - expense;
  const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
  const fmt = (n: number) => `${nf.format(Math.round(n))} ₪`;

  const cells = [
    { label: 'סה"כ הכנסות מתחילת הדרך', value: fmt(income), color: "#059669", rail: "#059669" },
    { label: 'סה"כ הוצאות מתחילת הדרך', value: fmt(expense), color: "#dc2626", rail: "#dc2626" },
    { label: "מאזן מתחילת הדרך", value: fmt(balance), color: balance >= 0 ? "#0f6e56" : "#dc2626", rail: "#1a8a76" },
  ];

  return (
    <section className="mb-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {cells.map((c) => (
          <article
            key={c.label}
            className="relative overflow-hidden rounded-card border border-card-border bg-white py-2.5 pl-3.5 pr-3 shadow-card"
          >
            <span className="absolute right-0 top-0 h-full w-[3px]" style={{ background: c.rail }} />
            <p className="text-[11px] font-extrabold text-muted">{c.label}</p>
            <p className="mt-px text-[21px] font-black leading-tight tabular-nums" style={{ color: c.color }}>
              {c.value}
            </p>
          </article>
        ))}
      </div>
      <p className="mt-1.5 px-1 text-[11.5px] text-muted">
        כל ההכנסות וההוצאות שהוזנו להנה&quot;ח האישית, מהיום הראשון ובלי הגבלת חודשים — בניגוד לדוח
        למטה, שמציג חלון של 12 חודשים.
      </p>
    </section>
  );
}

export default async function AccountingOverviewPage({
  searchParams,
}: {
  searchParams?: { month?: string; mode?: string; book?: string };
}) {
  const session = await requireModuleAccess("accounting");
  const isOwner = session.user?.role === "owner";

  // A branch manager / partner never sees the cross-business picture - straight to their own branch.
  if (!isOwner) {
    const myBranchId = session.user?.branchId;
    if (!myBranchId || myBranchId === "all") redirect("/dashboard");
    redirect(`/dashboard/accounting/overview/${myBranchId}`);
  }

  const book: AccountingBook = searchParams?.book === "rooms" ? "rooms" : "rentals";
  const month = searchParams?.month && MONTH_RE.test(searchParams.month) ? searchParams.month : currentMonth();
  const cum = searchParams?.mode === "cum";
  const modeSuffix = `${cum ? "&mode=cum" : ""}&book=${book}`;

  const [data, ownerName] = await Promise.all([
    loadAccountingOverview(month),
    getOwnerName(session.user?.name),
  ]);

  const idx = data.months.indexOf(month);
  const row = data.rows[idx];
  const prevRow = idx > 0 ? data.rows[idx - 1] : undefined;
  const my = data.myByMonth.get(month);

  if (!row || !my) {
    return <p className="text-sm text-muted">אין נתונים להצגה עבור {mLabel(month)}.</p>;
  }

  const runningBalance = data.rows.slice(0, idx + 1).reduce((sum, r) => sum + r.mine.profit, 0);
  // The side column is the laptop-rental branches only; computer rooms and the coworking office
  // sit under the owner's own expenses instead, which is how the owner thinks about them.
  const entries = data.branches.flatMap((branch) => {
    const stats = branchMonthOf(data, branch.id, month);
    const activity = branchActivityOf(data, branch.id);
    return stats && activity ? [{ branch, stats, activity }] : [];
  });

  const rentalEntries = entries.filter((e) => bookOf(e.branch) === "rentals");
  const ownEntries = entries.filter((e) => bookOf(e.branch) === "rooms");

  // The two books never share a branch, so their figures are independent and are shown side by
  // side rather than added up.
  const bookSummaries: BookSummary[] = (["rentals", "rooms"] as const).map((bk) => {
    const list = bk === "rentals" ? rentalEntries : ownEntries;
    return {
      book: bk,
      branchCount: list.length,
      runningCount: list.filter((e) => e.stats.status === "active").length,
      income: list.reduce((sum, e) => sum + e.stats.income, 0),
      expense: list.reduce((sum, e) => sum + e.stats.expense, 0),
    };
  });
  const activeList = book === "rentals" ? rentalEntries : ownEntries;

  const branchHref = (branchId: string) => `/dashboard/accounting/overview/${branchId}?month=${month}${modeSuffix}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div>
            <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
              <BarChart3 className="h-5 w-5" />
              הנהלת חשבונות
            </h1>
            <p className="mt-0.5 text-[12.5px] text-muted">מצב העסק — כללי ולפי סניף</p>
          </div>
          <span className="rounded-full bg-teal-bg px-2.5 py-1 text-[11px] font-extrabold text-teal-dark">
            גלוי ל{ownerName} בלבד
          </span>
        </div>
        <AccountingTabs active="/dashboard/accounting/overview" />
      </div>

      <div className="mb-3">
        <MonthPills
          months={data.months}
          current={month}
          hrefFor={(m) => `/dashboard/accounting/overview?month=${m}${modeSuffix}`}
        />
      </div>

      {data.usingDefaultRates && (
        <div className="mb-3 rounded-card border border-[#f0dcb8] bg-[#fdf3e3] px-4 py-3 text-[12.5px] font-bold text-[#7a4a12]">
          התעריפון עדיין לא נשמר במערכת — כרגע בשימוש ערכי ברירת המחדל (מחשב 1,200 ₪ · תיק 50 ₪ · סטיק 120 ₪ ·
          סינון וגלישה 70 ₪ · פרסום 600 ₪ · הדפסות 20 ₪).{" "}
          <Link href="/dashboard/accounting/rates" className="underline">
            לפתיחת התעריפון ועריכתו
          </Link>
        </div>
      )}

      <KpiRow
        cards={[
          {
            label: `ההכנסות שלי ${mLabel(month)}`,
            value: row.mine.income,
            prev: prevRow?.mine.income,
            color: "#059669",
            rail: "#059669",
            footLabel: "הסניפים",
            foot: row.branches.income,
          },
          {
            label: `ההוצאות שלי ${mLabel(month)}`,
            value: row.mine.expense,
            prev: prevRow?.mine.expense,
            color: "#dc2626",
            rail: "#dc2626",
            footLabel: "הסניפים",
            foot: row.branches.expense,
          },
          {
            label: `הרווח שלי ${mLabel(month)}`,
            value: row.mine.profit,
            prev: prevRow?.mine.profit,
            color: row.mine.profit >= 0 ? "#0f6e56" : "#dc2626",
            rail: "#1a8a76",
            footLabel: "הסניפים",
            foot: row.branches.profit,
          },
        ]}
      />

      <BookSwitcher
        summaries={bookSummaries}
        active={book}
        monthLabel={mLabel(month)}
        hrefFor={(bk) => `/dashboard/accounting/overview?month=${month}${cum ? "&mode=cum" : ""}&book=${bk}`}
      />

      <AllTimeStrip />

      <MyLedgerCard my={my} runningBalance={runningBalance} defaultDate={`${month}-01`} />


      <div className="mt-3.5 grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3.5">
          <OverviewReportTable
            rows={data.rows.slice(0, idx + 1)}
            current={month}
            cum={cum}
            modeTabs={
              <ModeTabs
                cum={cum}
                monthlyHref={`/dashboard/accounting/overview?month=${month}`}
                cumHref={`/dashboard/accounting/overview?month=${month}&mode=cum`}
              />
            }
          />
          <BranchesTable month={month} entries={activeList} hrefFor={branchHref} />
          <RulesCard ownerName={ownerName} />
        </div>

        <div className="flex flex-col gap-3.5">
          <FlowCard
            title="תזרים — הסניפים"
            series={data.rows.slice(0, idx + 1).map((r) => ({
              month: r.month,
              income: r.branches.income,
              expense: r.branches.expense,
            }))}
            lapProfit={data.rows.slice(0, idx + 1).map((r) => r.rentals.profit)}
            cumValues={data.rows.slice(0, idx + 1).map((r) => r.mine.profit)}
            cumLabel="יתרה מצטברת שלי — לפי מה שהזנתי"
            footLeftLabel={`יתרה מצטברת שלי עד ${mLabel(month)}`}
            footLeftValue={runningBalance}
            footRightLabel="רווח הסניפים החודש"
            footRightValue={row.branches.profit}
            note={`עמודות = כל הסניפים יחד (ניידים + חדרי מחשבים). הקו הכחול = הרווח מהשכרות הניידים בלבד — החודש ${money(
              row.rentals.profit,
            )}.`}
          />
          <BranchMiniCards
            month={month}
            entries={activeList}
            hrefFor={branchHref}
            title={BOOK_LABEL[book]}
            subtitle={`${mLabel(month)} · לחיצה פותחת את הסניף`}
          />
        </div>
      </div>
    </div>
  );
}
