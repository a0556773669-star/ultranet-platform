"use client";

import { useState } from "react";
import { Plus, X, FileSpreadsheet, Upload, Download, Trash2, Banknote, CalendarDays } from "lucide-react";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

type Action = (formData: FormData) => void | Promise<void>;

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/** סניף אחד בטופס החודשי, עם מה שכבר רשום לו בכל חודש. */
export interface BranchIncomeRow {
  id: string;
  name: string;
  /** סך שורות המעקב (`n_branch_income`) שכבר רשומות לסניף בכל חודש */
  manualByMonth: Record<string, number>;
  /** מזומן מהקופה שנרשם בספר הראשי באותו חודש - מוצג בלבד, לא מוקלד כאן ולא נמחק מכאן */
  cashByMonth: Record<string, number>;
}

/**
 * הזנת ההכנסות וייבוא מאקסל — כפתור אחד בראש העמוד, ליד "בחירת סניף אחר".
 *
 * הטופס בנוי כמו שהמספרים באמת מגיעים: **חודש אחד למעלה, ושורה לכל סניף מתחתיו**. קודם הוא
 * היה שורה בודדת לסניף אחד בכל פעם, וכדי לרשום חודש שלם היה צריך לעבור סניף-סניף ולפתוח את
 * הטופס מחדש בכל אחד מהם. שדה ריק = לא נוגעים בסניף הזה; מספר = זה מה שהיה באותו חודש
 * (מחליף את מה שרשום, לא מתווסף אליו); 0 = מוחק את החודש.
 */
export function IncomeEntryPanel({
  saveMonthly,
  branches,
  defaultMonth,
  back,
  importIncome,
  clearImported,
  importEnabled = false,
  importedRows = 0,
  canClearImported = false,
  templateHref,
}: {
  saveMonthly: Action;
  branches: BranchIncomeRow[];
  defaultMonth: string;
  back: string;
  importIncome?: Action;
  clearImported?: Action;
  importEnabled?: boolean;
  importedRows?: number;
  canClearImported?: boolean;
  templateHref?: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(defaultMonth);

  const showImport = importEnabled && importIncome && templateHref;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-3 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
      >
        <Plus className="h-3.5 w-3.5" />
        הזנת הכנסות{showImport && " / ייבוא"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="my-8 w-full max-w-xl rounded-card bg-white p-5 text-right shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
                <CalendarDays className="h-4 w-4" />
                הכנסות החודש{showImport && " / ייבוא מאקסל"}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted transition hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* מכוון: אין כאן אמצעי תשלום ואין "מזומן". השורות כאן הן אינדיקציה בלבד - כמה
                כל סניף מחזיר לי - ולא כסף שנספר פעם שנייה. מזומן אמיתי שנמשך מהקופה נרשם
                פעם אחת בלבד, בהנה"ח הראשית, עם הקופה שממנה נמשך. */}
            <p className="mb-3 text-[11px] leading-relaxed text-muted">
              בוחרים חודש וממלאים כמה נכנס בכל סניף. <b>שדה ריק — לא נוגעים בסניף הזה</b>, מספר
              מחליף את מה שכבר רשום לאותו חודש (ולא מתווסף אליו), ו-0 מוחק אותו. אלה שורות מעקב
              בלבד — לא נכנסות להנה&quot;ח הראשית. <b>אין צורך להזין כאן מזומן</b>: מזומן שנמשך
              מהקופה נרשם פעם אחת בהנה&quot;ח הראשית תחת &quot;מזומן&quot; ומופיע כאן לבדו.
            </p>

            <form action={saveMonthly} className="flex flex-col gap-3">
              <input type="hidden" name="back" value={back} />
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">חודש</label>
                <input
                  type="month"
                  name="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  required
                  className={`${FIELD} max-w-[200px]`}
                />
              </div>

              <div className="overflow-hidden rounded-card border border-card-border">
                <table className="w-full border-collapse text-right text-[13px]">
                  <thead>
                    <tr className="border-b border-card-border bg-[#f4f6f9]">
                      <th className="px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted">סניף</th>
                      <th className="px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-muted">
                        נכנס בחודש
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((b, idx) => {
                      const recorded = b.manualByMonth[month];
                      const cash = b.cashByMonth[month] ?? 0;
                      return (
                        <tr key={b.id} className={`border-b border-card-border last:border-b-0 ${idx % 2 === 1 ? "bg-[#fafbfc]" : ""}`}>
                          <td className="px-2.5 py-1.5">
                            <span className="block font-bold text-ink">{b.name}</span>
                            {cash > 0 && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-muted">
                                <Banknote className="h-3 w-3" />
                                ועוד {money(cash)} מזומן מהקופה — נספר לבד
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {/* המפתח כולל את החודש כדי שהשדה ייטען מחדש עם המספר של החודש
                                שנבחר, ולא יישאר תקוע על הערך של החודש הקודם. */}
                            <input
                              key={`${b.id}-${month}`}
                              type="number"
                              name={`amount:${b.id}`}
                              min={0}
                              step="any"
                              defaultValue={recorded != null ? Math.round(recorded) : ""}
                              placeholder="—"
                              className="w-full max-w-[140px] rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-sm tabular-nums focus:border-teal focus:bg-white focus:outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                שמירת החודש
              </button>
            </form>

            {showImport && (
              <div className="mt-4 border-t border-card-border pt-4">
                <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
                  <FileSpreadsheet className="h-4 w-4" />
                  ייבוא חודשים מקובץ אקסל — לסניף זה
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  למילוי היסטוריה בבת אחת. הורד את התבנית, מלא בעמודה הימנית את החודש בפורמט{" "}
                  <b dir="ltr">10/24</b> ולצידה את הסכום — שורה אחת לכל חודש — והעלה. כל חודש נקלט
                  כשורה נפרדת ומופיע בטבלה &quot;הכנסות לפי חודש&quot;. ייבוא חוזר של אותו חודש מחליף
                  את מה שיובא קודם ולא מכפיל אותו.{" "}
                  <b>גם הייבוא נשאר מעקב פנימי בלבד — הוא לא נכנס להנה&quot;ח הראשית.</b>
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <a
                    href={templateHref}
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
                  {canClearImported && clearImported && importedRows > 0 && (
                    <form action={clearImported}>
                      <button
                        type="submit"
                        className="flex items-center gap-1.5 rounded-[10px] border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        מחיקת {importedRows} השורות שיובאו
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
