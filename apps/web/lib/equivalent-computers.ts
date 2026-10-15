/**
 * **מחשבים שקולים בחודש** ו**אחוז ניצול** — עזר לקריאה בלבד (אפיון שדרוג v2 סעיף 5, ופריט 45).
 *
 * ⚠ לא מחובר לשום חישוב קיים. רווח למחשב ב-`laptop-branch-tracking.ts` / `branch-accounting` עדיין
 * סופר מחשבים לפי `laptopActiveInMonth` (חודש שלם לכל מחשב שהיה בסניף בחודש). המעבר למכנה
 * היחסי ממתין להחלטה עסקית נפרדת — אין לחבר את הקובץ הזה למספרים קיימים בלי ההחלטה הזו.
 *
 * ── ההגדרה ──
 * מחשבים שקולים בחודש = Σ (לכל מחשב) ימי זכאות וזמינות בחודש ÷ מספר ימי החודש.
 *
 * ── גבולות יום (כל התקופות חצי-פתוחות: [התחלה, סוף) ) ──
 * - יום = תאריך קלנדרי YYYY-MM-DD, בלי שעות ובלי אזור זמן.
 * - `addedDate`: המחשב זכאי **החל מ**יום ההוספה (כולל). בלי `addedDate` — זכאי מתחילת החודש.
 * - `endedAt` (נמכר/הוצא): יום היציאה **לא** נספר — המחשב יצא באותו יום. בלי `endedAt` — עד סוף החודש.
 *   (שימו לב: זה שונה בכוונה מ-`laptopActiveInMonth`, שסופר את חודש היציאה כולו.)
 * - תיקון `from`/`to` (`n_laptop_repairs`): המחשב **לא זמין** מיום `from` (כולל) ועד יום `to`
 *   (לא כולל) — ביום החזרה הוא כבר זמין. תיקון פתוח (בלי `to`) = לא זמין עד סוף החודש.
 * - תקופות תיקון חופפות של אותו מחשב לא נספרות פעמיים: הספירה היא לפי ימים (איחוד), לא לפי תקופות.
 * - מחשב פנוי שלא הושכר נחשב זמין — לא מוציאים אותו מהמכנה.
 * - סכום 0 = "לא ניתן לחשב" → מוחזר `null`, לא 0.
 *
 * ── בדיקה עצמית (ספטמבר 2026, 30 ימים) ──
 *   9 מחשבים בלי addedDate/endedAt/תיקון → 9 × 30 = 270 ימים
 *   מחשב 10 עם addedDate = "2026-09-16" → ימים 16..30 = 15 ימים
 *   (270 + 15) / 30 = 9.5  ✓   רווח 1,425 ₪ ÷ 9.5 = 150 ₪ למחשב.
 *   אותו חישוב אם המחשב העשירי היה בתיקון from "2026-09-01" to "2026-09-16": 15 ימים זמינים → 9.5.
 *
 * ── אחוז ניצול (פריט 45) ──
 * ימי השכרה ÷ ימי זמינות, לפי אותם ימים בדיוק. השכרת `laptop` תופסת את [startDate, returnDate)
 * (ביום ההחזרה המחשב פנוי שוב; השכרה שהוחזרה באותו יום נספרת כיום אחד), השכרה פעילה — עד סוף
 * החודש. נספרים רק ימים שבהם המחשב זמין (לא בתיקון, זכאי), כאיחוד — השכרות חופפות לא נספרות
 * פעמיים. זו **לא** ספירת ימי חיוב (שישי/שבת וכו'). מכנה 0 → `null`. השכרה חסרה בהיסטוריה לא
 * משוחזרת — הניצול מחושב רק ממה שקיים ב-`n_rentals`.
 */
import type { Laptop, LaptopRepair, Rental } from "@ultranet/shared-types";

type LaptopLite = Pick<Laptop, "id" | "addedDate" | "endedAt">;
type RepairLite = Pick<LaptopRepair, "laptopId" | "from" | "to">;
type RentalLite = Pick<Rental, "itemId" | "kind" | "startDate" | "returnDate" | "endDate" | "status">;

const DAY_MS = 86_400_000;

