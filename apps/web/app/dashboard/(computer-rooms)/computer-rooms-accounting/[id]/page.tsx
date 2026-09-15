import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, ArrowLeft, Plus, Banknote } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { loadComputerRoomAccounting, SHARED_EXPENSE_BRANCH_ID } from "@/lib/computer-room-accounting";
import { addBranchIncomeAction, deleteBranchIncomeAction } from "../actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const FIELD = "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export default async function ComputerRoomBranchAccountingPage({ params }: { params: { id: string } }) {
  const session = await requireModuleAccess("computers");
  const isOwner = session.user?.role === "owner";
  const myBranchId = session.user?.branchId;
  if (!isOwner && params.id !== myBranchId) redirect("/dashboard/computer-rooms-accounting");

  const data = await loadComputerRoomAccounting();
  const stats = data.statsByBranch.get(params.id);
  if (!stats) notFound();

  const canAdd = isOwner || (stats.branch.isMine === false && params.id === myBranchId);
  // כבר ממוינות מהחדשה לישנה, ומכילות גם את המזומן שנמשך מהקופה ונרשם בהנה"ח הראשית.
  const incomes = data.incomeLinesByBranch.get(params.id) ?? [];
  const addIncome = addBranchIncomeAction.bind(null, params.id);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
          <BarChart3 className="h-5 w-5" />
          הנה&quot;ח — {stats.branch.name}
        </h1>
        {isOwner && (
          <Link href="/dashboard/computer-rooms-accounting" className="flex items-center gap-1.5 text-xs font-bold text-teal hover:underline">
            <ArrowLeft className="h-4 w-4" />
            בחירת סניף אחר
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-card border border-card-border bg-white p-4 text-center shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">עלות הקמה</p>
          <p className="mt-1 text-xl font-black text-ink">{money(stats.setupCost)}</p>
          {/* הפירוט מוצג רק כשהמספר באמת הגיע ממנו - כשההשקעה נקראה משכבת הנכסים
              (setupFromAssets) השורות כאן כבר לא מסבירות את הסכום שמעליהן. */}
          {!stats.setupFromAssets && (stats.branch.setupItems?.length ?? 0) > 0 && (
            <ul className="mt-2 flex flex-col gap-1 border-t border-card-border pt-2 text-right">
              {stats.branch.setupItems!.map((item, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="text-muted">{item.label || "ללא תיאור"}</span>
                  <span className="font-bold text-ink">{money(item.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 text-center shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">הוצאות עד היום (כולל הקמה)</p>
          <p className="mt-1 text-xl font-black text-red-600">{money(stats.spentToDate)}</p>
          <p className="mt-1 text-[11px] text-muted">ראה פירוט מלא למטה</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 text-center shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">הכנסות עד היום</p>
          <p className="mt-1 text-xl font-black text-emerald-600">{money(stats.incomeToDate)}</p>
          {/* הפירוט מוצג רק כששני המקורות קיימים - אחרת הוא חוזר על המספר שמעליו. */}
          {stats.cashIncomeToDate > 0 && stats.manualIncomeToDate > 0 && (
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              מזומן מהקופה {money(stats.cashIncomeToDate)} · מעקב ידני {money(stats.manualIncomeToDate)}
            </p>
          )}
          {stats.cashIncomeToDate > 0 && stats.manualIncomeToDate === 0 && (
            <p className="mt-1 text-[11px] text-muted">הכל מזומן מהקופה</p>
          )}
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 text-center shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">רווח מוחזק</p>
          <p className={`mt-1 text-xl font-black ${stats.profitHeld >= 0 ? "text-teal-dark" : "text-red-600"}`}>{money(stats.profitHeld)}</p>
        </div>
      </div>

      {/* "מאיפה המספר הזה" - השאלה שנשאלה על המסך הזה יותר מכל שאלה אחרת. הסכום הגדול הוא
          חישוב חי ולא נתון שמור, והשורה שהכי מפתיעה בו היא הוצאה קבועה, שמכפילה את עצמה
          בכל חודש שעובר בלי שנוגעים בה. לכן כל שורה מציגה גם את החשבון שהביא אליה. */}
      <details className="rounded-card border border-card-border bg-white p-4 shadow-card" open>
        <summary className="cursor-pointer text-sm font-bold text-ink">
          ממה מורכבות ההוצאות עד היום ({money(stats.spentToDate)})
        </summary>

        <ul className="mt-3 flex flex-col divide-y divide-card-border">
          <li className="flex items-start justify-between gap-3 py-2">
            <span>
              <span className="block text-[13px] font-bold text-ink">עלות הקמה</span>
              <span className="block text-[11.5px] text-muted">
                {stats.setupFromAssets ? "נקרא משכבת הנכסים (רכישות אמיתיות)" : "מהשדה בטופס הסניף"}
              </span>
            </span>
            <span className="shrink-0 text-[13px] font-bold text-ink">{money(stats.setupCost)}</span>
          </li>

          {stats.expenseLines.map((line, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3 py-2">
              <span>
                <span className="block text-[13px] font-bold text-ink">{line.label}</span>
                <span className="block text-[11.5px] text-muted">{line.detail}</span>
              </span>
              <span className="shrink-0 text-[13px] font-bold text-ink">{money(line.amount)}</span>
            </li>
          ))}
        </ul>

        {stats.expenseLines.length === 0 && (
          <p className="mt-2 text-xs text-muted">אין הוצאות שוטפות רשומות על הסניף — הסכום כולו הקמה.</p>
        )}

        <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
          הוצאה קבועה נצברת מחדש בכל חודש שעובר, גם בלי לגעת בה. כדי לעצור צבירה של הוצאה
          שנגמרה השתמש ב<b>&quot;סיום&quot;</b> עם תאריך (ההיסטוריה נשמרת), ולא במחיקה — מחיקה
          מוציאה את השורה מכל החודשים למפרע.{" "}
          <Link href={`/dashboard/expenses/${stats.branch.id}`} className="font-bold text-teal hover:underline">
            לניהול ומחיקת ההוצאות של הסניף
          </Link>
          {" · "}
          <Link href={`/dashboard/expenses/${SHARED_EXPENSE_BRANCH_ID}`} className="font-bold text-teal hover:underline">
            להוצאות שעל כל הסניפים
          </Link>
          {" — שם אפשר גם לבחור על אילו סניפים כל הוצאה משותפת חלה."}
        </p>
      </details>

      {canAdd && (
        <form action={addIncome} className="flex flex-wrap items-end gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card">
          {/* מכוון: אין כאן אמצעי תשלום ואין "מזומן". השורות כאן הן אינדיקציה בלבד - כמה
              הסניף הזה מחזיר לי - ולא כסף שנספר פעם שנייה. מזומן אמיתי שנמשך מהקופה נרשם
              פעם אחת בלבד, בהנה"ח הראשית, עם הקופה שממנה נמשך. */}
          <p className="w-full text-[11px] leading-relaxed text-muted">
            שורות מעקב בלבד — לא נכנסות להנה&quot;ח הראשית. <b>אין צורך להזין כאן מזומן</b>:
            מזומן שנמשך מהקופה נרשם פעם אחת בהנה&quot;ח הראשית תחת &quot;מזומן&quot; (שם בוחרים
            מאיזו קופה), ומופיע כאן אוטומטית ברשימה שלמטה.
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">תאריך</label>
            <input type="date" name="date" defaultValue={todayStr} required className={FIELD} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">תיאור (לא חובה)</label>
            <input name="desc" placeholder="הכנסת חודש" className={FIELD} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">סכום</label>
            <input type="number" name="amount" min={0} required className={FIELD} />
          </div>
          <button type="submit" className="flex items-center gap-1.5 self-end rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90">
            <Plus className="h-4 w-4" />
            הוספת הכנסת חודש
          </button>
        </form>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
          <span>שורות הכנסה</span>
          <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{incomes.length}</span>
        </div>
        <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
          {incomes.length === 0 && <p className="py-6 text-center text-sm text-muted">אין עדיין שורות הכנסה</p>}
          {incomes.map((i) => {
            const fromMain = i.source === "main-cash";
            // מוחקים כל שורה במקום שבו היא נרשמה: שורת מזומן חיה בספר הראשי, ומחיקה
            // ממנה כאן הייתה משנה את הספר הראשי ממסך שמוגדר כמעקב בלבד.
            const bound = isOwner && !fromMain ? deleteBranchIncomeAction.bind(null, i.id, params.id) : null;
            return (
              <div key={`${i.source}-${i.id}`} className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 font-bold text-ink">
                    {i.desc}
                    {fromMain && (
                      <span className="flex items-center gap-1 rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10px] font-bold text-muted">
                        <Banknote className="h-3 w-3" />
                        מזומן מהקופה · מההנה&quot;ח הראשית
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {i.date}
                    {fromMain && " · נספר פעם אחת בספר הראשי, כאן לתצוגה בלבד"}
                  </div>
                </div>
                <div className="min-w-[75px] text-left font-extrabold text-emerald-600">{i.amount.toLocaleString()} ₪</div>
                {bound && (
                  <form action={bound}>
                    <button type="submit" className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50">
                      מחיקה
                    </button>
                  </form>
                )}
                {fromMain && isOwner && (
                  <Link href="/dashboard/accounting" className="shrink-0 text-[11px] font-bold text-teal hover:underline">
                    לספר הראשי
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
