import { ArrowRightLeft, Users } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { loadBranchAccountingRawData, currentMonth } from "@/lib/branch-accounting-data";
import { monthsBetween } from "@/lib/branch-accounting";
import { loadReportRecipients, loadOwnerEmail } from "@/lib/branch-report-recipients";
import { monthLabel } from "@/lib/branch-month-report";
import { mailerConfigError, mailerSandboxMode, SANDBOX_NOTICE } from "@/lib/mailer";
import { loadPartnerPayouts, monthWindow } from "@/lib/partner-payouts";
import { AccountingTabs } from "../accounting-tabs";
import { UnifiedBranchesTable } from "./unified-branches-table";
import { ReportButtons } from "./report-buttons";
import { PartnerPayoutTable } from "./partner-payout-table";
import { TransfersMonthPicker } from "./month-picker";

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
 * ההעברות החודשיות — מי צריך להעביר לי כמה, ולמי אני צריך להעביר.
 *
 * הטבלה עצמה עברה לכאן מהנה"ח ההשכרות: היא מזיזה כסף אל תוך הספר הראשי ומחוצה לו,
 * ולכן מקומה ליד הספר ולא בתוך מודול תפעולי.
 *
 * שני שינויים מהותיים לעומת מה שהיה:
 *  1. **הסניפים שלי לא כאן.** סניף שאני הבעלים היחיד שלו לא "מעביר לי" כלום - הכסף כבר
 *     שלי. שורה כזו הייתה מוסיפה סכום שאף אחד לא אמור לשלם, ולכן היא מסוננת ולא מוצגת
 *     כאפס.
 *  2. **שותפי מחשבים מצטברים.** חודש שלא סימנתי שהעברתי בו לא נעלם - הוא נשאר ביתרה
 *     עד שיסומן. ראה `lib/partner-payouts.ts`.
 */
export default async function TransfersPage({
  searchParams,
}: {
  searchParams?: { month?: string };
}) {
  const session = await requireOwner();
  const raw = await loadBranchAccountingRawData();

  const thisMonth = currentMonth();
  const monthOptions = selectableMonths(thisMonth);
  const requested = searchParams?.month;
  const month =
    requested && /^\d{4}-\d{2}$/.test(requested) && requested <= thisMonth && monthOptions.includes(requested)
      ? requested
      : thisMonth;

  // Only branches that actually owe (or are owed) belong here: a branch of mine settles with
  // nobody, so it is excluded rather than shown as a zero row.
  const settlingBranches = raw.branches.filter(
    (b) => b.branchType === "rentals" && !b.deleted && !b.notStarted && b.isMine === false,
  );
  const myBranches = raw.branches.filter(
    (b) => b.branchType === "rentals" && !b.deleted && b.isMine !== false,
  );

  const [recipients, ownerEmail, payouts] = await Promise.all([
    loadReportRecipients(settlingBranches),
    loadOwnerEmail(session.user?.email),
    loadPartnerPayouts(monthWindow(thisMonth, 24)),
  ]);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <ArrowRightLeft className="h-5 w-5" />
            העברות חודשיות
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">כמה כל סניף צריך להעביר החודש, כולל יתרות מחודשים קודמים</p>
        </div>
        <AccountingTabs active="/dashboard/accounting/transfers" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TransfersMonthPicker month={month} months={monthOptions} />
        <ReportButtons
          month={month}
          monthLabel={monthLabel(month)}
          recipients={recipients}
          ownerEmail={ownerEmail}
          mailerError={mailerConfigError()}
          sandboxNotice={mailerSandboxMode() ? SANDBOX_NOTICE : null}
        />
      </div>

      <UnifiedBranchesTable branches={settlingBranches} raw={raw} month={month} />

      {myBranches.length > 0 && (
        <p className="px-1 text-[11.5px] leading-relaxed text-muted">
          לא מוצגים כאן: {myBranches.map((b) => b.name).join(", ")} — סניפים שלי, שאין מולם התחשבנות ולא נשלח
          אליהם דו&quot;ח חודשי.
        </p>
      )}

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <Users className="h-4 w-4" />
          שותפי מחשבים — יתרה מצטברת
        </h2>
        <PartnerPayoutTable summaries={payouts} currentMonth={thisMonth} />
      </section>
    </div>
  );
}
