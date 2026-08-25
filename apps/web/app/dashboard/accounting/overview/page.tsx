import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getOwnerName } from "@/lib/owner-name";
import { loadAccountingOverview, currentMonth, branchMonthOf, branchActivityOf } from "@/lib/accounting-overview";
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

export default async function AccountingOverviewPage({
  searchParams,
}: {
  searchParams?: { month?: string; mode?: string };
}) {
  const session = await requireModuleAccess("accounting");
  const isOwner = session.user?.role === "owner";

  // A branch manager / partner never sees the cross-business picture - straight to their own branch.
  if (!isOwner) {
    const myBranchId = session.user?.branchId;
    if (!myBranchId || myBranchId === "all") redirect("/dashboard");
    redirect(`/dashboard/accounting/overview/${myBranchId}`);
  }

  const month = searchParams?.month && MONTH_RE.test(searchParams.month) ? searchParams.month : currentMonth();
  const cum = searchParams?.mode === "cum";
  const modeSuffix = cum ? "&mode=cum" : "";

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
  const entries = data.branches.flatMap((branch) => {
    const stats = branchMonthOf(data, branch.id, month);
    const activity = branchActivityOf(data, branch.id);
    return stats && activity ? [{ branch, stats, activity }] : [];
  });

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
          <BranchesTable month={month} entries={entries} hrefFor={branchHref} />
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
          <BranchMiniCards month={month} entries={entries} hrefFor={branchHref} />
        </div>
      </div>
    </div>
  );
}
