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

export function quarterLabel(key: string): string {
  const [y, q] = key.split("-Q");
  return `רבעון ${q} · ${y}`;
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
