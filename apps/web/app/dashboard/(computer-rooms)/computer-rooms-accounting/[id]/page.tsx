import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, ArrowLeft, Banknote, FileSpreadsheet, ChevronDown } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { loadComputerRoomAccounting, SHARED_EXPENSE_BRANCH_ID, type RoomIncomeLine } from "@/lib/computer-room-accounting";
import { isBranchIncomeImportEnabled, monthLabel } from "@/lib/branch-income-excel";
import {
  addBranchIncomeAction,
  clearImportedBranchIncomeAction,
  deleteBranchIncomeAction,
  importBranchIncomeAction,
} from "../actions";
import { SetupCostCard } from "./setup-cost-card";
import { IncomeEntryPanel } from "./income-entry-panel";
import { MonthlyFlowChart } from "./monthly-flow-chart";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const TH = "px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted";
const TD = "px-2 py-1.5 align-top";

/** סיכום חודש אחד - התשובה ל"כמה נכנס באוקטובר", בלי לקרוא שורה-שורה */
interface MonthSummary {
  month: string;
  total: number;
  rows: number;
  hasCash: boolean;
}

function summarizeByMonth(lines: RoomIncomeLine[]): MonthSummary[] {
  const byMonth = new Map<string, MonthSummary>();
  for (const line of lines) {
    const month = line.month || line.date.slice(0, 7);
    if (!month) continue;
    const entry = byMonth.get(month) ?? { month, total: 0, rows: 0, hasCash: false };
    entry.total += line.amount;
    entry.rows++;
    if (line.source === "main-cash") entry.hasCash = true;
    byMonth.set(month, entry);
  }
  return [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
}

/** קובייה קטנה בשורת תמונת המצב. גובה אחיד לכולן, בלי פירוט בתוכן - הפירוט חי בטורים
 *  שמתחת ובחלון של עלות ההקמה. */
function StatCard({ label, value, tone, note }: { label: string; value: string; tone: string; note?: string }) {
  return (
    <div className="rounded-card border border-card-border bg-white px-3 py-2.5 text-center shadow-card">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-black leading-tight ${tone}`}>{value}</p>
      {note && <p className="mt-0.5 truncate text-[10px] text-muted">{note}</p>}
    </div>
  );
}

/** טור מתקפל אחד מתוך השלושה. סגור כברירת מחדל: העמוד נפתח על תמונת מצב, והפירוט נפתח
 *  רק כשבאמת שואלים עליו - וכשנפתח הוא נשאר בתוך השליש שלו ולא דוחף את השאר. */
function Panel({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group overflow-hidden rounded-card border border-card-border bg-white shadow-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5">
        <span className="flex items-center gap-1.5 text-[13px] font-bold text-ink">
          <ChevronDown className="h-3.5 w-3.5 text-muted transition group-open:rotate-180" />
          {title}
        </span>
        {badge && <span className="rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10.5px] font-bold text-ink">{badge}</span>}
      </summary>
      <div className="border-t border-card-border px-3.5 py-3">{children}</div>
    </details>
  );
}

export default async function ComputerRoomBranchAccountingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { importError?: string; imported?: string; replaced?: string; skipped?: string; note?: string | string[]; noteMore?: string; cleared?: string };
}) {
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
  const monthly = summarizeByMonth(incomes);
  const addIncome = addBranchIncomeAction.bind(null, params.id);
  const importIncome = importBranchIncomeAction.bind(null, params.id);
  const clearImported = clearImportedBranchIncomeAction.bind(null, params.id);
  const todayStr = new Date().toISOString().slice(0, 10);
  // הייבוא הוא כלי זמני למילוי היסטוריה; כשמכבים אותו בסביבה כל האזור נעלם מהמסך.
  const importEnabled = canAdd && isBranchIncomeImportEnabled();
  const notes = searchParams?.note ? (Array.isArray(searchParams.note) ? searchParams.note : [searchParams.note]) : [];
  const incomeNote =
    stats.cashIncomeToDate > 0 && stats.manualIncomeToDate > 0
      ? `מזומן ${money(stats.cashIncomeToDate)} · ידני ${money(stats.manualIncomeToDate)}`
      : stats.cashIncomeToDate > 0
        ? "הכל מזומן מהקופה"
        : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
          <BarChart3 className="h-5 w-5" />
          הנה&quot;ח — {stats.branch.name}
        </h1>
        <div className="flex items-center gap-3">
          {canAdd && (
            <IncomeEntryPanel
              addIncome={addIncome}
              importIncome={importIncome}
              clearImported={clearImported}
              importEnabled={importEnabled}
              importedRows={stats.importedIncomeRows}
              canClearImported={isOwner}
              templateHref={`/api/computer-rooms-accounting/${params.id}/income-template`}
              today={todayStr}
            />
          )}
          {isOwner && (
            <Link href="/dashboard/computer-rooms-accounting" className="flex items-center gap-1.5 text-xs font-bold text-teal hover:underline">
              <ArrowLeft className="h-4 w-4" />
              בחירת סניף אחר
            </Link>
          )}
        </div>
      </div>

      {/* תמונת המצב: ארבעה מספרים בגובה אחיד. הפירוט של ההקמה עבר לחלון שנפתח מהקובייה -
          קודם הוא ישב בתוכה ומתח את כל השורה לגובה של סניף עם עשר שורות הקמה. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <SetupCostCard amount={stats.setupCost} items={stats.setupBreakdown} fromAssets={stats.setupFromAssets} />
        <StatCard label="הוצאות עד היום" value={money(stats.spentToDate)} tone="text-red-600" note="כולל הקמה" />
        <StatCard label="הכנסות עד היום" value={money(stats.incomeToDate)} tone="text-emerald-600" note={incomeNote} />
        <StatCard
          label="רווח מוחזק"
          value={money(stats.profitHeld)}
          tone={stats.profitHeld >= 0 ? "text-teal-dark" : "text-red-600"}
        />
      </div>

      {/* הודעות הייבוא יושבות מיד מתחת למספרים: זה המקום שאליו מסתכלים אחרי העלאת קובץ,
          כדי לראות אם ההכנסות באמת זזו. */}
      {searchParams?.importError === "missing" && (
        <div className="rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          יש לבחור קובץ אקסל לפני לחיצה על ייבוא.
        </div>
      )}
      {searchParams?.importError === "disabled" && (
        <div className="rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          ייבוא ההכנסות כבר אינו פעיל במערכת.
        </div>
      )}
      {searchParams?.cleared !== undefined && (
        <div className="rounded-card border border-card-border bg-[#f4f6f9] p-3 text-sm font-semibold text-ink">
          נמחקו {searchParams.cleared} שורות שיובאו מקובץ. שורות שהוקלדו ידנית לא נגעו.
        </div>
      )}
      {searchParams?.imported !== undefined && (
        <div className="rounded-card border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-700">
          <div>
            הייבוא הסתיים: נקלטו {searchParams.imported} חודשים
            {Number(searchParams.replaced ?? 0) > 0 && ` (${searchParams.replaced} מהם החליפו ייבוא קודם של אותו חודש)`}
            {Number(searchParams.skipped ?? 0) > 0 && `, דולגו ${searchParams.skipped} שורות`}.
          </div>
          {notes.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs font-normal text-teal-800">
              {notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
              {searchParams.noteMore && <li>ועוד {searchParams.noteMore} הערות דומות</li>}
            </ul>
          )}
        </div>
      )}

      <MonthlyFlowChart flow={stats.monthlyFlow} />

      {/* שלושה טורים סגורים. כל אחד נפתח בתוך עצמו ולא דוחף את שכניו - את המקום שהם תפסו
          כשישבו זה מתחת לזה, ואת ה"בלאגן" שהיה בעמוד כשכולם היו פתוחים בבת אחת. */}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
        {/* "מאיפה המספר הזה" - השאלה שנשאלה על המסך הזה יותר מכל שאלה אחרת. הסכום הגדול הוא
            חישוב חי ולא נתון שמור, והשורה שהכי מפתיעה בו היא הוצאה קבועה, שמכפילה את עצמה
            בכל חודש שעובר בלי שנוגעים בה. לכן כל שורה מציגה גם את החשבון שהביא אליה. */}
        <Panel title="ממה מורכבות ההוצאות" badge={money(stats.spentToDate)}>
          <table className="w-full border-collapse text-right text-[12.5px]">
            <thead>
              <tr className="border-b border-card-border">
                <th className={`${TH} text-right`}>שורה</th>
                <th className={`${TH} text-left`}>סכום</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-b border-card-border">
                <td className={TD}>
                  <span className="block font-bold text-ink">עלות הקמה</span>
                  <span className="block text-[10.5px] leading-tight text-muted">
                    {stats.setupFromAssets ? "נקרא משכבת הנכסים (רכישות אמיתיות)" : "מהשדה בטופס הסניף"}
                  </span>
                </td>
                <td className={`${TD} text-left font-bold text-ink`}>{money(stats.setupCost)}</td>
              </tr>
              {stats.expenseLines.map((line, idx) => (
                <tr key={idx} className={`border-b border-card-border last:border-b-0 ${idx % 2 === 1 ? "bg-[#fafbfc]" : ""}`}>
                  <td className={TD}>
                    <span className="block font-bold text-ink">{line.label}</span>
                    <span className="block text-[10.5px] leading-tight text-muted">{line.detail}</span>
                  </td>
                  <td className={`${TD} text-left font-bold text-ink`}>{money(line.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-card-border tabular-nums">
                <td className={`${TD} font-black text-ink`}>סה&quot;כ</td>
                <td className={`${TD} text-left font-black text-red-600`}>{money(stats.spentToDate)}</td>
              </tr>
            </tfoot>
          </table>

          {stats.expenseLines.length === 0 && (
            <p className="mt-2 text-[11px] text-muted">אין הוצאות שוטפות רשומות על הסניף — הסכום כולו הקמה.</p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-muted">
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
        </Panel>

        {/* הכנסות לפי חודש - חודש אחד בשורה אחת. זו התמונה שמחפשים כאן ("איפה הסניף אוחז"),
            והיא זו שמילוי ההיסטוריה מהקובץ בונה. הפירוט שורה-שורה נשאר בטור שלצידו. */}
        <Panel title="הכנסות לפי חודש" badge={`${monthly.length} חודשים`}>
          {monthly.length === 0 ? (
            <p className="py-3 text-center text-[12.5px] text-muted">אין עדיין הכנסות רשומות</p>
          ) : (
            <table className="w-full border-collapse text-right text-[12.5px]">
              <thead>
                <tr className="border-b border-card-border">
                  <th className={`${TH} text-right`}>חודש</th>
                  <th className={`${TH} text-left`}>סכום</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {monthly.map((m, idx) => (
                  <tr key={m.month} className={`border-b border-card-border last:border-b-0 ${idx % 2 === 1 ? "bg-[#fafbfc]" : ""}`}>
                    <td className={TD}>
                      <span className="font-bold text-ink">{monthLabel(m.month)}</span>
                      {m.rows > 1 && <span className="mr-1.5 text-[10.5px] text-muted">{m.rows} שורות</span>}
                      {m.hasCash && (
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-muted">
                          <Banknote className="h-3 w-3" />
                          כולל מזומן מהקופה
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-left font-extrabold text-emerald-600`}>{money(m.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-card-border tabular-nums">
                  <td className={`${TD} font-black text-ink`}>סה&quot;כ</td>
                  <td className={`${TD} text-left font-black text-emerald-600`}>{money(stats.incomeToDate)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </Panel>

        <Panel title="שורות הכנסה" badge={String(incomes.length)}>
          {incomes.length === 0 ? (
            <p className="py-3 text-center text-[12.5px] text-muted">אין עדיין שורות הכנסה</p>
          ) : (
            <table className="w-full border-collapse text-right text-[12.5px]">
              <thead>
                <tr className="border-b border-card-border">
                  <th className={`${TH} text-right`}>שורה</th>
                  <th className={`${TH} text-left`}>סכום</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {incomes.map((i, idx) => {
                  const fromMain = i.source === "main-cash";
                  // מוחקים כל שורה במקום שבו היא נרשמה: שורת מזומן חיה בספר הראשי, ומחיקה
                  // ממנה כאן הייתה משנה את הספר הראשי ממסך שמוגדר כמעקב בלבד.
                  const bound = isOwner && !fromMain ? deleteBranchIncomeAction.bind(null, i.id, params.id) : null;
                  return (
                    <tr
                      key={`${i.source}-${i.id}`}
                      className={`border-b border-card-border last:border-b-0 ${idx % 2 === 1 ? "bg-[#fafbfc]" : ""}`}
                    >
                      <td className={TD}>
                        <span className="block font-bold text-ink">{i.desc}</span>
                        <span className="block text-[10.5px] text-muted">{i.date}</span>
                        {fromMain && (
                          <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-muted">
                            <Banknote className="h-3 w-3" />
                            מזומן מהקופה · נספר בספר הראשי
                          </span>
                        )}
                        {i.imported && (
                          <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-muted">
                            <FileSpreadsheet className="h-3 w-3" />
                            מייבוא קובץ
                          </span>
                        )}
                      </td>
                      <td className={`${TD} text-left font-extrabold text-emerald-600`}>{money(i.amount)}</td>
                      <td className={`${TD} text-left`}>
                        {bound && (
                          <form action={bound}>
                            <button
                              type="submit"
                              className="rounded-lg border border-red-200 px-2 py-0.5 text-[10.5px] font-medium text-red-600 transition hover:bg-red-50"
                            >
                              מחיקה
                            </button>
                          </form>
                        )}
                        {fromMain && isOwner && (
                          <Link href="/dashboard/accounting" className="text-[10.5px] font-bold text-teal hover:underline">
                            לספר הראשי
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
