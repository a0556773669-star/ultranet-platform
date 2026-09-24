import Link from "next/link";
import { BarChart3, ArrowLeft } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import {
  loadBranchAccountingRawData,
  computeBranchFinancials,
  currentMonth as getCurrentMonth,
} from "@/lib/branch-accounting-data";
import { monthsBetween } from "@/lib/branch-accounting";
import { buildBranchLedger } from "@/lib/branch-ledger";
import { MonthPicker } from "./month-picker";
import { PartnerAccountingView } from "./partner-view";
import { BranchSummaryTable, type BranchSummaryRow } from "./branch-summary-table";
import type { MonthFlow } from "@/lib/monthly-flow";

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
 * שנשאלות במקום אחר - טבלת ההתחשבנות עברה להנה"ח הראשית (`/dashboard/accounting/mobile`),
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

  // השותף לא רואה את הטבלה הזו בכלל. הטבלה מציגה את חלקו של *הבעלים* בכל סניף
  // (ownerInvestedToDate / ownerEarnedToDate / ownerBalanceToDate) תחת כותרות בגוף ראשון
  // "ההוצאות שלי" / "ההכנסות שלי" - מספרים שאינם שלו, וקריאים כאילו הם כן. מה שהשותף שואל
  // הוא שאלה אחרת, והתשובה לה היא PartnerAccountingView: שש משבצות וחשבון פתוח, וזהו.
  if (!isOwner) {
    const myEmail = session.user?.email?.trim().toLowerCase();
    // הסניפים שלו: זה שהוצמד למשתמש, ובנוסף כל סניף שהמייל שלו רשום כ-partnerEmail של הסניף -
    // כך ששותף עם כמה סניפים, או כזה שלא הוצמד לו branchId, עדיין רואה את שלו.
    const myBranches = allRentals.filter(
      (b) => (!!myBranchId && b.id === myBranchId) || (!!myEmail && b.partnerEmail?.trim().toLowerCase() === myEmail)
    );
    // יוצאים כאן תמיד, גם כשלא נמצא אף סניף, כדי שלא תהיה שום דרך ליפול לגוף העמוד.
    // החודש הוא תמיד החודש הנוכחי: לשותף אין בורר חודשים, ו-?month= בכתובת לא מזיז לו כלום.
    return (
      <div className="flex max-w-3xl flex-col gap-5">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <BarChart3 className="h-5 w-5" />
          {'הנה"ח'}
        </h1>
        {myBranches.length === 0 ? (
          <p className="rounded-card border border-card-border bg-white p-4 text-sm text-muted shadow-card">
            לא משויך אליך סניף השכרות. יש לפנות לבעלים כדי שיצמיד את המשתמש שלך לסניף.
          </p>
        ) : (
          myBranches.map((b) => (
            <PartnerAccountingView
              key={b.id}
              view={{
                financials: computeBranchFinancials(b, raw, thisMonth),
                openBalance: buildBranchLedger(b, raw).currentBalance,
                closed: isClosed(b),
                sales: [...(raw.salesByBranch.get(b.id) ?? [])].sort((x, y) => y.date.localeCompare(x.date)),
              }}
            />
          ))
        )}
      </div>
    );
  }

  const visible = allRentals.filter((b) => showClosed || !isClosed(b));

  // הגרף שנפתח מתחת לכל שורה: 24 החודשים שעד החודש הנבחר (מחודש הפתיחה, אם הוא מאוחר יותר),
  // כמה הוצאתי וכמה הכנסתי בכל חודש — החלק שלי, בדיוק כמו בעמודות הטבלה.
  const chartMonths = monthOptions.filter((m) => m <= month).reverse();
  const flowOf = (branch: (typeof allRentals)[number]): MonthFlow[] => {
    const opened = (branch.openedAt || branch.founded || "").slice(0, 7);
    return chartMonths
      .filter((m) => !opened || m >= opened)
      .map((m) => {
        const f = computeBranchFinancials(branch, raw, m);
        return { month: m, income: f.ownerIncomeThisMonth, expense: f.ownerExpenseThisMonth };
      });
  };

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
        laptopCostToDate: f.laptopCostToDate,
        saleIncomeToDate: f.saleIncomeToDate,
        flow: flowOf(branch),
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
          <Link href="/dashboard/accounting/mobile" className="inline-flex items-center gap-1 font-bold text-teal underline">
            למסך ההעברות
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </p>
      )}
    </div>
  );
}
