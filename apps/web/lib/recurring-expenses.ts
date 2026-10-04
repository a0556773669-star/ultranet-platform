/**
 * הוצאות קבועות משתנות (`n_recurring_var_expenses`).
 *
 * חשמל הוא הוצאה קבועה - הוא חוזר כל חודש, לנצח, ורוצים לראות אותו כשורה אחת לאורך שנה.
 * חשמל הוא גם הוצאה משתנה - הסכום אחר כל חודש. שתי המערכות הקיימות לא ידעו להחזיק את
 * שני הדברים יחד: `n_fixed_expenses` הניחה סכום אחד לתמיד, ו-`n_var_expenses` הניחה
 * אירוע חד-פעמי בלי המשך. התוצאה הייתה שחשמל נרשם כשורה נפרדת בכל חודש ואי אפשר היה
 * לעקוב אחריו.
 *
 * כאן זו שורה אחת עם סכום לכל חודש. חודש בלי סכום הוא לא אפס - הוא "עוד לא עודכן",
 * וזה מה שהתזכורת החודשית מחפשת (`missingMonths`). ההבחנה הזו היא כל התועלת של המודול:
 * "לא שילמתי חשמל" ו"לא רשמתי כמה שילמתי" הן שתי אמירות שונות לחלוטין.
 *
 * שני צירים נוספים, ושניהם נגזרים מ-`frequency`:
 *
 * 1. **מתי נדרש תשלום** (`dueMonths`). ארנונה דו-חודשית נדרשת בחודש מספר 1, 3, 5 - לא בכל
 *    חודש. התראה על חודש שבו אין מה לשלם היא רעש, ורעש מלמד להתעלם מההתראות.
 * 2. **על איזה חודש העלות נופלת** (`monthlyAllocation`). ביטוח שנתי של 12,000 ₪ הוא 12,000 ₪
 *    במזומן בינואר אבל 1,000 ₪ עלות בכל חודש. בלי פריסה ינואר נראה חודש אסון ושאר השנה
 *    נראית זולה מכפי שהיא, ואי אפשר להשוות חודש לחודש. שני המספרים אמיתיים ולכן שניהם
 *    נשמרים: `totalToDate` הוא מה ששולם, `monthlyAllocation` הוא מה שנעלה.
 */
import { getAdminFirestore } from "./firebase-admin";
import type {
  ExpenseScope,
  RecurringFrequency,
  RecurringFrequencyChange,
  RecurringVariableExpense,
  RecurringVariableAmount,
} from "@ultranet/shared-types";
import { RECURRING_FREQUENCY_MONTHS } from "@ultranet/shared-types";
import { monthsBetween } from "./branch-accounting";

export const RECURRING_VAR_EXPENSES_COLLECTION = "n_recurring_var_expenses";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 10).slice(0, 7);
}

/** החודש שלפני `month` (YYYY-MM), כולל מעבר שנה. */
export function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * החודש האחרון ש**נסגר** - החודש שלפני החודש הנוכחי.
 *
 * זה הגבול של כל התראה: את חשבון החשמל של ספטמבר אי אפשר לעדכן ב-15 בספטמבר, כי הוא עוד
 * לא הגיע. חודש הופך ל"חסר" רק כשהוא עבר - ב-1 באוקטובר. תא החודש הרץ נשאר פתוח להזנה
 * מוקדמת, הוא פשוט לא נצבע ולא נספר כפיגור.
 */
export function lastClosedMonth(today = currentMonth()): string {
  return previousMonth(today);
}

export const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  monthly: "חודשי",
  bimonthly: "דו-חודשי",
  quarterly: "רבעוני",
  yearly: "שנתי",
};

type FrequencyFields = Pick<RecurringVariableExpense, "frequency" | "frequencyChanges">;

/** התדירות שאיתה ההוצאה התחילה. רשומות שנכתבו לפני השדה הן חודשיות. */
export function baseFrequency(expense: Pick<RecurringVariableExpense, "frequency">): RecurringFrequency {
  return expense.frequency ?? "monthly";
}

