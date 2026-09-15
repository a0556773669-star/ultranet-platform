import Link from "next/link";
import { LineChart, ChevronRight, ChevronLeft, UserCog } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import {
  loadBranchAccountingRawData,
  branchDatedIncomeLines,
  currentMonth,
} from "@/lib/branch-accounting-data";
import { buildLaptopBranchTracking, trackingWindow } from "@/lib/laptop-branch-tracking";
import {
  BRANCH_REVENUE_SHARES,
  ambiguousRevenueShares,
  resolveBranchRevenueShares,
  revenueShareForMonth,
} from "@/lib/revenue-shares";
import { AccountingTabs } from "../accounting-tabs";
import { TrackingTable } from "./tracking-table";

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

/**
 * מעקב סניפי ניידים — כמה כל מחשב מרוויח לי, פר סניף, פר חודש.
 *
 * זו השאלה שאי אפשר היה לשאול קודם: הרווח למחשב היה מוצג בתוך כרטיס של סניף בודד, כך
 * שכדי להשוות בין סניפים היה צריך לפתוח אותם אחד-אחד ולזכור. כאן זו טבלה אחת - חודשים
 * לרוחב, סניפים לאורך - וההשוואה היא פשוט מבט.
 */
export default async function LaptopBranchesPage({
  searchParams,
}: {
  searchParams?: { end?: string };
}) {
  await requireOwner();
  const raw = await loadBranchAccountingRawData();

  const now = currentMonth();
  const requested = searchParams?.end;
  const end = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : now;
  const months = trackingWindow(end, 12);

  const branches = raw.branches
    .filter((b) => b.branchType === "rentals" && !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));

  const tracking = buildLaptopBranchTracking(branches, raw, months);
  // ההסדרים הפר-סניפיים (30% מהסניף הראשי לאלישבע רומנו). מוצגים כאן, ליד הרווח
  // שהם יוצאים ממנו, אבל החוב עצמו מנוהל ב-/transfers יחד עם האחוזים הפר-מחשביים.
  const ambiguous = ambiguousRevenueShares(raw.branches);
  const branchShares = resolveBranchRevenueShares(raw.branches).map(({ share, branch }) => ({
    share,
    branch,
    ...revenueShareForMonth(branchDatedIncomeLines(branch, raw), share, end),
  }));

  const prevHref = `/dashboard/accounting/laptop-branches?end=${shiftMonth(end, -12)}`;
  const nextEnd = shiftMonth(end, 12);
  const nextHref = `/dashboard/accounting/laptop-branches?end=${nextEnd > now ? now : nextEnd}`;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <LineChart className="h-5 w-5" />
            מעקב סניפים ניידים
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            רווח נטו למחשב, אחרי הוצאות — 12 חודשים בכל מסך
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/laptop-branches" />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Link
          href={prevHref}
          className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink transition hover:border-teal hover:text-teal"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          12 חודשים אחורה
        </Link>
        <span className="text-xs font-bold text-muted">
          {months[0]} — {months[months.length - 1]}
        </span>
        {end < now ? (
          <Link
            href={nextHref}
            className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink transition hover:border-teal hover:text-teal"
          >
            12 חודשים קדימה
            <ChevronLeft className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-xs text-muted">עד היום</span>
        )}
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
          <h2 className="mb-1 flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <UserCog className="h-4 w-4" />
            אחוזים מהברוטו של הסניף
          </h2>
          <p className="text-[11.5px] leading-relaxed text-muted">
            מי שמתפעל את המחשבים של הסניף מקבל אחוז מהברוטו שלו. הסכום הזה <b>כבר ירד</b> מהרווח
            שבטבלה למעלה — הוא מעולם לא היה שלי. מה שנשאר להעביר בפועל, כולל חודשים קודמים,
            נמצא ב
            <Link href="/dashboard/accounting/transfers" className="mx-1 font-bold text-teal underline">
              העברות חודשיות
            </Link>
            , ואין צורך לרשום אותו שוב כהוצאה.
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
    </div>
  );
}
