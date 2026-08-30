/**
 * "סטטוס הסניפים" - one screen where the owner fills in, for every branch at once, the two facts
 * the whole branch book depends on: when the branch opened, and whether it has started operating
 * at all. Everything else on the accounting screens is derived from these two, so this is where a
 * wrong picture ("branch X owes 300 ₪ for June" on a branch that never opened) gets corrected.
 *
 * Deliberately not a per-branch trip into each branch card: the point is to see all the branches
 * side by side, with what the system currently assumes about each one, and fix them in one pass.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import {
  loadAccountingOverview,
  currentMonth,
  branchMonthOf,
  branchActivityOf,
  branchHasPartner,
  branchPartnerLabel,
  branchOwnerPct,
  monthLabelLong,
  type BranchActivity,
} from "@/lib/accounting-overview";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getOwnerName } from "@/lib/owner-name";
import type { Branch } from "@ultranet/shared-types";
import { AccountingTabs } from "../accounting-tabs";
import { mLabel, money } from "../overview/ui";
import { saveBranchStatusAction } from "./actions";
import { ManageBranches, type ManagedBranch } from "./manage-branches";

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH =
  "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted whitespace-nowrap border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] align-top";
const NUM = "text-left tabular-nums";
const FIELD =
  "w-[140px] rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-[12px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";

/** What the system currently bases this branch's calculation on, in plain Hebrew. */
function startExplanation(a: BranchActivity): string {
  switch (a.startSource) {
    case "manual_not_started":
      return 'מסומן ידנית "עדיין לא התחיל לפעול" — לא נכנס לשום חישוב';
    case "opened_at":
      return `לפי תאריך הפתיחה שהוגדר — מחושב מ-${monthLabelLong(a.openedMonth!)}`;
    case "first_data":
      return `לא הוגדר תאריך פתיחה — מחושב מ-${monthLabelLong(a.firstDataMonth!)}, החודש הראשון שיש בו נתון`;
    default:
      return "אין תאריך פתיחה ואין שום נתון בסניף — לא נכנס לחישוב";
  }
}

