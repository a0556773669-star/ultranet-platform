import Link from "next/link";
import { BarChart3, ArrowLeft } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import {
  loadBranchAccountingRawData,
  computeBranchFinancials,
  currentMonth as getCurrentMonth,
} from "@/lib/branch-accounting-data";
import { monthsBetween } from "@/lib/branch-accounting";
import { MonthPicker } from "./month-picker";
import { BranchSummaryTable, type BranchSummaryRow } from "./branch-summary-table";

/** The months the picker offers: the last two years up to (never past) the current month. */
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

/**
 * הנה"ח השכרות — חמש שאלות, טבלה אחת.
 *
 * מה שהיה כאן קודם ניסה להיות כל המודול: טבלת התחשבנות חודשית, כרטיסי סניפים, היסטוריית
 * ספר מלאה, טפסי הכנסה והוצאה, שליחת דוחות ושורת שותפי מחשבים. כמעט כל זה ענה על שאלות
 * שנשאלות במקום אחר - טבלת ההתחשבנות עברה להנה"ח הראשית (`/dashboard/accounting/transfers`),
 * שם היא יושבת ליד הכסף שהיא מזיזה; הכנסות נרשמות במסך הראשי; והוצאות במסך ההוצאות.
 *
 * מה שנשאר הוא מה שבאמת נשאל כאן, פר סניף: כמה מההוצאות היו שלי, כמה מזה יצא לי מהכיס,
 * כמה מההכנסות היו שלי, מה הרווח, וכמה נכנס החודש. חמישה מספרים בשורה - ולכן טבלה.
 */
export default async function RentalsAccountingPage({
  searchParams,
}: {
  searchParams?: { month?: string; closed?: string };
}) {
  const session = await requireModuleAccess("rentals");
  const isOwner = session.user?.role === "owner";
  const myBranchId = session.user?.branchId;

  const raw = await loadBranchAccountingRawData();
  const thisMonth = getCurrentMonth();
  const monthOptions = selectableMonths(thisMonth);
  const requested = searchParams?.month;
  const month =
    requested && /^\d{4}-\d{2}$/.test(requested) && requested <= thisMonth && monthOptions.includes(requested)
      ? requested
      : thisMonth;

  const showClosed = searchParams?.closed === "1";

  const allRentals = raw.branches.filter((b) => b.branchType === "rentals");
  // A branch is "closed" once it carries a business closing date or was soft-deleted. Its history
  // never goes away - it is simply out of the default view, because the question this screen
  // answers is about branches that are still running.
  const isClosed = (b: (typeof allRentals)[number]) => !!b.closedAt || !!b.deleted;
  const visible = allRentals.filter((b) => (isOwner ? true : b.id === myBranchId)).filter((b) => showClosed || !isClosed(b));

  const rows: BranchSummaryRow[] = visible
    .map((branch) => {
      const f = computeBranchFinancials(branch, raw, month);
      return {
        branchId: branch.id,
        branchName: branch.name,
        closed: isClosed(branch),
        myExpensesToDate: f.ownerInvestedToDate,
        cashPaidToDate: f.ownerPaidCashToDate,
        myIncomeToDate: f.ownerEarnedToDate,
        profitToDate: f.ownerBalanceToDate,
        incomingThisMonth: f.settlementNetToOwner,
      };
    })
    .sort((a, b) => a.branchName.localeCompare(b.branchName, "he", { numeric: true }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <BarChart3 className="h-5 w-5" />
            {'הנה"ח השכרות'}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">החלק שלי בכל סניף — הוצאות, הכנסות, רווח ומה נכנס החודש</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker month={month} months={monthOptions} />
          <Link
            href={`/dashboard/rentals/accounting?month=${month}${showClosed ? "" : "&closed=1"}`}
            className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink transition hover:border-teal hover:text-teal"
          >
            {showClosed ? "הסתר סניפים שנסגרו" : "הצג גם סניפים שנסגרו"}
          </Link>
        </div>
      </div>

      <BranchSummaryTable rows={rows} month={month} />

      {isOwner && (
        <p className="px-1 text-[11.5px] leading-relaxed text-muted">
          טבלת ההתחשבנות החודשית (כמה כל סניף צריך להעביר, כולל יתרות מחודשים קודמים) עברה להנה&quot;ח
          הראשית.{" "}
          <Link href="/dashboard/accounting/transfers" className="inline-flex items-center gap-1 font-bold text-teal underline">
            למסך ההעברות
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </p>
      )}
    </div>
  );
}
