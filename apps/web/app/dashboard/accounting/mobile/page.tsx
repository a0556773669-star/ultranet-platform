import Link from "next/link";
import { Laptop, ChevronRight, ChevronLeft, UserCog, Users, ArrowRightLeft, LineChart } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import {
  loadBranchAccountingRawData,
  branchDatedIncomeLines,
  currentMonth,
} from "@/lib/branch-accounting-data";
import { monthsBetween } from "@/lib/branch-accounting";
import { buildLaptopBranchTracking, trackingWindow } from "@/lib/laptop-branch-tracking";
import { buildBranchTransferRows } from "@/lib/branch-transfer-rows";
import {
  BRANCH_REVENUE_SHARES,
  ambiguousRevenueShares,
  resolveBranchRevenueShares,
  revenueShareForMonth,
} from "@/lib/revenue-shares";
import { loadReportRecipients, loadOwnerEmail } from "@/lib/branch-report-recipients";
import { monthLabel } from "@/lib/branch-month-report";
import { mailerConfigError, mailerSandboxMode, SANDBOX_NOTICE } from "@/lib/mailer";
import { loadPartnerPayouts, monthWindow } from "@/lib/partner-payouts";
import { AccountingTabs } from "../accounting-tabs";
import { TrackingTable } from "./tracking-table";
import { CompactTransfersTable } from "./compact-transfers-table";
import { UnifiedBranchesTable } from "./unified-branches-table";
import { WideTableModal } from "./wide-table-modal";
import { ReportButtons } from "./report-buttons";
import { PartnerPayoutTable } from "./partner-payout-table";
import { TransfersMonthPicker } from "./month-picker";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/** מזיז את חלון 12 החודשים ב-`delta` חודשים. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  let yy = y ?? new Date().getFullYear();
  let mm = (m ?? 1) + delta;
  while (mm > 12) {
    mm -= 12;
    yy += 1;
  }
  while (mm < 1) {
    mm += 12;
    yy -= 1;
  }
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

/** 24 החודשים האחרונים, החדש ראשון — האפשרויות בבורר החודש של ההעברות. */
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
 * ניידים — מעקב ההצלחה של הסניפים וההעברות שביניהם, במסך אחד.
 *
 * עד היום אלה היו שתי לשוניות: "מעקב סניפים ניידים" ו"העברות חודשיות". הן תמיד נשאלו
 * יחד — "הסניף הזה מרוויח לי מספיק?" ו"וכמה הוא חייב לי בסוף החודש?" הן אותה שאלה מזוויות
 * שונות — ומעבר בין לשוניות כדי להצליב ביניהן הוא בדיוק סוג הדבר שגורם להסתכל רק על אחת.
 *
 * מימין המעקב: רווח נטו למחשב, 12 חודשים לרוחב. משמאל ההעברות: יתרה וכמה צריך להעביר,
 * עם הכפתורים של הדו"ח מעליהן. הטבלה הרחבה של ההעברות (הוצאות, הכנסות, קבלות) לא נמחקה —
 * היא נפתחת בכפתור "טבלה רחבה", כי היא ההסבר ולא ההחלטה.
 *
 * שני צירי זמן במסך אחד, בכוונה: `end` הוא סוף חלון המעקב ו-`month` הוא חודש ההעברות.
 * החלון הוא השוואה על פני שנה והחודש הוא פעולה על חודש אחד, וכפייה של אותו ערך על שניהם
 * הייתה מקצרת את אחד מהם בלי סיבה.
 */
