/**
 * תמחור השכרות - מנוע אחד לכל המערכת (מחשבים ניידים וסטיקים, בכל הסניפים).
 * כל התוצאות בשקלים שלמים, ללא אגורות.
 *
 * המודל:
 * 1. סופרים **חודשים קלנדריים שלמים** מתאריך ההתחלה: 12/07 -> 12/08 = חודש אחד
 *    (עם הצמדה לסוף חודש: 31/01 + חודש = 28/02).
 * 2. את יתרת הימים סופרים כ**ימי חיוב**: שישי ושבת יחד = יום אחד (שבת לא נספרת
 *    בנפרד), ולכן שבוע = 6 ימי חיוב.
 * 3. יתרת הימים מתומחרת בשילוב הזול ביותר של שבועות/ימים, ולעולם לא יותר ממחיר
 *    חודש שלם.
 *
 * מדרגות היום הראשון/השני (בעיקר לסטיקים: יום ראשון 20, מהיום השני 10) חלות רק
 * בתחילת ההשכרה - ימים שנשארו אחרי חודש/שבוע מחויבים במחיר היומי השוטף.
 *
 * דוגמה: 12/07 -> 15/08, חודש=550 ויום=50 => חודש × 550 + 2 ימים × 50 = 650 ש"ח
 * (13/08 ו-14/08 נספרים; 15/08 שבת נבלעת ביום שישי).
 */

const DAY_MS = 86_400_000;
const MAX_DAYS = 3650;
/** שבוע = 7 ימים קלנדריים = 6 ימי חיוב (שבת נבלעת ביום שישי). */
const BILLABLE_DAYS_PER_WEEK = 6;

export type PriceLine = {
  unit: "month" | "week" | "day";
  qty: number;
  rate: number;
  amount: number;
  /** תווית ידנית לשורה, למשל "יום ראשון" במקום "יום" */
  label?: string;
};

export type RentalQuote = {
  /** סה"כ ימים קלנדריים בהשכרה (מינימום 1) */
  totalDays: number;
  /** ימי חיוב (שישי+שבת = יום אחד) */
  billableDays: number;
  months: number;
  weeks: number;
  days: number;
  lines: PriceLine[];
  /** סה"כ לתשלום - תמיד מספר שלם */
  total: number;
  /** פירוט החישוב, למשל: "חודש × 550 ₪ + 2 ימים × 50 ₪" */
  breakdown: string;
  /** משך ההשכרה בלשון בני אדם, למשל: "חודש ו-3 ימים" */
  periodLabel: string;
};

/**
 * מחירון פריט להשכרה. `dayPrice` הוא המחיר היומי השוטף; `firstDayPrice`/
 * `secondDayPrice` הן מדרגות אופציונליות ליומיים הראשונים (סטיקים).
 */
export type RentalRates = {
  dayPrice: number;
  firstDayPrice?: number;
  secondDayPrice?: number;
  weekPrice?: number;
  monthPrice?: number;
};

