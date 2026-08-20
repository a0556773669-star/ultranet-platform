/**
 * תמחור השכרות - חישוב מדויק, תמיד בשקלים שלמים (ללא אגורות).
 *
 * המודל:
 * 1. סופרים **חודשים קלנדריים שלמים** מתאריך ההתחלה: 12/07 -> 12/08 = חודש אחד.
 * 2. את יתרת הימים סופרים כ"ימי חיוב": **שישי ושבת נחשבים יחד כיום אחד**
 *    (שבת לא נספרת בנפרד).
 * 3. יתרת הימים מתומחרת בשילוב הזול ביותר של שבועות/ימים - אך לעולם לא יותר
 *    ממחיר חודש שלם.
 *
 * דוגמה: 12/07 עד 15/08, מחיר חודש 550 ומחיר יום 50 => חודש + 3 ימים = 700 ש"ח
 * (אם באותם ימים נופלת שבת - היא נבלעת ביום שישי ולא מחויבת בנפרד).
 *
 * אין כאן שום חישוב יחסי (פרו-רטה) שיוצר שברים - כל תוצאה מעוגלת לשקל שלם.
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
};

export type RentalQuote = {
  /** סה"כ ימים קלנדריים בהשכרה (מינימום 1) */
  totalDays: number;
  months: number;
  weeks: number;
  days: number;
  lines: PriceLine[];
  /** סה"כ לתשלום - תמיד מספר שלם */
  total: number;
  /** תיאור קריא בעברית, למשל: "חודש × 550 ₪ + 3 ימים × 50 ₪" */
  breakdown: string;
  /** משך ההשכרה בלשון בני אדם, למשל: "חודש ו-3 ימים" */
  periodLabel: string;
};

/** מעגל לשקל שלם - אין אגורות/חצאים במערכת. */
export function roundPrice(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
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

function rate(value: number | undefined): number {
  return value && value > 0 ? roundPrice(value) : 0;
}

/**
 * התמחור הזול ביותר ליתרת ימים (פחות מחודש): שילוב שבועות/ימים,
 * ואם בכל זאת יצא יקר יותר מחודש שלם - גובים חודש.
 */
function priceRemainder(
  billableDays: number,
  dayPrice: number,
  weekPrice: number,
  monthPrice: number
): { months: number; weeks: number; days: number; total: number } {
  if (billableDays <= 0) return { months: 0, weeks: 0, days: 0, total: 0 };

  let best = { months: 0, weeks: 0, days: billableDays, total: billableDays * dayPrice };
  if (weekPrice > 0) {
    const maxWeeks = Math.ceil(billableDays / BILLABLE_DAYS_PER_WEEK);
    for (let w = 1; w <= maxWeeks; w++) {
      const leftover = Math.max(0, billableDays - w * BILLABLE_DAYS_PER_WEEK);
      const total = w * weekPrice + leftover * dayPrice;
      if (total < best.total) best = { months: 0, weeks: w, days: leftover, total };
    }
  }
  if (monthPrice > 0 && monthPrice < best.total) {
    best = { months: 1, weeks: 0, days: 0, total: monthPrice };
  }
  return best;
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
      const label = l.qty === 1 ? single : `${l.qty} ${plural}`;
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

function buildQuote(
  totalDays: number,
  periodLabel: string,
  months: number,
  weeks: number,
  days: number,
  dayPrice: number,
  weekPrice: number,
  monthPrice: number
): RentalQuote {
  const lines: PriceLine[] = [];
  if (months > 0) lines.push({ unit: "month", qty: months, rate: monthPrice, amount: months * monthPrice });
  if (weeks > 0) lines.push({ unit: "week", qty: weeks, rate: weekPrice, amount: weeks * weekPrice });
  if (days > 0) lines.push({ unit: "day", qty: days, rate: dayPrice, amount: days * dayPrice });
  const total = roundPrice(lines.reduce((sum, l) => sum + l.amount, 0));
  return { totalDays, periodLabel, months, weeks, days, lines, total, breakdown: formatBreakdown(lines) };
}

/**
 * חישוב מחיר השכרת מחשב לפי טווח התאריכים ומחירון היום/שבוע/חודש של הפריט.
 */
export function calcRentalQuote(params: {
  startDate: string;
  endDate: string;
  dayPrice: number;
  weekPrice?: number;
  monthPrice?: number;
}): RentalQuote {
  const dayPrice = rate(params.dayPrice);
  const weekPrice = rate(params.weekPrice);
  const monthPrice = rate(params.monthPrice);
  const period = calcRentalPeriod(params.startDate, params.endDate);
  if (period.totalDays <= 0) {
    return { totalDays: 0, months: 0, weeks: 0, days: 0, lines: [], total: 0, breakdown: "", periodLabel: "" };
  }
  const periodLabel = formatPeriodLabel(period.months, period.extraDays);

  // אין מחיר חודשי מוגדר -> מתמחרים את כל התקופה בשבועות/ימים.
  if (monthPrice <= 0) {
    const r = priceRemainder(period.billableDays, dayPrice, weekPrice, 0);
    return buildQuote(period.totalDays, periodLabel, 0, r.weeks, r.days, dayPrice, weekPrice, monthPrice);
  }

  // כשההשכרה קצרה מחודש, יתרת הימים היא כל התקופה (עם רצפה של יום חיוב אחד).
  const remainderDays = period.months > 0 ? period.billableExtraDays : period.billableDays;
  const r = priceRemainder(remainderDays, dayPrice, weekPrice, monthPrice);
  return buildQuote(
    period.totalDays,
    periodLabel,
    period.months + r.months,
    r.weeks,
    r.days,
    dayPrice,
    weekPrice,
    monthPrice
  );
}

/**
 * תמחור מדורג לסטיק: יום ראשון, יום שני, וכל יום נוסף מהשלישי ואילך.
 */
export function calcStickQuote(days: number, day1: number, day2: number, day3plus: number): RentalQuote {
  const n = Math.max(1, Math.min(Math.round(days), MAX_DAYS));
  const d1 = roundPrice(day1 || 0);
  const d2 = roundPrice(day2 || 0);
  const d3 = roundPrice(day3plus || 0);
  const lines: PriceLine[] = [{ unit: "day", qty: 1, rate: d1, amount: d1 }];
  if (n >= 2) lines.push({ unit: "day", qty: 1, rate: d2, amount: d2 });
  if (n > 2) lines.push({ unit: "day", qty: n - 2, rate: d3, amount: (n - 2) * d3 });
  const total = roundPrice(lines.reduce((sum, l) => sum + l.amount, 0));
  const breakdown = lines
    .map((l, i) =>
      i === 0
        ? `יום ראשון ${l.rate.toLocaleString()} ₪`
        : i === 1
          ? `יום שני ${l.rate.toLocaleString()} ₪`
          : `${l.qty} ימים × ${l.rate.toLocaleString()} ₪`
    )
    .join(" + ");
  return {
    totalDays: n,
    periodLabel: formatPeriodLabel(0, n),
    months: 0,
    weeks: 0,
    days: n,
    lines,
    total,
    breakdown,
  };
}

export function calcStickPrice(days: number, day1: number, day2: number, day3plus: number): number {
  if (days <= 0) return 0;
  return calcStickQuote(days, day1, day2, day3plus).total;
}
