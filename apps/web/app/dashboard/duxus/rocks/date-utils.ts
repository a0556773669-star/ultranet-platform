// מפתחות תקופה למודל "סלעים ואבני דרך": רבעון/חודש/שבוע.
// מכוונים לפשטות ולחישוב הזזה (prev/next) חד-משמעי - לא בהכרח פורמט ISO רשמי (במיוחד השבוע,
// שמיוצג כאינדקס פנימי מונוטוני ולא כ-"YYYY-Www" כדי להימנע מסיבוכי גבול שנה).

const MONTH_NAMES = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

// שני 2020-01-06 - עוגן שרירותי לספירת שבועות; לא נחשף למשתמש, רק לצורך מיון/הזזה עקביים.
const WEEK_EPOCH_MS = Date.UTC(2020, 0, 6);
const DAY_MS = 24 * 60 * 60 * 1000;

export function currentQuarterKey(d: Date = new Date()): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

export function shiftQuarterKey(key: string, delta: number): string {
  const [yStr, qStr] = key.split("-Q");
  const y = Number(yStr);
  const q = Number(qStr);
  const total = y * 4 + (q - 1) + delta;
  const ny = Math.floor(total / 4);
  const nq = ((total % 4) + 4) % 4;
  return `${ny}-Q${nq + 1}`;
}

/** מפתח רבעון לועזי ישן ("2026-Q3") - להבדיל ממפתח של רבעון בעל שם ("q1abc..."). */
export function isGregorianQuarterKey(key: string): boolean {
  return /^\d{4}-Q[1-4]$/.test(key);
}

/**
 * תווית ברירת מחדל לרבעון. רבעון שנפתח מהמסך שומר תווית חופשית משלו ב-`n_quarters`
 * (למשל "ראש חודש אלול - ראש חודש כסלו"); כאן מטופל רק המפתח הלועזי הישן, ומפתח
 * שאינו מזוהה מוחזר כמות שהוא במקום להציג "רבעון undefined".
 */
export function quarterLabel(key: string): string {
  if (!isGregorianQuarterKey(key)) return key;
  const [y, q] = key.split("-Q");
  return `רבעון ${q} · ${y}`;
}

/**
 * ערך מיון על ציר הזמן, בקנה מידה של חותמת זמן - כדי שרבעונים לועזיים ישנים
 * (שממופים לתחילת הרבעון) ורבעונים בעלי שם (שנשמרים עם `Date.now()`) יסתדרו יחד
 * ברשימה אחת ממוינת.
 */
export function quarterOrderValue(key: string): number {
  if (!isGregorianQuarterKey(key)) return 0;
  const [yStr, qStr] = key.split("-Q");
  return Date.UTC(Number(yStr), (Number(qStr) - 1) * 3, 1);
}

