/**
 * עלות ההוספה של מחשב לסניף השכרות (`n_laptop_cost_rates`) — מודול טהור.
 *
 * השאלה שהוא עונה עליה היא "כמה השקעתי בסניף", ולא "כמה הוצאנו בעסק": כל מחשב שנרשם בסניף —
 * גם אלה שכבר היו רשומים לפני שהמודול נולד — נזקף אוטומטית כהוצאה של הבעלים, בחודש שנוסף,
 * לפי המחיר שהיה בתוקף ביום שנוסף. היא נכנסת רק ל"ההוצאות שלי" / "ששילמתי בפועל" של הסניף
 * (`/dashboard/rentals/accounting`); **לא** לספר הראשי, לא להתחשבנות מול השותף (הבעלים שילם
 * והחוב כולו עליו, אז אין מה לקזז), ולא לרווח התפעולי במעקב (היא רכש, לא תפעול).
 *
 * עדכון מחיר = גרסה חדשה עם תאריך `from`. מחשב שנוסף לפני העדכון לא משתנה.
 */
import type { Branch, Laptop, LaptopCostRate } from "@ultranet/shared-types";

export const LAPTOP_COST_RATES_COLLECTION = "n_laptop_cost_rates";

export type LaptopCostKind = LaptopCostRate["kind"];

export const LAPTOP_COST_KIND_LABELS: Record<LaptopCostKind, string> = {
  standard: "מחשב רגיל",
  graphics: "מחשב גרפיקה",
};

/** השורות שמוצעות בגרסה הראשונה — אפשר לשנות, להוסיף ולמחוק. */
export const DEFAULT_COST_ITEM_LABELS = ["מחשב", "מטען", "תיק מחשב", "סטיק", "סים"];

export function laptopCostKind(l: Pick<Laptop, "isGraphics">): LaptopCostKind {
  return l.isGraphics ? "graphics" : "standard";
}

/** הגרסאות של סוג אחד, מהישנה לחדשה. */
export function ratesOfKind(rates: LaptopCostRate[], kind: LaptopCostKind): LaptopCostRate[] {
  return rates.filter((r) => r.kind === kind).sort((a, b) => a.from.localeCompare(b.from));
}

/** הגרסה שבתוקף בתאריך `date` (YYYY-MM-DD). לפני הגרסה הראשונה — הראשונה. אין גרסאות — null. */
export function rateAt(rates: LaptopCostRate[], kind: LaptopCostKind, date: string): LaptopCostRate | null {
  const list = ratesOfKind(rates, kind);
  if (list.length === 0) return null;
  let found: LaptopCostRate = list[0]!;
  for (const r of list) if (r.from <= date) found = r;
  return found;
}

/**
 * היום שבו המחשב "נוסף" לצורך העלות: `addedDate` כשיש; למחשב ותיק שנרשם בלי תאריך — תאריך
 * הפתיחה של הסניף, ואחריו ההשכרה הראשונה של המחשב. בלי אף אחד מהם — null: המחשב לא נזקף,
 * ומסך "עלות להוספה" מציג אותו ברשימת "מחשבים בלי תאריך הוספה" עם כפתור לקבוע להם תאריך.
 * **לא** נופלים ל"היום": תאריך שזז כל יום היה מזיז את השורה לחודש הנוכחי בכל חודש מחדש.
 */
export function laptopCostDate(
  l: Pick<Laptop, "addedDate">,
  branch: Pick<Branch, "openedAt" | "founded"> | undefined,
  firstRentalDate?: string,
): string | null {
  const raw = l.addedDate || branch?.openedAt || branch?.founded || firstRentalDate;
  return raw ? raw.slice(0, 10) : null;
}

export interface LaptopCostLine {
  laptopId: string;
  laptopName: string;
  kind: LaptopCostKind;
  date: string;
  month: string;
  amount: number;
}

/**
 * שורת עלות לכל מחשב בסניף — כולל מחשבים שנמכרו או הוצאו: ההשקעה בהם כבר נעשתה.
 * `firstRentalByLaptop` — תאריך ההשכרה הראשונה של כל מחשב, לנפילה של מחשב ותיק בלי תאריך.
 */
export function laptopCostLines(
  laptops: Laptop[],
  branch: Pick<Branch, "openedAt" | "founded"> | undefined,
  rates: LaptopCostRate[],
  firstRentalByLaptop?: Map<string, string>,
): LaptopCostLine[] {
  const lines: LaptopCostLine[] = [];
  if (rates.length === 0) return lines;
  for (const l of laptops) {
    const kind = laptopCostKind(l);
    const date = laptopCostDate(l, branch, firstRentalByLaptop?.get(l.id));
    if (!date) continue;
    const rate = rateAt(rates, kind, date);
    if (!rate || !(rate.total > 0)) continue;
    lines.push({ laptopId: l.id, laptopName: l.name, kind, date, month: date.slice(0, 7), amount: rate.total });
  }
  return lines;
}

export function sumCostItems(items: { amount: number }[]): number {
  return Math.round(items.reduce((s, i) => s + (Number.isFinite(i.amount) ? i.amount : 0), 0) * 100) / 100;
}
