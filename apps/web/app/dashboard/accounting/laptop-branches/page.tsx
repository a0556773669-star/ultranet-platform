import Link from "next/link";
import { LineChart, ChevronRight, ChevronLeft, UserCog } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { loadBranchAccountingRawData, currentMonth } from "@/lib/branch-accounting-data";
import {
  buildLaptopBranchTracking,
  computeSecretaryShare,
  trackingWindow,
} from "@/lib/laptop-branch-tracking";
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
  const secretary = computeSecretaryShare(raw.branches, raw, end);

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

      <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <UserCog className="h-4 w-4" />
          חלק המזכירה — {secretary.pct}% מהברוטו של הסניף הראשי
        </h2>
        <p className="text-[11.5px] leading-relaxed text-muted">
          המזכירה מתפעלת את המחשבים שבסניפים שלי ומקבלת {secretary.pct}% מהברוטו שלהם כמשכורת. הסכום
          במכוון לא מופיע בטבלת ההעברות — זו משכורת, לא התחשבנות מול שותף. הדרך לרשום אותו היא
          שורה &quot;משכורת מזכירה&quot; ב
          <Link href="/dashboard/accounting/extra-expenses" className="mx-1 font-bold text-teal underline">
            הוצאות נוספות
          </Link>
          , שם היא נשמרת חודש-חודש עם היסטוריה.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[13px]">
          <span className="text-muted">
            ברוטו {end}: <b className="text-ink">{money(secretary.grossIncome)}</b>
          </span>
          <span className="text-muted">
            {secretary.pct}% ממנו: <b className="text-red-600">{money(secretary.amount)}</b>
          </span>
          <span className="text-[11px] text-muted">
            {secretary.branchNames.length > 0 ? `סניפים: ${secretary.branchNames.join(", ")}` : "אין סניפים שלי"}
          </span>
        </div>
      </div>
    </div>
  );
}