/** מעגל לשקל שלם - אין אגורות/חצאים במערכת. */
export function roundPrice(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function rate(value: number | undefined): number {
  return value && value > 0 ? roundPrice(value) : 0;
}

function parseDate(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** מוסיף n חודשים קלנדריים, עם הצמדה לסוף החודש (31/01 + חודש = 28/02). */
function addMonths(date: Date, n: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const lastDayOfTarget = new Date(Date.UTC(year, month + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month + n, Math.min(day, lastDayOfTarget)));
}

/** ימי חיוב בטווח (from, to]: כל יום נספר חוץ משבת, שנבלעת ביום שישי. */
function countBillableDays(from: Date, to: Date): number {
  const rawDays = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  if (rawDays <= 0) return 0;
  let billable = 0;
  for (let i = 1; i <= rawDays; i++) {
    const d = new Date(from.getTime() + i * DAY_MS);
    if (d.getUTCDay() !== 6) billable++;
  }
  return billable;
}

export type RentalPeriod = {
  /** ימים קלנדריים בפועל (לתצוגה) */
  totalDays: number;
  /** ימי חיוב לכל התקופה (שישי+שבת = יום) */
  billableDays: number;
  /** חודשים קלנדריים שלמים */
  months: number;
  /** יתרת ימים קלנדריים אחרי החודשים */
  extraDays: number;
  /** יתרת ימי חיוב אחרי החודשים */
  billableExtraDays: number;
};

/**
 * מפרק את תקופת ההשכרה לחודשים קלנדריים שלמים + יתרת ימים.
 * ההשכרה נספרת מתאריך ההתחלה עד תאריך ההחזרה (מינימום יום אחד).
 */
export function calcRentalPeriod(startDate: string, endDate: string): RentalPeriod {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) {
    return { totalDays: 0, billableDays: 0, months: 0, extraDays: 0, billableExtraDays: 0 };
  }

  const rawDays = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  const totalDays = Math.min(Math.max(rawDays, 1), MAX_DAYS);
  const cappedEnd = new Date(start.getTime() + totalDays * DAY_MS);

  let months = 0;
  while (months < 600 && addMonths(start, months + 1).getTime() <= cappedEnd.getTime()) {
    months++;
  }
  const anchor = addMonths(start, months);
  const extraDays = Math.max(0, Math.round((cappedEnd.getTime() - anchor.getTime()) / DAY_MS));
  return {
    totalDays,
    billableDays: Math.max(1, countBillableDays(start, cappedEnd)),
    months,
    extraDays,
    billableExtraDays: countBillableDays(anchor, cappedEnd),
  };
}

/** מספר ימי החיוב בהשכרה (שישי+שבת = יום אחד, מינימום 1). */
export function calcRentalDays(startDate: string, endDate: string): number {
  return calcRentalPeriod(startDate, endDate).billableDays;
}

type Rates = { day: number; first: number; second: number; week: number; month: number };

function normalizeRates(r: RentalRates): Rates {
  const day = rate(r.dayPrice);
  return {
    day,
    // שדה ריק/0 => נופל חזרה למחיר היומי השוטף
    first: rate(r.firstDayPrice) || day,
    second: rate(r.secondDayPrice) || day,
    week: rate(r.weekPrice),
    month: rate(r.monthPrice),
  };
}

function sumLines(lines: PriceLine[]): number {
  return lines.reduce((sum, l) => sum + l.amount, 0);
}

/**
 * שורות חיוב עבור n ימי חיוב. `fromStart` מפעיל את מדרגות היום הראשון/השני;
 * ימים שמגיעים אחרי חודש/שבוע מחויבים תמיד במחיר היומי השוטף.
 */
function dayLines(n: number, r: Rates, fromStart: boolean): PriceLine[] {
  if (n <= 0) return [];
  if (!fromStart || (r.first === r.day && r.second === r.day)) {
    return [{ unit: "day", qty: n, rate: r.day, amount: n * r.day }];
  }
  const lines: PriceLine[] = [
    { unit: "day", qty: 1, rate: r.first, amount: r.first, label: "יום ראשון" },
  ];
  if (n >= 2) {
    if (r.second === r.day) {
      lines.push({ unit: "day", qty: n - 1, rate: r.day, amount: (n - 1) * r.day });
    } else {
      lines.push({ unit: "day", qty: 1, rate: r.second, amount: r.second, label: "יום שני" });
      if (n > 2) lines.push({ unit: "day", qty: n - 2, rate: r.day, amount: (n - 2) * r.day });
    }
  }
  return lines;
}

/**
 * התמחור הזול ביותר ל-n ימי חיוב שקטנים מחודש: ימים בודדים, שילוב שבועות+ימים,
 * ואם בכל זאת יוצא יקר יותר מחודש שלם - גובים חודש.
 */
function cheapestFor(
  n: number,
  r: Rates,
  fromStart: boolean
): { extraMonths: number; lines: PriceLine[]; total: number } {
  if (n <= 0) return { extraMonths: 0, lines: [], total: 0 };

  let bestLines = dayLines(n, r, fromStart);
  let bestTotal = sumLines(bestLines);

  if (r.week > 0) {
    const maxWeeks = Math.ceil(n / BILLABLE_DAYS_PER_WEEK);
    for (let w = 1; w <= maxWeeks; w++) {
      const leftover = Math.max(0, n - w * BILLABLE_DAYS_PER_WEEK);
      const lines: PriceLine[] = [
        { unit: "week", qty: w, rate: r.week, amount: w * r.week },
        ...dayLines(leftover, r, false),
      ];
      const total = sumLines(lines);
      if (total < bestTotal) {
        bestTotal = total;
        bestLines = lines;
      }
    }
  }

  if (r.month > 0 && r.month < bestTotal) {
    return { extraMonths: 1, lines: [], total: r.month };
  }
  return { extraMonths: 0, lines: bestLines, total: bestTotal };
}

const UNIT_LABEL: Record<PriceLine["unit"], [string, string]> = {
  month: ["חודש", "חודשים"],
  week: ["שבוע", "שבועות"],
  day: ["יום", "ימים"],
};

export function formatBreakdown(lines: PriceLine[]): string {
  if (!lines.length) return "";
  return lines
    .map((l) => {
      const [single, plural] = UNIT_LABEL[l.unit];
      const label = l.label ?? (l.qty === 1 ? single : `${l.qty} ${plural}`);
      return `${label} × ${roundPrice(l.rate).toLocaleString()} ₪`;
    })
    .join(" + ");
}

/** "חודש ו-3 ימים" / "חודשיים" / "5 ימים" - משך ההשכרה בלוח השנה. */
export function formatPeriodLabel(months: number, extraDays: number): string {
  const parts: string[] = [];
  if (months === 1) parts.push("חודש");
  else if (months === 2) parts.push("חודשיים");
  else if (months > 2) parts.push(`${months} חודשים`);
  if (extraDays === 1) parts.push("יום אחד");
  else if (extraDays > 1) parts.push(`${extraDays} ימים`);
  if (!parts.length) return "יום אחד";
  return parts.join(" ו-");
}

const EMPTY_QUOTE: RentalQuote = {
  totalDays: 0,
  billableDays: 0,
  months: 0,
  weeks: 0,
  days: 0,
  lines: [],
  total: 0,
  breakdown: "",
  periodLabel: "",
};

/**
 * החישוב המרכזי: מחיר השכרה לפי טווח תאריכים ומחירון הפריט.
 * משמש גם למחשבים ניידים וגם לסטיקים, בכל הסניפים.
 */
export function calcQuote(startDate: string, endDate: string, rates: RentalRates): RentalQuote {
  const r = normalizeRates(rates);
  const period = calcRentalPeriod(startDate, endDate);
  if (period.totalDays <= 0) return EMPTY_QUOTE;

  // חודשים קלנדריים שלמים נספרים רק אם הוגדר מחיר חודשי לפריט.
  const wholeMonths = r.month > 0 ? period.months : 0;
  // כשההשכרה קצרה מחודש - כל התקופה היא "יתרת הימים" (עם רצפה של יום חיוב אחד).
  const remainderDays = wholeMonths > 0 ? period.billableExtraDays : period.billableDays;
  const remainder = cheapestFor(remainderDays, r, wholeMonths === 0);

  const months = wholeMonths + remainder.extraMonths;
  const lines: PriceLine[] = [];
  if (months > 0) lines.push({ unit: "month", qty: months, rate: r.month, amount: months * r.month });
  lines.push(...remainder.lines);

  return {
    totalDays: period.totalDays,
    billableDays: period.billableDays,
    months,
    weeks: lines.filter((l) => l.unit === "week").reduce((s, l) => s + l.qty, 0),
    days: lines.filter((l) => l.unit === "day").reduce((s, l) => s + l.qty, 0),
    lines,
    total: roundPrice(sumLines(lines)),
    breakdown: formatBreakdown(lines),
    periodLabel: formatPeriodLabel(period.months, period.extraDays),
  };
}

/** מחיר השכרת מחשב נייד לפי מחירון יום/שבוע/חודש. */
export function calcRentalQuote(params: {
  startDate: string;
  endDate: string;
  dayPrice: number;
  weekPrice?: number;
  monthPrice?: number;
}): RentalQuote {
  return calcQuote(params.startDate, params.endDate, {
    dayPrice: params.dayPrice,
    weekPrice: params.weekPrice,
    monthPrice: params.monthPrice,
  });
}

export type StickPriceRates = {
  day1: number;
  day2: number;
  day3plus: number;
  weekPrice?: number;
  monthPrice?: number;
};

/**
 * מחיר השכרת סטיק: יום ראשון, יום שני, וכל יום נוסף במחיר השוטף -
 * ובנוסף מדרגות שבוע/חודש אם הוגדרו לסטיק.
 */
export function calcStickQuote(
  startDate: string,
  endDate: string,
  rates: StickPriceRates
): RentalQuote {
  // day3plus הוא המחיר היומי השוטף; אם לא הוזן, נופלים חזרה ליום השני ואז לראשון.
  const ongoing = rate(rates.day3plus) || rate(rates.day2) || rate(rates.day1);
  return calcQuote(startDate, endDate, {
    dayPrice: ongoing,
    firstDayPrice: rates.day1,
    secondDayPrice: rates.day2,
    weekPrice: rates.weekPrice,
    monthPrice: rates.monthPrice,
  });
}

/**
 * מחירון המחשב לפי הווריאנט שנבחר בהשכרה: "עם סטיק" (ברירת מחדל) או "בלי סטיק".
 * שדה "בלי סטיק" שהושאר ריק נופל חזרה למחיר הרגיל של אותה מדרגה.
 */
export function laptopRatesFor(
  laptop: {
    dayPrice: number;
    weekPrice?: number;
    monthPrice?: number;
    altPricing?: boolean;
    noInternetDayPrice?: number;
    noInternetWeekPrice?: number;
    noInternetMonthPrice?: number;
  },
  variant: "normal" | "noInternet" | undefined
): { dayPrice: number; weekPrice: number; monthPrice: number } {
  const useAlt = variant === "noInternet" && !!laptop.altPricing;
  return {
    dayPrice: (useAlt ? rate(laptop.noInternetDayPrice) : 0) || rate(laptop.dayPrice),
    weekPrice: (useAlt ? rate(laptop.noInternetWeekPrice) : 0) || rate(laptop.weekPrice),
    monthPrice: (useAlt ? rate(laptop.noInternetMonthPrice) : 0) || rate(laptop.monthPrice),
  };
}
