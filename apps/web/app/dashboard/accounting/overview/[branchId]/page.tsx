import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getOwnerName } from "@/lib/owner-name";
import {
  loadAccountingOverview,
  currentMonth,
  branchMonthOf,
  branchActivityOf,
  branchSeries,
  branchHasPartner,
  branchOwnerPct,
  branchPartnerLabel,
  monthLabelLong,
  type BranchMonth,
} from "@/lib/accounting-overview";
import { loadCostRates } from "@/lib/cost-rates";
import { AccountingTabs } from "../../accounting-tabs";
import { BranchCostSettings } from "../branch-cost-settings";
import { AddBranchExpense } from "../add-branch-expense";
import {
  BranchMiniCards,
  CostTable,
  FlowCard,
  KpiRow,
  ModeTabs,
  MonthPills,
  transferBasis,
  mLabel,
  money,
  nextMonthNum,
  signClass,
} from "../ui";

const MONTH_RE = /^\d{4}-\d{2}$/;
const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted whitespace-nowrap border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] whitespace-nowrap";
const NUM = "text-left tabular-nums";
const MINE = "bg-[rgba(26,138,118,0.07)] font-extrabold";
const SEP = "border-r border-card-border";

/** The month-by-month report for one branch, including what moves to the owner on the 1st. */
function BranchReport({
  series,
  month,
  cum,
  hasPartner,
  shareLabel,
  restricted,
  ownerName,
  modeTabs,
  branchName,
}: {
  series: BranchMonth[];
  month: string;
  cum: boolean;
  hasPartner: boolean;
  shareLabel: string;
  restricted: boolean;
  ownerName: string;
  modeTabs: JSX.Element;
  branchName: string;
}) {
  const share = (s: BranchMonth) =>
    restricted
      ? {
          income: s.income - s.ownerIncome,
          expense: s.expense - s.ownerExpense,
        }
      : { income: s.ownerIncome, expense: s.ownerExpense };

  const acc = { i: 0, e: 0, si: 0, se: 0, t: 0 };
  const body = series.map((s) => {
    const sh = share(s);
    acc.i += s.income;
    acc.e += s.expense;
    acc.si += sh.income;
    acc.se += sh.expense;
    acc.t += s.transferToOwner;
    const v = cum
      ? { income: acc.i, expense: acc.e, shareIncome: acc.si, shareExpense: acc.se, transfer: acc.t }
      : { income: s.income, expense: s.expense, shareIncome: sh.income, shareExpense: sh.expense, transfer: s.transferToOwner };
    return { month: s.month, v, isCurrent: s.month === month };
  });
  const T = { i: acc.i, e: acc.e, si: acc.si, se: acc.se, t: acc.t };

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">דוח הכנסות והוצאות — {branchName}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            &quot;{shareLabel}&quot; = החלק בהכנסה לפי אחוז הבעלות, פחות החלק שבאמת מוטל בהוצאה
          </p>
        </div>
        {modeTabs}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th rowSpan={2} className={TH}>
                חודש
              </th>
              <th colSpan={2} className={`${TH} bg-emerald-50 text-center text-[11px] text-emerald-600`}>
                הכנסות
              </th>
              <th colSpan={2} className={`${TH} bg-red-50 text-center text-[11px] text-red-600`}>
                הוצאות
              </th>
              <th colSpan={2} className={`${TH} bg-teal-bg text-center text-[11px] text-teal-dark`}>
                רווח
              </th>
              <th rowSpan={2} className={`${TH} ${NUM}`}>
                להעביר ל{ownerName} ב-1
              </th>
            </tr>
            <tr>
              <th className={`${TH} ${NUM}`}>הסניף</th>
              <th className={`${TH} ${NUM}`}>{shareLabel}</th>
              <th className={`${TH} ${NUM} ${SEP}`}>הסניף</th>
              <th className={`${TH} ${NUM}`}>{shareLabel}</th>
              <th className={`${TH} ${NUM} ${SEP}`}>הסניף</th>
              <th className={`${TH} ${NUM}`}>{shareLabel}</th>
            </tr>
          </thead>
          <tbody>
            {body.map((b) => {
              const profit = b.v.income - b.v.expense;
              const shareProfit = b.v.shareIncome - b.v.shareExpense;
              return (
                <tr key={b.month} className={b.isCurrent ? "bg-teal-bg" : ""}>
                  <td className={`${TD} font-extrabold`}>{mLabel(b.month)}</td>
                  <td className={`${TD} ${NUM}`}>{money(b.v.income)}</td>
                  <td className={`${TD} ${NUM} ${MINE}`}>{money(b.v.shareIncome)}</td>
                  <td className={`${TD} ${NUM} ${SEP}`}>{money(b.v.expense)}</td>
                  <td className={`${TD} ${NUM} ${MINE}`}>{money(b.v.shareExpense)}</td>
                  <td className={`${TD} ${NUM} ${SEP} ${signClass(profit)}`}>{money(profit)}</td>
                  <td className={`${TD} ${NUM} ${MINE} ${signClass(shareProfit)}`}>{money(shareProfit)}</td>
                  <td className={`${TD} ${NUM} ${SEP}`}>
                    {hasPartner ? (
                      <b className="text-teal-dark">{money(b.v.transfer)}</b>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-card-border bg-[#f4f6f9] font-black">
              <td className="px-2.5 py-2.5">סה&quot;כ התקופה</td>
              <td className={`px-2.5 py-2.5 ${NUM}`}>{money(T.i)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${MINE}`}>{money(T.si)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${SEP}`}>{money(T.e)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${MINE}`}>{money(T.se)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${SEP} ${signClass(T.i - T.e)}`}>{money(T.i - T.e)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${MINE} ${signClass(T.si - T.se)}`}>{money(T.si - T.se)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${SEP}`}>{hasPartner ? money(T.t) : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

export default async function BranchAccountingOverviewPage({
  params,
  searchParams,
}: {
  params: { branchId: string };
  searchParams?: { month?: string; mode?: string };
}) {
  const session = await requireModuleAccess("accounting");
  const isOwner = session.user?.role === "owner";
  const restricted = !isOwner;

  if (restricted && session.user?.branchId !== params.branchId) {
    redirect("/dashboard");
  }

  const month = searchParams?.month && MONTH_RE.test(searchParams.month) ? searchParams.month : currentMonth();
  const cum = searchParams?.mode === "cum";
  const modeSuffix = cum ? "&mode=cum" : "";

  const [data, ownerName, rateData] = await Promise.all([
    loadAccountingOverview(month),
    getOwnerName(isOwner ? session.user?.name : null),
    loadCostRates(),
  ]);

  const branch = data.branches.find((b) => b.id === params.branchId);
  if (!branch) notFound();

  const idx = data.months.indexOf(month);
  const stats = branchMonthOf(data, branch.id, month);
  const activity = branchActivityOf(data, branch.id);
  if (!stats || !activity) notFound();
  const prev = idx > 0 ? branchMonthOf(data, branch.id, data.months[idx - 1]!) : undefined;
  const series = branchSeries(data, branch.id).slice(0, idx + 1);

  const hasPartner = branchHasPartner(branch);
  const partnerName = branchPartnerLabel(branch);
  const shareLabel = restricted ? "חלקך" : "חלקי";
  const shareIncome = restricted ? stats.income - stats.ownerIncome : stats.ownerIncome;
  const shareExpense = restricted ? stats.expense - stats.ownerExpense : stats.ownerExpense;

  const monthly = stats.lines.filter((l) => l.kind === "monthly");
  const once = stats.lines.filter((l) => l.kind === "once");
  const investment = data.investmentByBranch.get(branch.id) ?? [];

  const entries = data.branches.flatMap((b) => {
    const s = branchMonthOf(data, b.id, month);
    const a = branchActivityOf(data, b.id);
    return s && a ? [{ branch: b, stats: s, activity: a }] : [];
  });

  // The branch-status screen is the canonical place for the opening date / "not started" mark -
  // it shows every branch side by side, which is how these actually get filled in.
  const branchStatusHref = `/dashboard/accounting/branches?month=${month}`;

  const selfHref = (m: string, mode?: string) =>
    `/dashboard/accounting/overview/${branch.id}?month=${m}${mode === "cum" ? "&mode=cum" : ""}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-extrabold text-ink">
            {branch.location ? `${branch.location} — ` : ""}
            {branch.name}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {branch.branchType === "rentals" ? "השכרות מחשבים ניידים" : "חדר מחשבים"}
            {hasPartner
              ? ` · שותף: ${partnerName} · חלוקה ${branchOwnerPct(branch)}/${100 - branchOwnerPct(branch)}`
              : " · בבעלות מלאה"}
            {activity.openedDate
              ? ` · תאריך פתיחה: ${activity.openedDate.slice(0, 10)}`
              : " · לא הוגדר תאריך פתיחה"}
          </p>
        </div>
        {isOwner ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href={`/dashboard/accounting/overview?month=${month}${modeSuffix}`}
              className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-[13px] font-bold text-ink transition hover:border-teal hover:text-teal"
            >
              › חזרה לסקירה הכללית
            </Link>
            <AccountingTabs active="/dashboard/accounting/overview" />
          </div>
        ) : null}
      </div>

      {restricted && (
        <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-card border border-[#f0dcb8] bg-[#fdf3e3] px-4 py-3 text-[12.5px] font-bold text-[#7a4a12]">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            מוצג הסניף שלך בלבד. אין גישה לסניפים אחרים, לספר ההנה&quot;ח האישי של {ownerName}, לסיכומי העסק,
            לתעריפון או למסלולי הגבייה.
          </span>
        </div>
      )}

      {stats.status !== "active" && (
        <div className="mb-3 rounded-card border border-[#f0dcb8] bg-[#fdf3e3] px-4 py-3 text-[12.5px] font-bold leading-relaxed text-[#7a4a12]">
          {stats.status === "before_open" ? (
            <>
              הסניף נפתח ב-{monthLabelLong(activity.openedMonth ?? activity.startMonth ?? month)} — לחודש{" "}
              {mLabel(month)} אין חישוב הכנסות והוצאות, ואין העברה לבעלים.
            </>
          ) : activity.manuallyNotStarted ? (
            <>
              הסניף מסומן <b>&quot;עדיין לא התחיל לפעול&quot;</b> — לכן הוא לא נכנס לשום חישוב: אין לו הוצאות תעריפון
              (פרסום, סינון וגלישה וכו&apos;), אין לו הכנסות ואין מה להעביר לבעלים, גם אם כבר הוזנו אליו נתונים. כדי
              להפעיל אותו — יש להוריד את הסימון ולקבוע תאריך פתיחה.
            </>
          ) : (
            <>
              {branch.branchType === "rentals" ? "הסניף עדיין לא התחיל השכרות" : "הסניף עדיין לא התחיל לפעול"} — לא
              הוגדר לו תאריך פתיחה ואין בו אף לקוח, השכרה, הכנסה או הוצאה. לכן אין לו הוצאות תעריפון (פרסום, סינון
              וגלישה וכו&apos;) ואין מה להעביר לבעלים. ברגע שיוזנו לקוחות והשכרות — או שיוגדר תאריך פתיחה — החישוב
              יתחיל אוטומטית מאותו חודש.
            </>
          )}
          {!restricted && (
            <>
              {" "}
              <Link href={branchStatusHref} className="underline">
                לקביעת תאריך פתיחה וסטטוס הסניפים
              </Link>
            </>
          )}
        </div>
      )}

      {stats.status === "active" && activity.missingOpenedAt && !restricted && (
        <div className="mb-3 rounded-card border border-card-border bg-[#f4f6f9] px-4 py-2.5 text-[12.5px] font-bold text-muted">
          לא הוגדר תאריך פתיחה לסניף. כרגע החישוב מתחיל מ-
          {monthLabelLong(activity.startMonth ?? month)} — החודש הראשון שיש בו נתון.{" "}
          <Link href={branchStatusHref} className="text-teal-dark underline">
            לקביעת תאריך פתיחה מדויק
          </Link>
        </div>
      )}

      {activity.noIncomeYet && stats.status === "active" && (
        <div className="mb-3 rounded-card border border-[#f0dcb8] bg-[#fdf3e3] px-4 py-2.5 text-[12.5px] font-bold text-[#7a4a12]">
          {branch.branchType === "rentals" ? "לא התחיל השכרות" : "עדיין אין הכנסות"} — הסניף פתוח, אך טרם נרשמו בו
          השכרות או הכנסות. ההוצאות למטה כן נספרות מתאריך הפתיחה; ההכנסות יופיעו ברגע שיוזנו לקוחות והשכרות.
        </div>
      )}

      <div className="mb-3">
        <MonthPills months={data.months} current={month} hrefFor={(m) => selfHref(m, cum ? "cum" : undefined)} />
      </div>

      <KpiRow
        cards={[
          {
            label: `הכנסות הסניף ${mLabel(month)}`,
            value: stats.income,
            prev: prev?.income,
            color: "#059669",
            rail: "#059669",
            footLabel: shareLabel,
            foot: shareIncome,
          },
          {
            label: `הוצאות הסניף ${mLabel(month)}`,
            value: stats.expense,
            prev: prev?.expense,
            color: "#dc2626",
            rail: "#dc2626",
            footLabel: shareLabel,
            foot: shareExpense,
          },
          {
            label: `רווח הסניף ${mLabel(month)}`,
            value: stats.profit,
            prev: prev?.profit,
            color: stats.profit >= 0 ? "#0f6e56" : "#dc2626",
            rail: "#1a8a76",
            footLabel: shareLabel,
            foot: shareIncome - shareExpense,
          },
        ]}
      />

      {hasPartner && stats.status !== "active" ? (
        <section className={`${CARD} px-4 py-3.5`}>
          <h3 className="text-[13px] font-extrabold text-ink">אין העברה בגין {mLabel(month)}</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">{transferBasis(stats, activity)}.</p>
        </section>
      ) : hasPartner ? (
        <section className="flex flex-wrap items-center justify-between gap-3.5 rounded-card border border-[#bfe0d8] bg-gradient-to-b from-white to-[#f6fbfa] px-4 py-3.5 shadow-card">
          <div>
            <h3 className="text-[13px] font-extrabold text-teal-dark">
              להעברה ל{ownerName} ב-1/{nextMonthNum(month)} — בגין {mLabel(month)}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold text-muted">
              <span>
                {restricted ? `חלקו של ${ownerName}` : "חלקי"} בהכנסות ({branchOwnerPct(branch)}%):{" "}
                <b className="tabular-nums text-ink">{money(stats.transferIncomePart)}</b>
              </span>
              <span>+</span>
              <span>
                קיזוז הוצאות:{" "}
                <b className="tabular-nums text-ink">
                  {stats.expenseNet >= 0 ? money(stats.expenseNet) : `־${money(-stats.expenseNet)}`}
                </b>
              </span>
              <span>=</span>
            </div>
            <p className="mt-1.5 text-[12.5px] text-muted">
              {partnerName} מחזיק את מזומן ההשכרות. הקיזוז מקטין או מגדיל את ההעברה לפי מי שילם בפועל על ההוצאות.
            </p>
            <p className="mt-1 text-[11.5px] font-bold text-muted">על סמך: {transferBasis(stats, activity)}</p>
          </div>
          <div className="text-left">
            <div className="text-[26px] font-black tabular-nums text-teal-dark">{money(stats.transferToOwner)}</div>
            <div className="text-[12.5px] text-muted">
              מ{partnerName} ל{ownerName}
            </div>
          </div>
        </section>
      ) : (
        <section className={`${CARD} px-4 py-3.5`}>
          <h3 className="text-[13px] font-extrabold text-ink">אין העברה חודשית</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {branch.name} בבעלות מלאה — כל ההכנסה וכל ההוצאה נזקפות לבעלים.
          </p>
        </section>
      )}

      <div className="mt-3.5 grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3.5">
          <BranchReport
            series={series}
            month={month}
            cum={cum}
            hasPartner={hasPartner}
            shareLabel={shareLabel}
            restricted={restricted}
            ownerName={ownerName}
            branchName={branch.name}
            modeTabs={<ModeTabs cum={cum} monthlyHref={selfHref(month)} cumHref={selfHref(month, "cum")} />}
          />

          <AddBranchExpense branch={branch} ownerName={ownerName} restricted={restricted} />

          <CostTable
            title={`פירוט הוצאות ${mLabel(month)}`}
            subtitle="כל שורה מחושבת לפי התעריפון והכמויות בסניף, או לפי הוצאה שהוזנה ידנית — כולל מי שילם בפועל וכמה נשאר לכל צד"
            lines={monthly.concat(once)}
            branch={branch}
            ownerName={ownerName}
          />

          {stats.suppressed.length > 0 && (
            <section className={`${CARD} px-4 py-3.5`}>
              <h3 className="text-[13px] font-extrabold text-ink">שורות תעריפון שלא נספרו החודש</h3>
              <p className="mt-0.5 text-[12.5px] text-muted">
                כדי שלא ייספר פעמיים: כשקיימת בסניף הוצאה שהוזנה ידנית על אותו נושא, ההוצאה הידנית היא שנספרת,
                ושורת התעריפון מושמטת.
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {stats.suppressed.map((s) => (
                  <li key={s.rateLabel} className="text-[12.5px] text-muted">
                    <b className="text-ink">{s.rateLabel}</b> — {s.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!restricted && (
            <BranchCostSettings
              branch={branch}
              rates={rateData.rates}
              settings={rateData.settingsByBranchRate}
              autoQty={data.autoQtyByBranch.get(branch.id) ?? new Map()}
            />
          )}

          {!restricted && (
            <CostTable
              title="השקעה חד-פעמית — מצטבר מאז פתיחת הסניף"
              subtitle="רכישות ציוד לפי הכמויות הרשומות בסניף. לא נספרות ברווח החודשי — רק בחודש שבו נרכשו"
              lines={investment}
              branch={branch}
              ownerName={ownerName}
            />
          )}
        </div>

        <div className="flex flex-col gap-3.5">
          <FlowCard
            title={`תזרים — ${branch.name}`}
            series={series.map((s) => ({ month: s.month, income: s.income, expense: s.expense }))}
            cumValues={series.map((s) => s.profit)}
            cumLabel="יתרה מצטברת של הסניף"
            footLeftLabel={`יתרה מצטברת עד ${mLabel(month)}`}
            footLeftValue={series.reduce((sum, s) => sum + s.profit, 0)}
            footRightLabel="רווח החודש"
            footRightValue={stats.profit}
          />
          {!restricted && (
            <BranchMiniCards
              month={month}
              entries={entries}
              hrefFor={(id) => `/dashboard/accounting/overview/${id}?month=${month}${modeSuffix}`}
              activeId={branch.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
