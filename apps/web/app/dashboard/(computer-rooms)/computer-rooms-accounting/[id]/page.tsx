import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, ArrowLeft, Plus, Banknote, FileSpreadsheet, Upload, Download, Trash2 } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { loadComputerRoomAccounting, SHARED_EXPENSE_BRANCH_ID, type RoomIncomeLine } from "@/lib/computer-room-accounting";
import { isBranchIncomeImportEnabled, monthLabel } from "@/lib/branch-income-excel";
import {
  addBranchIncomeAction,
  clearImportedBranchIncomeAction,
  deleteBranchIncomeAction,
  importBranchIncomeAction,
} from "../actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const FIELD = "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

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

      {/* הכנסות לפי חודש - חודש אחד בשורה אחת. זו התמונה שמחפשים כאן ("איפה הסניף אוחז"),
          והיא זו שמילוי ההיסטוריה מהקובץ בונה. הפירוט שורה-שורה נשאר מתחת, למי שצריך אותו. */}
      {monthly.length > 0 && (
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink">הכנסות לפי חודש</h2>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-xs font-bold text-ink">{monthly.length} חודשים</span>
          </div>
          <ul className="flex flex-col divide-y divide-card-border">
            {monthly.map((m) => (
              <li key={m.month} className="flex items-center justify-between gap-3 py-2">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-bold text-ink">{monthLabel(m.month)}</span>
                  {m.rows > 1 && <span className="text-[11px] text-muted">{m.rows} שורות</span>}
                  {m.hasCash && (
                    <span className="flex items-center gap-1 rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10px] font-bold text-muted">
                      <Banknote className="h-3 w-3" />
                      כולל מזומן מהקופה
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[13px] font-extrabold text-emerald-600">{money(m.total)}</span>
              </li>
            ))}
          </ul>
        </div>
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
                    {i.imported && (
                      <span className="flex items-center gap-1 rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10px] font-bold text-muted">
                        <FileSpreadsheet className="h-3 w-3" />
                        מייבוא קובץ
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

      {/* טופס ההזנה וכלי הייבוא יושבים בסוף העמוד ומקופלים כברירת מחדל. קודם הם ישבו באמצע,
          בין המספרים לבין הרשימה, וחצו את המסך לשניים בדיוק במקום שבו קוראים אותו - הטופס
          הוא פעולה שעושים מדי פעם, לא מידע שמסתכלים עליו בכל כניסה. */}
      {canAdd && (
        <details className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <summary className="cursor-pointer text-sm font-bold text-ink">
            הוספת הכנסה למעקב{importEnabled && " / ייבוא חודשים מאקסל"}
          </summary>

          <form action={addIncome} className="mt-3 flex flex-wrap items-end gap-2.5">
            {/* מכוון: אין כאן אמצעי תשלום ואין "מזומן". השורות כאן הן אינדיקציה בלבד - כמה
                הסניף הזה מחזיר לי - ולא כסף שנספר פעם שנייה. מזומן אמיתי שנמשך מהקופה נרשם
                פעם אחת בלבד, בהנה"ח הראשית, עם הקופה שממנה נמשך. */}
            <p className="w-full text-[11px] leading-relaxed text-muted">
              שורות מעקב בלבד — לא נכנסות להנה&quot;ח הראשית. <b>אין צורך להזין כאן מזומן</b>:
              מזומן שנמשך מהקופה נרשם פעם אחת בהנה&quot;ח הראשית תחת &quot;מזומן&quot; (שם בוחרים
              מאיזו קופה), ומופיע כאן אוטומטית ברשימה שלמעלה.
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

          {importEnabled && (
            <div className="mt-4 border-t border-card-border pt-4">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
                <FileSpreadsheet className="h-4 w-4" />
                ייבוא חודשים מקובץ אקסל
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                למילוי היסטוריה בבת אחת. הורד את התבנית, מלא בעמודה הימנית את החודש בפורמט{" "}
                <b dir="ltr">10/24</b> ולצידה את הסכום — שורה אחת לכל חודש — והעלה. כל חודש נקלט
                כשורה נפרדת ומופיע בטבלה &quot;הכנסות לפי חודש&quot;. ייבוא חוזר של אותו חודש
                מחליף את מה שיובא קודם ולא מכפיל אותו, ושורות שהוקלדו כאן ידנית לא נוגעים בהן.{" "}
                <b>גם הייבוא נשאר מעקב פנימי בלבד — הוא לא נכנס להנה&quot;ח הראשית.</b>
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={`/api/computer-rooms-accounting/${params.id}/income-template`}
                  className="flex items-center gap-1.5 rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-[#f4f6f9]"
                >
                  <Download className="h-3.5 w-3.5" />
                  הורדת תבנית לייבוא
                </a>
                <form action={importIncome} className="flex items-center gap-2 rounded-[10px] border border-card-border bg-white px-3 py-1.5">
                  <input type="file" name="file" accept=".xlsx,.xls" required className="text-xs" />
                  <button type="submit" className="flex items-center gap-1.5 text-xs font-bold text-teal hover:underline">
                    <Upload className="h-3.5 w-3.5" />
                    ייבוא לסניף זה
                  </button>
                </form>
                {isOwner && stats.importedIncomeRows > 0 && (
                  <form action={clearImported}>
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 rounded-[10px] border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      מחיקת {stats.importedIncomeRows} השורות שיובאו
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </details>
      )}
    </div>
  );
}