function dayIndex(date: string): number {
  return Math.floor(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

/** [first, endExclusive) של החודש, כאינדקסי יום. */
function monthRange(month: string): { first: number; end: number; days: number } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const first = Math.floor(Date.UTC(y, m - 1, 1) / DAY_MS);
  const end = Math.floor(Date.UTC(y, m, 1) / DAY_MS);
  return { first, end, days: end - first };
}

/** מסמן ב-`mask` (באורך ימי החודש) את הימים של [from, to) שבתוך החודש. */
function mark(mask: boolean[], first: number, end: number, from: number, to: number) {
  const a = Math.max(first, from);
  const b = Math.min(end, to);
  for (let d = a; d < b; d++) mask[d - first] = true;
}

/** לכל מחשב: מסכת הימים בחודש שבהם הוא זכאי וזמין (לא לפני הוספה, לא אחרי יציאה, לא בתיקון). */
function availabilityMasks(laptops: LaptopLite[], repairs: RepairLite[], month: string) {
  const { first, end, days } = monthRange(month);
  const repairsByLaptop = new Map<string, RepairLite[]>();
  for (const r of repairs) (repairsByLaptop.get(r.laptopId) ?? repairsByLaptop.set(r.laptopId, []).get(r.laptopId)!).push(r);
  const masks = new Map<string, boolean[]>();
  for (const l of laptops) {
    const eligible = new Array<boolean>(days).fill(false);
    mark(eligible, first, end, l.addedDate ? dayIndex(l.addedDate) : first, l.endedAt ? dayIndex(l.endedAt) : end);
    const inRepair = new Array<boolean>(days).fill(false);
    for (const r of repairsByLaptop.get(l.id) ?? []) {
      mark(inRepair, first, end, dayIndex(r.from), r.to ? dayIndex(r.to) : end);
    }
    masks.set(
      l.id,
      eligible.map((e, i) => e && !inRepair[i]),
    );
  }
  return { masks, days, first, end };
}

export interface EquivalentComputers {
  month: string;
  daysInMonth: number;
  /** Σ ימי זמינות של כל המחשבים */
  availableDays: number;
  /** availableDays ÷ daysInMonth; `null` = אין אף יום זמין — "לא ניתן לחשב" */
  equivalent: number | null;
  /** ימי זמינות לכל מחשב */
  perLaptop: Map<string, number>;
}

/**
 * מחשבים שקולים בחודש `month` (YYYY-MM). `laptops` = המחשבים של הסניף (כולל כאלה שנמכרו/הוצאו —
 * הם נספרים עד יום היציאה). `repairs` = תקופות התיקון שלהם.
 */
export function equivalentComputersInMonth(
  laptops: LaptopLite[],
  repairs: RepairLite[],
  month: string,
): EquivalentComputers {
  const { masks, days } = availabilityMasks(laptops, repairs, month);
  const perLaptop = new Map<string, number>();
  let availableDays = 0;
  for (const [id, mask] of masks) {
    const n = mask.filter(Boolean).length;
    perLaptop.set(id, n);
    availableDays += n;
  }
  return { month, daysInMonth: days, availableDays, equivalent: availableDays > 0 ? availableDays / days : null, perLaptop };
}

export interface Utilization {
  month: string;
  availableDays: number;
  rentedDays: number;
  /** rentedDays ÷ availableDays (0..1); `null` = מכנה 0, "לא ניתן לחשב" */
  ratio: number | null;
}

/** אחוז ניצול בחודש — ראו הכללים בראש הקובץ. נפרד לחלוטין מרווחיות. */
export function utilizationInMonth(
  laptops: LaptopLite[],
  repairs: RepairLite[],
  rentals: RentalLite[],
  month: string,
): Utilization {
  const { masks, days, first, end } = availabilityMasks(laptops, repairs, month);
  const rentalsByLaptop = new Map<string, RentalLite[]>();
  for (const r of rentals) {
    if (r.kind !== "laptop" || !r.startDate) continue;
    (rentalsByLaptop.get(r.itemId) ?? rentalsByLaptop.set(r.itemId, []).get(r.itemId)!).push(r);
  }
  let availableDays = 0;
  let rentedDays = 0;
  for (const [id, available] of masks) {
    const rented = new Array<boolean>(days).fill(false);
    for (const r of rentalsByLaptop.get(id) ?? []) {
      const start = dayIndex(r.startDate);
      const back = r.returnDate ?? r.endDate;
      const stop = r.status === "active" || !back ? end : Math.max(dayIndex(back), start + 1);
      mark(rented, first, end, start, stop);
    }
    for (let i = 0; i < days; i++) {
      if (!available[i]) continue;
      availableDays++;
      if (rented[i]) rentedDays++;
    }
  }
  return { month, availableDays, rentedDays, ratio: availableDays > 0 ? rentedDays / availableDays : null };
}