export default async function MobileAccountingPage({
  searchParams,
}: {
  searchParams?: { end?: string; month?: string };
}) {
  const session = await requireOwner();
  const raw = await loadBranchAccountingRawData();

  const now = currentMonth();

  // ---- חלון המעקב (סניפים × חודשים) ----
  const requestedEnd = searchParams?.end;
  const end = requestedEnd && /^\d{4}-\d{2}$/.test(requestedEnd) ? requestedEnd : now;
  const months = trackingWindow(end, 12);

  const trackedBranches = raw.branches
    .filter((b) => b.branchType === "rentals" && !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
  const tracking = buildLaptopBranchTracking(trackedBranches, raw, months);

  // ההסדרים הפר-סניפיים (30% מהסניף הראשי לאלישבע רומנו). מוצגים כאן, ליד הרווח
  // שהם יוצאים ממנו, אבל החוב עצמו מנוהל בטבלת האחוזים שבצד השני של המסך.
  const ambiguous = ambiguousRevenueShares(raw.branches);
  const branchShares = resolveBranchRevenueShares(raw.branches).map(({ share, branch }) => ({
    share,
    branch,
    ...revenueShareForMonth(branchDatedIncomeLines(branch, raw), share, end),
  }));

  // ---- חודש ההעברות ----
  const monthOptions = selectableMonths(now);
  const requestedMonth = searchParams?.month;
  const month =
    requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) && monthOptions.includes(requestedMonth)
      ? requestedMonth
      : now;

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
    loadPartnerPayouts(monthWindow(now, 24)),
  ]);

  const transferRows = buildBranchTransferRows(settlingBranches, raw, month);
  const recipientById = new Map(recipients.map((r) => [r.branchId, r]));
  const sendRows = transferRows.map((row) => ({
    branchId: row.branch.id,
    branchName: row.branch.name,
    email: recipientById.get(row.branch.id)?.email ?? null,
    // מה שעוד נשאר להעביר החודש: "צריך להעביר" פחות מה שכבר סומן כהועבר.
    totalDue: row.totalDue - row.transferredAmount,
    sent: !!raw.transfersByBranchMonth.get(`${row.branch.id}|${month}`)?.reportSentAt,
  }));

  const query = (nextEnd: string) => `?end=${nextEnd}&month=${month}`;
  const prevHref = `/dashboard/accounting/mobile${query(shiftMonth(end, -12))}`;
  const forwardEnd = shiftMonth(end, 12);
  const nextHref = `/dashboard/accounting/mobile${query(forwardEnd > now ? now : forwardEnd)}`;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Laptop className="h-5 w-5" />
            ניידים
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            רווח נטו למחשב פר סניף, ולצדו מה שכל סניף צריך להעביר החודש
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/mobile" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* ימין: המעקב */}
        <section className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
              <LineChart className="h-4 w-4" />
              מעקב סניפים ניידים
            </h2>
            <div className="flex items-center gap-2">
              <Link
                href={prevHref}
                className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-xs font-bold text-ink transition hover:border-teal hover:text-teal"
              >
                <ChevronRight className="h-3.5 w-3.5" />
                12 אחורה
              </Link>
              <span className="whitespace-nowrap text-xs font-bold text-muted">
                {months[0]} — {months[months.length - 1]}
              </span>
              {end < now ? (
                <Link
                  href={nextHref}
                  className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-xs font-bold text-ink transition hover:border-teal hover:text-teal"
                >
                  12 קדימה
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span className="px-2.5 py-1.5 text-xs text-muted">עד היום</span>
              )}
            </div>
          </div>

          <TrackingTable tracking={tracking} />

          {/* הסדר שהוגדר ולא נתפס על אף סניף הוא שקט מסוכן: הוא לא מנכה כלום ולא מייצר חוב,
              ואי אפשר לדעת את זה בלי להסתכל בקוד. לכן הוא נאמר כאן במפורש. */}
          {ambiguous.length > 0 && (
            <div className="rounded-card border border-red-300 bg-red-50 p-4 text-[12.5px] leading-relaxed text-ink shadow-card">
              <b>אותו הסדר נתפס על יותר מסניף אחד — הוא נגבה פעמיים.</b>{" "}
              {ambiguous
                .map((a) => `${a.share.pct}% ל${a.share.personName}: ${a.branches.map((b) => b.name).join(" + ")}`)
                .join(" · ")}
              . ההתאמה נעשית לפי שם, ויותר מסניף אחד עונה עליו. צריך לקבע את{" "}
              <code>branchId</code> ב-<code>BRANCH_REVENUE_SHARES</code> (
              <code>lib/revenue-shares.ts</code>) כדי שזה יצביע על סניף אחד בלבד.
            </div>
          )}

          {branchShares.length === 0 && BRANCH_REVENUE_SHARES.length > 0 && (
            <div className="rounded-card border border-amber-300 bg-amber-50 p-4 text-[12.5px] leading-relaxed text-ink shadow-card">
              <b>הסדר אחוזים מוגדר אבל לא נמצא לו סניף.</b>{" "}
              {BRANCH_REVENUE_SHARES.map((sh) => `${sh.pct}% ל${sh.personName}`).join(", ")} — ההתאמה נעשית
              לפי שם הסניף, בין סניפי ההשכרות. אף סניף לא התאים, ולכן לא מנוכה כלום ולא נוצר
              חוב. צריך לעדכן את <code>BRANCH_REVENUE_SHARES</code> ב-<code>lib/revenue-shares.ts</code>.
            </div>
          )}

          {branchShares.length > 0 && (
            <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-extrabold text-ink">
                <UserCog className="h-4 w-4" />
                אחוזים מהברוטו של הסניף
              </h3>
              <p className="text-[11.5px] leading-relaxed text-muted">
                מי שמתפעל את המחשבים של הסניף מקבל אחוז מהברוטו שלו. הסכום הזה <b>כבר ירד</b> מהרווח
                שבטבלה למעלה — הוא מעולם לא היה שלי. מה שנשאר להעביר בפועל, כולל חודשים קודמים, נמצא
                בטבלת האחוזים שבצד השני של המסך, ואין צורך לרשום אותו שוב כהוצאה.
              </p>
              <div className="mt-2.5 flex flex-col gap-2">
                {branchShares.map(({ share, branch, gross, amount }) => (
                  <div
                    key={`${share.personName}|${branch.id}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-card-border bg-[#f9fafb] px-3 py-2 text-[13px]"
                  >
                    <span className="font-extrabold text-ink">{share.personName}</span>
                    <span className="text-muted">
                      {share.pct}% מ<b className="text-ink">{branch.name}</b>
                    </span>
                    <span className="text-[11px] text-muted">החל מ-{share.startDate}</span>
                    <span className="text-muted">
                      ברוטו {end}: <b className="text-ink">{money(gross)}</b>
                    </span>
                    <span className="text-muted">
                      מגיע לה: <b className="text-red-600">{money(amount)}</b>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* שמאל: ההעברות */}
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <ArrowRightLeft className="h-4 w-4" />
            העברות חודשיות
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <TransfersMonthPicker month={month} months={monthOptions} />
            <ReportButtons
              month={month}
              monthLabel={monthLabel(month)}
              recipients={recipients}
              ownerEmail={ownerEmail}
              mailerError={mailerConfigError()}
              sandboxNotice={mailerSandboxMode() ? SANDBOX_NOTICE : null}
              sendRows={sendRows}
            />
            <WideTableModal title={`העברות חודשיות — ${monthLabel(month)}`}>
              <UnifiedBranchesTable rows={transferRows} month={month} />
            </WideTableModal>
          </div>

          <CompactTransfersTable rows={transferRows} month={month} />

          {myBranches.length > 0 && (
            <p className="px-1 text-[11.5px] leading-relaxed text-muted">
              לא מוצגים כאן: {myBranches.map((b) => b.name).join(", ")} — סניפים שלי, שאין מולם התחשבנות ולא
              נשלח אליהם דו&quot;ח חודשי.
            </p>
          )}

          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold text-ink">
              <Users className="h-4 w-4" />
              אחוזים שאני צריך להעביר — יתרה מצטברת
            </h3>
            <p className="mb-2 px-1 text-[11.5px] leading-relaxed text-muted">
              מי שיש לו אחוז מהברוטו של ההשכרות: אחוז ממחשבים מסוימים (מוגדר על המחשב), ואחוז מסניף
              שלם החל מתאריך (מוגדר ב-<code>lib/revenue-shares.ts</code>). הסכומים כבר ירדו מהרווח שלי
              בכל מקום, וכאן הם מופיעים כחוב שמצטבר עד שמסמנים שהועבר — בדיוק כמו התחשבנות מול סניף.
            </p>
            <PartnerPayoutTable summaries={payouts} currentMonth={now} />
          </div>
        </section>
      </div>
    </div>
  );
}
