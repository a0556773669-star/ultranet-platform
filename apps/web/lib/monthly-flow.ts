/**
 * חודש אחד על ציר הזמן: כמה יצא וכמה נכנס באותו חודש בלבד.
 *
 * הטיפוס והבנייה יושבים כאן ולא במודול ספציפי מפני ששני מודולים כבר מציירים את אותו
 * גרף — חדרי מחשבים והמשרד השיתופי — והחישוב הוא אותו חישוב: פריסה של ההוצאות וההכנסות
 * על ציר חודשים רציף. הקובץ טהור (בלי `firebase-admin`) כדי שגם קומפוננטת לקוח תוכל
 * לייבא ממנו.
 */
import { monthsBetween } from "./branch-accounting";

/** חודש אחד על הגרף: מה נזקף לאותו חודש בלבד — לא מצטבר, ובלי עלות ההקמה (היא נקודה
 *  אחת בזמן ולא הוצאה חודשית, והיא הייתה מוחצת את כל שאר העמודים). */
export interface MonthFlow {
  month: string;
  expense: number;
  income: number;
}

/** "03/2026" — תווית קצרה לציר, באותו סדר שבו כותבים תאריך בעברית. */
export function flowMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return y && m ? `${m}/${y}` : month;
}

/**
 * ציר זמן רציף מהחודש הראשון שיש בו נתון ועד החודש הנוכחי.
 *
 * גם חודש שלא קרה בו כלום מקבל שורה: בלעדיו הגרף היה מדלג על חודשים ריקים והמרווחים בו
 * היו משקרים — שני עמודים צמודים שנראים כמו חודשים עוקבים אבל מפריד ביניהם חצי שנה.
 */
export function buildMonthlyFlow(
  expense: Map<string, number>,
  income: Map<string, number>,
  uptoMonth: string,
): MonthFlow[] {
  const dated = [...expense.keys(), ...income.keys()].filter((m) => m && m <= uptoMonth).sort();
  const first = dated[0];
  if (!first) return [];
  return monthsBetween(first, uptoMonth).map((month) => ({
    month,
    expense: expense.get(month) ?? 0,
    income: income.get(month) ?? 0,
  }));
}
