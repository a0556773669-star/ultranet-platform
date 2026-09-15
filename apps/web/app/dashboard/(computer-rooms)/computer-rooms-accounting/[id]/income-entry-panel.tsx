"use client";

import { useState } from "react";
import { Plus, X, FileSpreadsheet, Upload, Download, Trash2 } from "lucide-react";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

type Action = (formData: FormData) => void | Promise<void>;

/**
 * הזנת הכנסה וייבוא מאקסל — כפתור אחד בראש העמוד, ליד "בחירת סניף אחר".
 *
 * הטופס עצמו לא השתנה, רק המקום שלו: הוא ישב קודם פרוס בתחתית העמוד, מתחת לכל הפירוט,
 * למרות שהוא פעולה שעושים אחת לחודש. עכשיו הוא חלון שנפתח מכפתור, והעמוד שמאחוריו נשאר
 * תמונת מצב בלבד.
 */
export function IncomeEntryPanel({
  addIncome,
  importIncome,
  clearImported,
  importEnabled,
  importedRows,
  canClearImported,
  templateHref,
  today,
}: {
  addIncome: Action;
  importIncome: Action;
  clearImported: Action;
  importEnabled: boolean;
  importedRows: number;
  canClearImported: boolean;
  templateHref: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-3 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
      >
        <Plus className="h-3.5 w-3.5" />
        הוספת הכנסה{importEnabled && " / ייבוא"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="my-8 w-full max-w-lg rounded-card bg-white p-5 text-right shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
                <Plus className="h-4 w-4" />
                הוספת הכנסה למעקב{importEnabled && " / ייבוא חודשים מאקסל"}
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted transition hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* מכוון: אין כאן אמצעי תשלום ואין "מזומן". השורות כאן הן אינדיקציה בלבד - כמה
                הסניף הזה מחזיר לי - ולא כסף שנספר פעם שנייה. מזומן אמיתי שנמשך מהקופה נרשם
                פעם אחת בלבד, בהנה"ח הראשית, עם הקופה שממנה נמשך. */}
            <p className="mb-3 text-[11px] leading-relaxed text-muted">
              שורות מעקב בלבד — לא נכנסות להנה&quot;ח הראשית. <b>אין צורך להזין כאן מזומן</b>: מזומן
              שנמשך מהקופה נרשם פעם אחת בהנה&quot;ח הראשית תחת &quot;מזומן&quot; (שם בוחרים מאיזו
              קופה), ומופיע כאן אוטומטית בשורות ההכנסה.
            </p>

            <form action={addIncome} className="flex flex-col gap-2.5">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">תאריך</label>
                  <input type="date" name="date" defaultValue={today} required className={FIELD} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">תיאור (לא חובה)</label>
                  <input name="desc" placeholder="הכנסת חודש" className={FIELD} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">סכום</label>
                  <input type="number" name="amount" min={0} required className={FIELD} />
                </div>
              </div>
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
              >
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
                  כשורה נפרדת ומופיע בטבלה &quot;הכנסות לפי חודש&quot;. ייבוא חוזר של אותו חודש מחליף
                  את מה שיובא קודם ולא מכפיל אותו, ושורות שהוקלדו כאן ידנית לא נוגעים בהן.{" "}
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
                  {canClearImported && importedRows > 0 && (
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
