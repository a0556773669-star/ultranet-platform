import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, ArrowLeft, Layers } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { branchMonthlyIncomeRows, loadComputerRoomAccounting, SHARED_EXPENSE_BRANCH_ID } from "@/lib/computer-room-accounting";
import { monthLabel } from "@/lib/branch-income-excel";
import { ClickableRow } from "@/components/clickable-row";
import { saveMonthlyBranchIncomeAction } from "./actions";
import { IncomeEntryPanel } from "./[id]/income-entry-panel";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const TH = "px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-2.5 py-2 whitespace-nowrap";

export default async function ComputerRoomsAccountingHomePage({
  searchParams,
}: {
  searchParams?: { month?: string; monthSaved?: string; monthCleared?: string };
}) {
  const session = await requireModuleAccess("computers");
  const isOwner = session.user?.role === "owner";
  const myBranchId = session.user?.branchId;

  if (!isOwner) {
    if (!myBranchId) redirect("/dashboard");
    redirect(`/dashboard/computer-rooms-accounting/${myBranchId}`);
  }

  const data = await loadComputerRoomAccounting();
  const rows = data.branches.flatMap((b) => {
    const s = data.statsByBranch.get(b.id);
    return s ? [{ branch: b, stats: s }] : [];
  });
  const totals = rows.reduce(
    (acc, { stats }) => ({
      setup: acc.setup + stats.setupCost,
      spent: acc.spent + stats.spentToDate,
      income: acc.income + stats.incomeToDate,
      profit: acc.profit + stats.profitHeld,
    }),
    { setup: 0, spent: 0, income: 0, profit: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <BarChart3 className="h-5 w-5" />
          הנה&quot;ח חדרי מחשבים — השקעה מול רווח
        </h1>
        <div className="flex items-center gap-2">
          {/* אותו טופס חודשי בדיוק שיש בעמוד הסניף: הוא ממילא מזין את כל הסניפים יחד, ולכן
              הוא שייך גם - ואולי בעיקר - למסך שממנו owner מתחיל. */}
          <IncomeEntryPanel
            saveMonthly={saveMonthlyBranchIncomeAction}
            branches={branchMonthlyIncomeRows(data)}
            defaultMonth={new Date().toISOString().slice(0, 7)}
            back="/dashboard/computer-rooms-accounting"
          />
          <Link
            href={`/dashboard/expenses/${SHARED_EXPENSE_BRANCH_ID}`}
            className="flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-2 text-xs font-bold text-ink transition hover:border-teal hover:text-teal"
          >
            <Layers className="h-4 w-4" />
            הוצאות משותפות
          </Link>
        </div>
      </div>
      <p className="text-xs text-muted">
        דשבורד מעקב פר-סניף: כמה עלתה הקמת כל סניף, כמה הוצאתי עליו עד היום (כולל הקמה), כמה
        נכנס עד היום, וכמה מהרווח עדיין מוחזק. עלות ההקמה נספרת גם בהנה&quot;ח הראשית (בסה&quot;כ
        הוצאות, כהוצאת בעלים במלואה), וכך גם ההוצאות המוצגות כאן (חלק הבעלים בלבד - ראו
        &quot;הוצאות&quot;). לעומת זאת ההכנסה החודשית שמוסיפים כאן היא שורה ידנית למעקב בלבד -
        לא נכתבת להנה&quot;ח הראשית ולא לדף הבית. ההכנסות כאן כוללות גם את המזומן שנמשך מקופת
        הסניף ונרשם בהנה&quot;ח הראשית תחת &quot;מזומן&quot; - הוא נקרא משם לתצוגה, נספר פעם
        אחת בלבד (בספר הראשי), ואין צורך להקליד אותו כאן שוב.
      </p>

      {searchParams?.monthSaved !== undefined && (
        <div className="rounded-card border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-700">
          נשמרו הכנסות {searchParams.month ? monthLabel(searchParams.month) : ""} ל-{searchParams.monthSaved} סניפים
          {Number(searchParams.monthCleared ?? 0) > 0 && `, ונוקו ${searchParams.monthCleared} סניפים`}.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">סה&quot;כ עלות הקמה</p>
          <p className="mt-1 text-xl font-black text-ink">{money(totals.setup)}</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">סה&quot;כ הוצאות עד היום</p>
          <p className="mt-1 text-xl font-black text-red-600">{money(totals.spent)}</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">סה&quot;כ הכנסות עד היום</p>
          <p className="mt-1 text-xl font-black text-emerald-600">{money(totals.income)}</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">רווח מוחזק</p>
          <p className={`mt-1 text-xl font-black ${totals.profit >= 0 ? "text-teal-dark" : "text-red-600"}`}>{money(totals.profit)}</p>
        </div>
      </div>

      {/* טבלה אחת במקום קובייה לכל סניף: השאלה כאן היא השוואה בין הסניפים ("מי מחזיר ומי לא"),
          והקוביות הכריחו לקרוא כל סניף בנפרד ולזכור את המספר של הקודם. בטבלה כל טור הוא אותו
          מספר בכל השורות, ושורת הסיכום למטה היא הסה"כ שהיה קודם בקוביות שמעל. */}
      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-right text-[13px]">
            <thead>
              <tr className="border-b border-card-border bg-[#f4f6f9]">
                <th className={TH}>סניף</th>
                <th className={TH}>עלות הקמה</th>
                <th className={TH}>הוצאות עד היום</th>
                <th className={TH}>הכנסות עד היום</th>
                <th className={TH}>רווח מוחזק</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2.5 py-6 text-center text-sm text-muted">
                    אין עדיין סניפי חדרי מחשבים
                  </td>
                </tr>
              )}
              {rows.map(({ branch, stats }, idx) => (
                <ClickableRow
                  key={branch.id}
                  href={`/dashboard/computer-rooms-accounting/${branch.id}`}
                  className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}
                >
                  <td className={`${TD} font-bold text-ink`}>
                    <Link href={`/dashboard/computer-rooms-accounting/${branch.id}`} className="hover:text-teal hover:underline">
                      {branch.name}
                    </Link>
                  </td>
                  <td className={`${TD} text-ink`}>{money(stats.setupCost)}</td>
                  <td className={`${TD} font-semibold text-red-600`}>{money(stats.spentToDate)}</td>
                  <td className={`${TD} font-semibold text-emerald-600`}>{money(stats.incomeToDate)}</td>
                  <td className={`${TD} font-bold ${stats.profitHeld >= 0 ? "text-teal-dark" : "text-red-600"}`}>
                    {money(stats.profitHeld)}
                  </td>
                  <td className={`${TD} text-left`}>
                    <Link
                      href={`/dashboard/computer-rooms-accounting/${branch.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-teal hover:underline"
                    >
                      פתיחה
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