export default async function BranchesStatusPage({ searchParams }: { searchParams?: { month?: string } }) {
  const session = await requireModuleAccess("accounting");
  if (session.user?.role !== "owner") redirect("/dashboard");

  const month = searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : currentMonth();
  const data = await loadAccountingOverview(month);

  const rows = data.branches.flatMap((branch) => {
    const activity = branchActivityOf(data, branch.id);
    const stats = branchMonthOf(data, branch.id, month);
    return activity && stats ? [{ branch, activity, stats }] : [];
  });

  // Branches that need attention first: not calculated at all, then calculated but with no
  // opening date of their own (the system is guessing), then the settled ones.
  const rank = (r: (typeof rows)[number]) =>
    r.stats.status !== "active" ? 0 : r.activity.missingOpenedAt ? 1 : 2;
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b) || a.branch.name.localeCompare(b.branch.name, "he"));

  const missingDate = rows.filter((r) => r.activity.missingOpenedAt).length;
  const notCalculated = rows.filter((r) => r.stats.status !== "active").length;

  // Read the branches directly rather than through the overview: that one drops deleted branches
  // on purpose, and this screen is exactly where a deleted branch has to stay visible so it can
  // be restored.
  const allSnap = await getAdminFirestore().collection("n_branches").get();
  const ownerName = await getOwnerName(session.user?.name);
  const managed: ManagedBranch[] = allSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => ["rentals", "computers", "coworking"].includes(b.branchType))
    .map((b) => {
      const stats = branchMonthOf(data, b.id, month);
      return {
        id: b.id,
        name: b.name,
        branchType: b.branchType,
        partnerName: b.partnerName?.trim() || null,
        partnerPct: 100 - branchOwnerPct(b),
        openedAt: b.openedAt?.trim() || b.founded?.trim() || null,
        deleted: b.deleted === true,
        income: stats?.income ?? 0,
        expense: stats?.expense ?? 0,
      };
    })
    .sort((a, b) => Number(a.deleted) - Number(b.deleted) || a.name.localeCompare(b.name, "he"));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <CalendarClock className="h-5 w-5" />
            ניהול סניפים
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            הוספה, מחיקה ושחזור של סניפים, וקביעת תאריך הפתיחה שממנו כל סניף נכנס לחישוב.
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/branches" />
      </div>

      <div className="mb-3.5">
        <ManageBranches branches={managed} ownerName={ownerName} />
      </div>

      {(missingDate > 0 || notCalculated > 0) && (
        <div className="mb-3 rounded-card border border-[#f0dcb8] bg-[#fdf3e3] px-4 py-3 text-[12.5px] font-bold leading-relaxed text-[#7a4a12]">
          {missingDate > 0 && <>ל-{missingDate} סניפים לא הוגדר תאריך פתיחה — עבורם המערכת מנחשת לפי הנתון הראשון שנמצא בהם. </>}
          {notCalculated > 0 && <>{notCalculated} סניפים לא נכנסים כרגע לחישוב של {mLabel(month)}.</>}
        </div>
      )}

      <section className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">כל הסניפים — {mLabel(month)}</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              כל שורה נשמרת בנפרד. אחרי שמירה הנתונים במסכי ההנה&quot;ח מתעדכנים מיד.
            </p>
          </div>
          <Link
            href={`/dashboard/accounting/overview?month=${month}`}
            className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-[13px] font-bold text-ink transition hover:border-teal hover:text-teal"
          >
            › חזרה לסקירה
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={`${TH} min-w-[170px] whitespace-normal`}>סניף</th>
                <th className={`${TH} min-w-[230px] whitespace-normal`}>מה המערכת מחשבת היום</th>
                <th className={`${TH} ${NUM}`}>הכנסות {mLabel(month)}</th>
                <th className={`${TH} ${NUM}`}>הוצאות {mLabel(month)}</th>
                <th className={`${TH} ${NUM}`}>להעביר אליי</th>
                <th className={`${TH} min-w-[300px] whitespace-normal`}>תאריך פתיחה / סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted">
                    אין סניפים פעילים
                  </td>
                </tr>
              )}
              {sorted.map(({ branch: b, activity, stats }, i) => {
                const inactive = stats.status !== "active";
                return (
                  <tr key={b.id} className={i % 2 ? "bg-[#fafbfd]" : ""}>
                    <td className={TD}>
                      <Link
                        href={`/dashboard/accounting/overview/${b.id}?month=${month}`}
                        className="font-extrabold text-ink hover:text-teal hover:underline"
                      >
                        {b.location ? `${b.location} — ` : ""}
                        {b.name}
                      </Link>
                      <div className="mt-0.5 text-[10.5px] text-muted">
                        {b.branchType === "rentals" ? "ניידים" : "חדר מחשבים"}
                        {branchHasPartner(b)
                          ? ` · ${branchPartnerLabel(b)} ${100 - branchOwnerPct(b)}%`
                          : " · 100% שלי"}
                      </div>
                      {activity.statusLabel && (
                        <span className="mt-1 inline-block rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[10.5px] font-extrabold text-[#7a4a12]">
                          {activity.statusLabel}
                        </span>
                      )}
                    </td>
                    <td className={`${TD} whitespace-normal text-[11.5px] text-muted`}>
                      {startExplanation(activity)}
                      {activity.noIncomeYet && !inactive && (
                        <>
                          <br />
                          <span className="text-[#a15c1b]">טרם נרשמו בסניף השכרות או הכנסות.</span>
                        </>
                      )}
                    </td>
                    <td className={`${TD} ${NUM} font-extrabold text-emerald-600`}>{money(stats.income)}</td>
                    <td className={`${TD} ${NUM} font-extrabold text-red-600`}>{money(stats.expense)}</td>
                    <td className={`${TD} ${NUM}`}>
                      {branchHasPartner(b) && !inactive ? (
                        <b className="text-teal-dark">{money(stats.transferToOwner)}</b>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className={TD}>
                      <form
                        action={saveBranchStatusAction.bind(null, b.id)}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input
                          type="date"
                          name="openedAt"
                          defaultValue={activity.openedDate?.slice(0, 10) ?? ""}
                          className={FIELD}
                        />
                        <label className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] font-bold text-ink">
                          <input
                            type="checkbox"
                            name="notStarted"
                            defaultChecked={activity.manuallyNotStarted}
                            className="h-4 w-4 accent-teal"
                          />
                          עדיין לא התחיל לפעול
                        </label>
                        <button
                          type="submit"
                          className="rounded-lg bg-teal px-3 py-1.5 text-[11.5px] font-extrabold text-white transition hover:bg-teal-dark"
                        >
                          שמירה
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-card-border px-4 py-3 text-[11.5px] leading-relaxed text-muted">
          <b className="text-ink">איך זה עובד:</b> חודשים שלפני תאריך הפתיחה לא מחושבים כלל — אפס הכנסות, אפס הוצאות
          ואפס העברה לבעלים. הסימון <b className="text-ink">&quot;עדיין לא התחיל לפעול&quot;</b> גובר על הכל, גם אם
          כבר הוזנו לסניף נתונים או רשומים בו מחשבים — כך שסניף שנפתח על הנייר בלבד לא מקבל שורות תעריפון (פרסום,
          סינון וגלישה) ולא נוצרת לו דרישת העברה. כשהסניף מתחיל לעבוד: מסירים את הסימון, קובעים תאריך פתיחה, ומאותו
          חודש החישוב רץ לבד לפי הלקוחות וההשכרות שמוזנים.
        </div>
      </section>
    </div>
  );
}
