/**
 * "עדכון מחיר" והורדת הוצאה קבועה — בלי לשכתב חודשים שעברו.
 *
 * שכירות שעלתה עד היום 2,000 ₪ ומהיום 2,300 ₪ היא **שתי תקופות**, לא שורה אחת שהסכום שלה
 * נערך: עריכה של `amount` הייתה מחשבת מחדש את כל החודשים שכבר נסגרו (וכבר נשלחו בדו"ח לשותף)
 * לפי המחיר החדש. לכן העדכון סוגר את השורה הקיימת בסוף החודש שלפני, ופותח עותק שלה עם הסכום
 * החדש מהחודש שנבחר. כל שאר השדות (סניף, קטגוריה, מי שילם, על מי החוב, חלוקה משותפת,
 * `countsToMain`) עוברים לגרסה החדשה כפי שהם — הם תנאי ההסכם, לא המחיר.
 *
 * עובד על שני הקולקשנים של הוצאה קבועה: `n_fixed_expenses` (סניפים — חדרי מחשבים, השכרות,
 * משרד שיתופי והספרים המשותפים) ו-`n_ah_fixed_expenses` (העסק עצמו). בשניהם הסמנטיקה זהה:
 * סכום חודשי, מחודש `startDate` ועד חודש `endDate` כולל.
 *
 * ההרשאה נבדקת אצל מי שקורא — כל מודול יודע מי מורשה אצלו.
 */
import { getAdminFirestore } from "./firebase-admin";

export type FixedExpenseCollection = "n_fixed_expenses" | "n_ah_fixed_expenses";

const MONTH_RE = /^\d{4}-\d{2}$/;

export function previousMonth(month: string): string {
  const [y0, m0] = month.split("-").map(Number);
  let y = y0 ?? 2000;
  let m = (m0 ?? 1) - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function nextMonth(month: string): string {
  const [y0, m0] = month.split("-").map(Number);
  let y = y0 ?? 2000;
  let m = (m0 ?? 1) + 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** היום האחרון בחודש, כ-YYYY-MM-DD. */
export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const day = new Date(Date.UTC(y ?? 2000, m ?? 1, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

export interface RevisionResult {
  ok: boolean;
  message: string;
}

/**
 * הסכום החודשי של השורה משתנה ל-`newAmount` החל מחודש `fromMonth` (כולל).
 *
 * - `fromMonth` הוא חודש ההתחלה של השורה או מוקדם ממנו → אין עבר לשמור, הסכום מתעדכן במקום.
 * - אחרת → השורה נסגרת ב-`fromMonth - 1` ונפתחת שורה חדשה מ-`fromMonth`. אם לשורה הישנה היה
 *   כבר תאריך סיום עתידי, הוא עובר לחדשה.
 * - `newAmount` 0 פירושו הפסקה, לא גרסה של אפס שקלים: השורה פשוט נסגרת בחודש שלפני.
 */
export async function reviseFixedExpenseAmount(params: {
  collection: FixedExpenseCollection;
  id: string;
  fromMonth: string;
  newAmount: number;
  /** בדיקה נוספת על המסמך לפני הכתיבה (למשל "ההוצאה שייכת לסניף הזה"). זורקת כדי לחסום. */
  guard?: (data: Record<string, unknown>) => void;
}): Promise<RevisionResult> {
  const { collection, id, fromMonth } = params;
  const newAmount = Math.round(params.newAmount * 100) / 100;
  if (!MONTH_RE.test(fromMonth)) return { ok: false, message: "חודש לא תקין" };
  if (!Number.isFinite(newAmount) || newAmount < 0) return { ok: false, message: "סכום לא תקין" };

  const db = getAdminFirestore();
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "ההוצאה לא נמצאה" };
  const data = snap.data() as Record<string, unknown> & {
    startDate?: string;
    endDate?: string;
    amount?: number;
    variableAmount?: boolean;
  };
  params.guard?.(data);

  const startMonth = (data.startDate ?? "").slice(0, 7);
  const endMonth = data.endDate ? data.endDate.slice(0, 7) : null;
  if (endMonth && endMonth < fromMonth) {
    return { ok: false, message: `ההוצאה כבר הסתיימה ב-${endMonth} — אין מה לעדכן מ-${fromMonth}` };
  }

  // אין חודשים לפני החודש שנבחר: אין עבר, ולכן עדכון במקום הוא הנכון.
  if (!startMonth || fromMonth <= startMonth) {
    if (newAmount === 0) {
      return { ok: false, message: "ההוצאה מתחילה בחודש הזה — כדי לבטל אותה לגמרי יש למחוק אותה" };
    }
    await ref.set({ amount: newAmount, ...(data.variableAmount ? { lastAmount: newAmount } : {}) }, { merge: true });
    return { ok: true, message: `הסכום עודכן ל-${newAmount.toLocaleString("he-IL")} ₪` };
  }

  const lastOldMonth = previousMonth(fromMonth);
  const batch = db.batch();
  batch.set(ref, { endDate: lastDayOfMonth(lastOldMonth) }, { merge: true });

  if (newAmount > 0) {
    const copy: Record<string, unknown> = { ...data };
    delete copy.endDate;
    copy.amount = newAmount;
    if (data.variableAmount) copy.lastAmount = newAmount;
    copy.startDate = `${fromMonth}-01`;
    copy.revisedFromId = id;
    if (data.endDate) copy.endDate = data.endDate;
    if ("createdAt" in data) copy.createdAt = new Date().toISOString();
    batch.set(db.collection(collection).doc(), copy);
  }
  await batch.commit();

  return {
    ok: true,
    message:
      newAmount > 0
        ? `עד ${lastOldMonth} נשאר הסכום הקודם; מ-${fromMonth} הסכום הוא ${newAmount.toLocaleString("he-IL")} ₪. החודשים שעברו לא השתנו.`
        : `ההוצאה הופסקה — ${lastOldMonth} הוא החודש האחרון שנספר.`,
  };
}