/** שינויי התדירות, ממוינים ומנוקים מערכים פגומים. */
function sortedChanges(expense: FrequencyFields): RecurringFrequencyChange[] {
  return [...(expense.frequencyChanges ?? [])]
    .filter((c) => /^\d{4}-\d{2}$/.test(c?.from ?? "") && RECURRING_FREQUENCY_MONTHS[c.frequency] > 0)
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** תקופה אחת של תדירות אחידה בתוך חיי ההוצאה. */
export interface FrequencySegment {
  from: string;
  to: string;
  frequency: RecurringFrequency;
  /** אורך המחזור בחודשים בתוך התקופה הזו */
  cycle: number;
}

/**
 * קו-הזמן של התדירות: תקופה לכל תדירות, מ-`startDate` ועד היום/ההפסקה.
 *
 * חשמל שהיה דו-חודשי ועבר לחודשי הוא אותה הוצאה עם שתי תקופות, ולא שתי הוצאות. **המחזור
 * נמדד מחדש בתחילת כל תקופה**: דו-חודשי מ-01/2025 נדרש ב-01, 03, 05..., ומהרגע שהוא חודשי
 * ב-06/2026 הוא נדרש ב-06, 07, 08 - ולא "כל חודש שני מ-01/2025".
 *
 * שינוי שתאריכו לפני ההתחלה או בדיוק בה פשוט מחליף את התדירות ההתחלתית, כדי שתיקון של
 * "בעצם זה תמיד היה דו-חודשי" לא ייצור תקופה ריקה.
 */
export function frequencySegments(expense: RecurringVariableExpense, upto = currentMonth()): FrequencySegment[] {
  if (!expense.startDate) return [];
  const start = expense.startDate.slice(0, 7);
  const end = lastRelevantMonth(expense, upto);
  if (end < start) return [];

  let base = baseFrequency(expense);
  const points: RecurringFrequencyChange[] = [];
  for (const c of sortedChanges(expense)) {
    if (c.from <= start) base = c.frequency;
    else if (c.from <= end) points.push(c);
  }

  const boundaries: RecurringFrequencyChange[] = [{ from: start, frequency: base }, ...points];
  const segments: FrequencySegment[] = [];
  boundaries.forEach((b, i) => {
    const next = boundaries[i + 1];
    const to = next ? previousMonth(next.from) : end;
    if (to < b.from) return;
    segments.push({ from: b.from, to, frequency: b.frequency, cycle: RECURRING_FREQUENCY_MONTHS[b.frequency] });
  });
  return segments;
}

/** התדירות שתקפה בחודש מסוים (ברירת מחדל: היום). */
export function frequencyAt(expense: RecurringVariableExpense, month: string): RecurringFrequency {
  let freq = baseFrequency(expense);
  const start = expense.startDate?.slice(0, 7) ?? month;
  for (const c of sortedChanges(expense)) {
    if (c.from <= start || c.from <= month) freq = c.frequency;
  }
  return freq;
}

/**
 * התדירות **הנוכחית** של ההוצאה - זו שמוצגת בכל מקום שכתוב בו "חודשי"/"דו-חודשי".
 * שם ההיסטורי נשמר כי כל הקריאות הקיימות התכוונו בדיוק לזה.
 */
export function frequencyOf(expense: RecurringVariableExpense, upto = currentMonth()): RecurringFrequency {
  return frequencyAt(expense, upto);
}

/** אורך המחזור בחודשים כרגע: כל כמה חודשים מגיע תשלום, ועל פני כמה חודשים הוא נפרס. */
export function cycleMonths(expense: RecurringVariableExpense, upto = currentMonth()): number {
  return RECURRING_FREQUENCY_MONTHS[frequencyOf(expense, upto)];
}

/**
 * האם לפרוס את התשלום על פני חודשי המחזור. ברירת המחדל לתדירות רב-חודשית היא כן, כי זו
 * הסיבה היחידה שמישהו מגדיר תדירות שנתית מלכתחילה. במחזור של חודש אין מה לפרוס.
 */
export function isSpread(expense: RecurringVariableExpense, upto = currentMonth()): boolean {
  return spreadOfCycle(cycleMonths(expense, upto), expense.spread);
}

function spreadOfCycle(cycle: number, spread: boolean | undefined): boolean {
  return cycle > 1 && spread !== false;
}

/** החודש האחרון שרלוונטי להוצאה: היום, או חודש ההפסקה אם הוא מוקדם יותר. */
function lastRelevantMonth(expense: RecurringVariableExpense, upto: string): string {
  const end = expense.endDate?.slice(0, 7);
  return end && end < upto ? end : upto;
}

/**
 * החודשים שבהם באמת מגיע תשלום: בכל תקופת תדירות, מתחילתה והלאה בקפיצות המחזור שלה.
 * זו רשימת החודשים שהמערכת מבקשת עליהם סכום - ורק עליהם.
 */
export function dueMonths(expense: RecurringVariableExpense, upto = currentMonth()): string[] {
  const out: string[] = [];
  for (const seg of frequencySegments(expense, upto)) {
    const months = monthsBetween(seg.from, seg.to);
    for (let i = 0; i < months.length; i += seg.cycle) {
      const month = months[i];
      if (month) out.push(month);
    }
  }
  return out;
}

/**
 * כל החודשים שההוצאה נוגעת בהם - כולל חודשים שאין בהם תשלום אבל יש בהם עלות פרוסה.
 * זה מה שקובע את רוחב הטבלה, ולכן הוא רחב יותר מ-`dueMonths` בכוונה.
 */
export function coveredMonths(expense: RecurringVariableExpense, upto = currentMonth()): string[] {
  if (!expense.startDate) return [];
  const start = expense.startDate.slice(0, 7);
  const end = lastRelevantMonth(expense, upto);
  if (end < start) return [];
  return monthsBetween(start, end);
}

/**
 * שם היסטורי שנשאר מפני שהוא קריא במקום שבו הוא נקרא ("החודשים שמצפים להם סכום").
 * מאז הוספת התדירות זו בדיוק `dueMonths`.
 */
export const expectedMonths = dueMonths;

export function amountForMonth(expense: RecurringVariableExpense, month: string): number | null {
  const hit = (expense.amounts ?? []).find((a) => a.month === month);
  return hit ? hit.amount : null;
}

/**
 * החודשים שעדיין לא הוזן להם סכום, עד `upto` ועד בכלל.
 *
 * זו שאלה על *נתונים חסרים*, לא על *פיגור*: מי ששואל "על מה להתריע" מעביר
 * `lastClosedMonth()` ולא את החודש הרץ - וזה מה ש-`buildReminders` עושה.
 */
export function missingMonths(expense: RecurringVariableExpense, upto = currentMonth()): string[] {
  const have = new Set((expense.amounts ?? []).map((a) => a.month));
  return dueMonths(expense, upto).filter((m) => !have.has(m));
}

/** סה"כ מה שנרשם בפועל על ההוצאה הזו עד היום. חודשים שלא עודכנו פשוט לא נספרים. */
export function totalToDate(expense: RecurringVariableExpense, upto = currentMonth()): number {
  return (expense.amounts ?? [])
    .filter((a) => a.month <= upto)
    .reduce((sum, a) => sum + (a.amount || 0), 0);
}

function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** אורך המחזור שתקף בחודש מסוים, לפי קו-הזמן של התדירות. */
function cycleAtMonth(segments: FrequencySegment[], month: string): number {
  if (segments.length === 0) return 1;
  let cycle = segments[0]!.cycle;
  for (const seg of segments) if (seg.from <= month) cycle = seg.cycle;
  return cycle;
}

/**
 * העלות החודשית, עם סימון אילו חודשים הם חלק יחסי של תשלום רב-חודשי.
 *
 * תשלום חודשי נופל כולו על החודש שלו. תשלום רב-חודשי פרוס מתחלק שווה בשווה על חודשי
 * המחזור שהוא משלם עליהם (מחודש התשלום והלאה). חודש שעדיין לא הגיע (`> upto`) לא נספר
 * גם אם כבר שולם עליו - הכסף יצא, אבל העלות שייכת לחודש שלה.
 *
 * המחזור נלקח מהתקופה של **חודש התשלום עצמו**: תשלום דו-חודשי מ-2025 נשאר פרוס לחודשיים
 * גם אחרי שההוצאה עברה לחודשית, אחרת שינוי תדירות היה משכתב למפרע את עלות העבר.
 */
export function monthlyAllocationDetailed(
  expense: RecurringVariableExpense,
  upto = currentMonth(),
): Map<string, { amount: number; spread: boolean }> {
  const out = new Map<string, { amount: number; spread: boolean }>();
  const segments = frequencySegments(expense, upto);
  const end = lastRelevantMonth(expense, upto);
  for (const a of expense.amounts ?? []) {
    if (a.month > upto) continue;
    const cycle = cycleAtMonth(segments, a.month);
    const spread = spreadOfCycle(cycle, expense.spread);
    const step = spread ? cycle : 1;
    const share = (a.amount || 0) / step;
    for (let i = 0; i < step; i += 1) {
      const month = addMonths(a.month, i);
      // חודש התשלום עצמו נספר תמיד, גם אם הוא אחרי `endDate`: כסף שיצא לא מתאדה מהספר
      // רק מפני שההוצאה כבר הופסקה. מה שנחתך הוא רק המשך הפריסה קדימה.
      if (i > 0 && month > end) break;
      const prev = out.get(month);
      out.set(month, { amount: (prev?.amount ?? 0) + share, spread: (prev?.spread ?? false) || spread });
    }
  }
  return out;
}

/** אותו חישוב, רק הסכומים - הצורה שרוב הקוראים צריכים. */
export function monthlyAllocation(
  expense: RecurringVariableExpense,
  upto = currentMonth(),
): Map<string, number> {
  return new Map([...monthlyAllocationDetailed(expense, upto)].map(([month, v]) => [month, v.amount]));
}

/** כמה מההוצאה נופל על חודש מסוים, אחרי פריסה. `0` = כלום. */
export function allocationForMonth(
  expense: RecurringVariableExpense,
  month: string,
  upto = currentMonth(),
): number {
  return monthlyAllocation(expense, upto).get(month) ?? 0;
}

export interface RecurringReminder {
  expense: RecurringVariableExpense;
  missing: string[];
  /** החודש הכי ישן שחסר - זה מה שמציגים בהתראה */
  oldestMissing: string;
  suggestedAmount: number;
  /** האם החודש שנסגר זה עתה הוא אחד מהחסרים - זו התזכורת "עדכן את זה עכשיו" */
  dueNow: boolean;
  /** חסרים ישנים מהחודש שנסגר: היסטוריה שלא הושלמה */
  overdue: number;
}

/**
 * ההתראות שצריך להציג היום: כל הוצאה קבועה משתנה שחסר לה חודש שכבר **נסגר**.
 *
 * `upto` הוא החודש הרץ (ברירת מחדל: היום), וההתראות נבנות עד `lastClosedMonth(upto)` בלבד.
 * קודם ההתראה על ספטמבר נדלקה כבר ב-1 בספטמבר, לפני שהחשבון בכלל הגיע, ולכן היא דלקה כל
 * החודש ואיבדה את המשמעות: "צריך עדכון" שתמיד דולק הוא לא התראה. עכשיו ספטמבר נדרש
 * ב-1 באוקטובר, ו-`dueNow` הוא בדיוק החודש שנסגר זה עתה - מה שצריך לעדכן *היום*.
 *
 * הסכום המוצע הוא הסכום האחרון שנרשם, ובהיעדרו `defaultAmount` - כי בפועל אף אחד לא
 * מקליד את חשבון החשמל מאפס, הוא מתקן את של החודש שעבר.
 */
export function buildReminders(expenses: RecurringVariableExpense[], upto = currentMonth()): RecurringReminder[] {
  const out: RecurringReminder[] = [];
  const dueUpto = lastClosedMonth(upto);
  for (const expense of expenses) {
    const missing = missingMonths(expense, dueUpto);
    if (missing.length === 0) continue;
    const latest = (expense.amounts ?? [])
      .slice()
      .sort((a, b) => b.month.localeCompare(a.month))[0];
    out.push({
      expense,
      missing,
      oldestMissing: missing[0]!,
      suggestedAmount: latest?.amount ?? expense.defaultAmount ?? 0,
      dueNow: missing.includes(dueUpto),
      overdue: missing.filter((m) => m !== dueUpto).length,
    });
  }
  return out.sort((a, b) => a.oldestMissing.localeCompare(b.oldestMissing));
}

export async function loadRecurringVariableExpenses(params?: {
  scope?: ExpenseScope;
  branchId?: string;
}): Promise<RecurringVariableExpense[]> {
  const snap = await getAdminFirestore().collection(RECURRING_VAR_EXPENSES_COLLECTION).get();
  let rows = snap.docs.map(
    (d) => ({ ...(d.data() as Omit<RecurringVariableExpense, "id">), id: d.id }) as RecurringVariableExpense,
  );
  if (params?.scope) rows = rows.filter((r) => r.scope === params.scope);
  if (params?.branchId !== undefined) rows = rows.filter((r) => (r.branchId ?? "") === params.branchId);
  return rows
    .map((r) => ({ ...r, amounts: [...(r.amounts ?? [])].sort((a, b) => b.month.localeCompare(a.month)) }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

/** כותב/מעדכן סכום לחודש אחד. הכתיבה היא upsert לפי חודש - אין שתי שורות לאותו חודש. */
export function upsertAmount(
  amounts: RecurringVariableAmount[] | undefined,
  entry: RecurringVariableAmount,
): RecurringVariableAmount[] {
  const rest = (amounts ?? []).filter((a) => a.month !== entry.month);
  return [...rest, entry].sort((a, b) => b.month.localeCompare(a.month));
}