export function currentMonthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonthKey(key: string, delta: number): string {
  const [yStr, mStr] = key.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  return `${ny}-${String(nm + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [yStr, mStr] = key.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  return `${MONTH_NAMES[m - 1] ?? m} ${y}`;
}

export function monthQuarterKey(key: string): string {
  const [yStr, mStr] = key.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const q = Math.floor((m - 1) / 3) + 1;
  return `${y}-Q${q}`;
}

function weekIndex(d: Date): number {
  const utcMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((utcMidnight - WEEK_EPOCH_MS) / (7 * DAY_MS));
}

export function currentWeekKey(d: Date = new Date()): string {
  return `W${weekIndex(d)}`;
}

export function shiftWeekKey(key: string, delta: number): string {
  const idx = Number(key.slice(1));
  return `W${idx + delta}`;
}

export function weekLabel(key: string): string {
  const idx = Number(key.slice(1));
  const start = new Date(WEEK_EPOCH_MS + idx * 7 * DAY_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const fmt = (d: Date) => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
  return `שבוע ${fmt(start)}–${fmt(end)}`;
}

export function weekMonthKey(key: string): string {
  const idx = Number(key.slice(1));
  const mid = new Date(WEEK_EPOCH_MS + idx * 7 * DAY_MS + 3 * DAY_MS);
  return currentMonthKey(mid);
}

/** אינדקס השבוע מתוך מפתח "Wnnn"; NaN-safe כדי שמפתח פגום לא יפיל מיון. */
export function weekKeyIndex(key: string): number {
  const n = Number(key.slice(1));
  return Number.isFinite(n) ? n : -1;
}

/** המפתח המאוחר ביותר מתוך רשימה - משמש לגזירת החודש/שבוע ה"פתוח" בדאטה שקדם לשדות האלה. */
export function latestMonthKey(keys: string[]): string {
  return keys.filter(Boolean).sort((a, b) => a.localeCompare(b)).pop() ?? "";
}

export function latestWeekKey(keys: string[]): string {
  return keys.filter(Boolean).sort((a, b) => weekKeyIndex(a) - weekKeyIndex(b)).pop() ?? "";
}

/**
 * החודש הבא שייפתח: אם עוד לא נפתח חודש - החודש הלועזי הנוכחי; אם הלוח כבר עבר
 * את החודש הפתוח - קופצים להווה; אחרת מתקדמים חודש אחד קדימה (כדי שאפשר לפתוח
 * חודש חדש גם באמצע חודש קלנדרי).
 */
export function nextMonthKeyAfter(current: string, today: Date = new Date()): string {
  const calendar = currentMonthKey(today);
  if (!current) return calendar;
  return calendar.localeCompare(current) > 0 ? calendar : shiftMonthKey(current, 1);
}

/** אותו כלל בדיוק ברמת השבוע (השוואה מספרית, לא לקסיקוגרפית - "W9" מול "W10"). */
export function nextWeekKeyAfter(current: string, today: Date = new Date()): string {
  const calendar = currentWeekKey(today);
  if (!current) return calendar;
  return weekKeyIndex(calendar) > weekKeyIndex(current) ? calendar : shiftWeekKey(current, 1);
}

// --- תאריכי יעד ואזהרות (סעיף 9 באפיון) ---

/** "YYYY-MM-DD" של היום, לפי אזור הזמן המקומי (ולא UTC, שמקדים/מאחר את התאריך). */
export function todayIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * תאריך היעד עבר (לא כולל היום עצמו - "עבר יעד" מתחיל ביום שאחרי). `today` מתקבל
 * כמחרוזת ISO ולא נגזר מ-`new Date()` בתוך הרינדור, כדי שהשרת והלקוח יגיעו לאותה
 * תוצאה בדיוק ולא ייווצר פער הידרציה על גבול חצות.
 */
export function isPastDue(dueDate: string | undefined, today: string): boolean {
  if (!dueDate) return false;
  return dueDate < today;
}

/** תאריך היעד הוא היום. */
export function isDueToday(dueDate: string | undefined, today: string): boolean {
  return Boolean(dueDate) && dueDate === today;
}

/**
 * האם הגיע מועד האזהרה השבועית. `warningWeekday` הוא הגדרת מערכת (ברירת מחדל 3 = רביעי),
 * ולכן היום לא מקובע בקוד. מיום האזהרה ואילך - עד סוף שבוע העבודה - משימת שבוע שטרם
 * התחילה מקבלת חיווי כתום עדין.
 */
export function weekWarningActive(warningWeekday: number, weekStartDay: number, today: Date = new Date()): boolean {
  const daysSinceStart = (today.getDay() - weekStartDay + 7) % 7;
  const daysToWarning = (warningWeekday - weekStartDay + 7) % 7;
  return daysSinceStart >= daysToWarning;
}

/** תאריכי ההתחלה/סיום של שבוע לפי מפתח פנימי - לתצוגה בהיסטוריה. */
export function weekRangeIso(key: string): { start: string; end: string } {
  const idx = weekKeyIndex(key);
  const start = new Date(WEEK_EPOCH_MS + idx * 7 * DAY_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

/** תווית קצרה לתקופה לפי סוגה - משמשת את היסטוריית השיוכים ואת מסך הארכיון. */
export function periodLabel(periodType: "quarter" | "month" | "week", periodKey: string, quarterLabels?: Map<string, string>): string {
  if (periodType === "week") return weekLabel(periodKey);
  if (periodType === "month") return monthLabel(periodKey);
  return quarterLabels?.get(periodKey) ?? quarterLabel(periodKey);
}
