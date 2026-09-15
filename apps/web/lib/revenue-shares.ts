/**
 * אחוזים שאני מעביר החוצה — הסדרים שבהם חלק מהברוטו של ההשכרות שייך למישהו אחר.
 *
 * שני סוגים, מודל אחד:
 *  - **פר-סניף** — אחוז מכל ההשכרות של סניף מסוים, **החל מתאריך מסוים**
 *    (אלישבע רומנו, 30% מהסניף הראשי, מ-23/08). מוגדר כאן, ב-`BRANCH_REVENUE_SHARES`.
 *  - **פר-מחשב** — אחוז מהשכרות של מחשבים מסוימים, מהיום הראשון שהם הושכרו
 *    (שלמה גולדשמידט, 15% על 76-79). מוגדר על המחשב עצמו ב-`n_laptops`
 *    (`hasPartner` / `partnerName` / `partnerPct`) ולא כאן, כי זה נתון שמשתנה
 *    כשקונים או מוכרים מחשב.
 *
 * הכסף הזה מעולם לא היה שלי, ולכן הוא מתנהג בשני המקומות כמו שהוא:
 *  1. **יורד מהרווח שלי** בכל מסך שמציג רווח (`computeBranchFinancials`, ומשם
 *     הנה"ח ההשכרות ומעקב הסניפים; ובספר הראשי דרך `lib/tx-data.ts`).
 *  2. **מופיע כחוב מצטבר** ב-`/dashboard/accounting/transfers`, בדיוק כמו התחשבנות
 *     מול סניף: חודש שלא סימנתי שהעברתי בו נשאר ביתרה עד שיסומן.
 *
 * הברוטו כאן הוא הברוטו של הסניף — לא החלק שלי בו. אחוז לאדם שמתפעל את המחשבים
 * נגזר מכל הכסף שנכנס, לא ממה שנשאר לי אחרי התחשבנות עם שותף.
 */
import type { Branch, Laptop, Rental, Stick } from "@ultranet/shared-types";
import { roundPrice } from "./rental-pricing";

/** הסדר אחוזים פר-סניף. */
export interface BranchRevenueShare {
  /** למי אני מעביר. זה גם המפתח של היתרה המצטברת ב-`n_partner_payouts`. */
  personName: string;
  /** אחוז מהברוטו של הסניף. */
  pct: number;
  /**
   * ISO date. **נספר פר-השכרה ולא פר-חודש**: הסדר שמתחיל ב-23/08 לא לוקח אחוז
   * מהשכרה שנסגרה ב-22/08, וגם לא מחודש אוגוסט כולו. חודש ההתחלה מתחלק.
   */
  startDate: string;
  /** ISO date (רשות) — היום האחרון שנספר, כשההסדר הסתיים. */
  endDate?: string;
  /**
   * איזה סניף. `branchId` מנצח כשהוא מלא; אחרת מתאימים לפי שם, בין סניפי ההשכרות
   * שלי בלבד. השם של הסניף שנתפס בפועל מוצג במסכים, כדי שטעות התאמה תיראה מיד
   * ולא תתגלה בסוף החודש.
   */
  branchId?: string;
  branchNameIncludes?: string;
}

/**
 * ההסדרים הפעילים.
 *
 * אלישבע רומנו מתפעלת את המחשבים של הסניף הראשי ומקבלת 30% מהברוטו שלו.
 * קדם לזה חישוב אנונימי בשם "חלק המזכירה" שרץ על כל הסניפים שלי ועל כל החודשים
 * מאז ומעולם; הוא הוחלף בהסדר הזה — עם שם, עם סניף אחד, ועם תאריך התחלה.
 */
export const BRANCH_REVENUE_SHARES: BranchRevenueShare[] = [
  {
    personName: "אלישבע רומנו",
    pct: 30,
    startDate: "2026-08-23",
    branchNameIncludes: "ראשי",
  },
];

/** האם הסניף בכלל יכול לשאת הסדר פר-סניף: סניף השכרות חי שהוא שלי. */
function eligible(branch: Branch): boolean {
  return branch.branchType === "rentals" && branch.isMine !== false && !branch.deleted;
}

/** ההסדר שחל על הסניף הזה, אם יש. */
export function branchRevenueShareFor(branch: Branch): BranchRevenueShare | null {
  if (!eligible(branch)) return null;
  return (
    BRANCH_REVENUE_SHARES.find((s) =>
      s.branchId ? s.branchId === branch.id : !!s.branchNameIncludes && branch.name.includes(s.branchNameIncludes),
    ) ?? null
  );
}

/** כל ההסדרים הפעילים, כשהם כבר צמודים לסניף שנתפס — לתצוגה ולמסך ההעברות. */
export function resolveBranchRevenueShares(branches: Branch[]): { share: BranchRevenueShare; branch: Branch }[] {
  const out: { share: BranchRevenueShare; branch: Branch }[] = [];
  for (const branch of branches) {
    const share = branchRevenueShareFor(branch);
    if (share) out.push({ share, branch });
  }
  return out;
}

/** שורת הכנסה עם התאריך המלא שלה — בלעדיו אי אפשר לחתוך הסדר שמתחיל באמצע חודש. */
export interface DatedAmount {
  date: string;
  amount: number;
}

export interface RevenueShareAmount {
  /** הברוטו שנכנס לחישוב — רק שורות שבתוך תחום התאריכים של ההסדר */
  gross: number;
  /** מה שמגיע לו מתוכו, בשקלים שלמים */
  amount: number;
}

const EMPTY: RevenueShareAmount = { gross: 0, amount: 0 };

function withinRange(date: string, share: BranchRevenueShare): boolean {
  if (date < share.startDate) return false;
  if (share.endDate && date > share.endDate) return false;
  return true;
}

/** מה שמגיע לו על חודש בודד. */
export function revenueShareForMonth(
  lines: DatedAmount[],
  share: BranchRevenueShare | null,
  month: string,
): RevenueShareAmount {
  if (!share) return EMPTY;
  const gross = lines
    .filter((l) => !!l.date && l.date.slice(0, 7) === month && withinRange(l.date, share))
    .reduce((sum, l) => sum + l.amount, 0);
  return { gross, amount: roundPrice((gross * share.pct) / 100) };
}

/** מה שהצטבר לו עד סוף `uptoMonth` (כולל) — למאזן "עד היום". */
export function revenueShareToDate(
  lines: DatedAmount[],
  share: BranchRevenueShare | null,
  uptoMonth: string,
): RevenueShareAmount {
  if (!share) return EMPTY;
  const gross = lines
    .filter((l) => !!l.date && l.date.slice(0, 7) <= uptoMonth && withinRange(l.date, share))
    .reduce((sum, l) => sum + l.amount, 0);
  return { gross, amount: roundPrice((gross * share.pct) / 100) };
}

/** ברירת המחדל לאחוז של שותף-מחשבים, כשלא הוגדר אחר על המחשב. */
export const DEFAULT_COMPUTER_PARTNER_PCT = 15;

/**
 * שורת חוב אחת: כמה מגיע לאדם אחד, על מה, בחודש אחד.
 *
 * `kind` מפריד בין שני ההסדרים כי הם עונים על "על מה זה" אחרת — אחוז מסניף שלם
 * מול אחוז ממחשבים ספציפיים — אבל החוב עצמו הוא אותו חוב, ולכן הוא זורם לאותה
 * טבלה מצטברת.
 */
export interface RevenueShareLine {
  personName: string;
  pct: number;
  branchId: string;
  kind: "branch" | "computers";
  /** שמות המחשבים (`computers`) או שם הסניף (`branch`) — מה שמוצג בעמודת "על מה" */
  subjects: string[];
  rentalCount: number;
  gross: number;
  amount: number;
  /**
   * שותפות פר-מחשב שסומנה בלי למלא שם.
   *
   * חוב בלי נושה הוא לא חוב — אי אפשר להעביר אותו לאף אחד, ואי אפשר לדעת אם הוא
   * הסדר אמיתי שרק חסר לו שם או שריד של הגדרה ישנה שנשכחה על המחשב. עד עכשיו
   * הוא פשוט קיבל שם מומצא ("שותף ללא שם") והתיישב בטבלת ההעברות כאילו הוא אדם.
   * הסכום ממשיך לרדת מהרווח כמו קודם — אבל הוא מסומן, והמסך אומר את זה בקול.
   */
  unnamed?: boolean;
}

/** שם שמוצג לשותפות פר-מחשב שלא מילאו בה שם. משמש גם כמפתח היתרה ב-`n_partner_payouts`. */
export const UNNAMED_PARTNER = "שותף ללא שם";

/** האם ההשכרה היא כסף שמישהו באמת מחזיק: הוחזרה **וגם** שולמה. */
export function countsAsCollected(r: Pick<Rental, "status" | "returnDate" | "paid">): boolean {
  return r.status === "returned" && !!r.returnDate && !!r.paid;
}

/**
 * האחוזים הפר-מחשביים של חודש אחד, מקובצים לפי (סניף, אדם, אחוז).
 *
 * פונקציה טהורה בכוונה: גם `computeBranchFinancials` (שקורא מ-`raw` שכבר נטען) וגם
 * `computePartnerSettlement` (שקורא מ-Firestore ישירות) חייבים להגיע בדיוק לאותו
 * מספר. שני חישובים מקבילים לאותה שאלה הם בדיוק מה שהפרויקט הזה מנקה.
 *
 * אין כאן תאריך התחלה: שותפות פר-מחשב נספרת מהיום הראשון שהמחשב הושכר, וזה בדיוק
 * מה שקורה כשסופרים את כל ההשכרות שלו.
 */
export function computerRevenueShareLines(
  laptops: Laptop[],
  sticks: Pick<Stick, "id" | "linkedLaptopId">[],
  rentals: Pick<Rental, "status" | "returnDate" | "paid" | "kind" | "itemId" | "finalPrice" | "calcPrice">[],
  /** אילו חודשים נספרים. חודש בודד (`(m) => m === month`) לשורת החוב של אותו חודש,
   *  או טווח פתוח (`(m) => m <= upto`) למאזן "עד היום". */
  inMonth: (month: string) => boolean,
): RevenueShareLine[] {
  const partnered = laptops.filter((l) => l.hasPartner);
  if (partnered.length === 0) return [];
  const laptopById = new Map(partnered.map((l) => [l.id, l]));

  const stickToLaptop = new Map<string, Laptop>();
  for (const s of sticks) {
    const laptop = s.linkedLaptopId ? laptopById.get(s.linkedLaptopId) : undefined;
    if (laptop) stickToLaptop.set(s.id, laptop);
  }

  const lines = new Map<string, RevenueShareLine>();
  for (const r of rentals) {
    if (!countsAsCollected(r)) continue;
    if (!inMonth((r.returnDate as string).slice(0, 7))) continue;
    const laptop = r.kind === "laptop" ? laptopById.get(r.itemId) : stickToLaptop.get(r.itemId);
    if (!laptop) continue;

    const pct = laptop.partnerPct ?? DEFAULT_COMPUTER_PARTNER_PCT;
    const named = laptop.partnerName?.trim();
    const personName = named || UNNAMED_PARTNER;
    const key = `${laptop.branchId}|${personName}|${pct}`;
    let line = lines.get(key);
    if (!line) {
      line = {
        personName,
        pct,
        branchId: laptop.branchId,
        kind: "computers",
        subjects: [],
        rentalCount: 0,
        gross: 0,
        amount: 0,
        ...(named ? {} : { unnamed: true }),
      };
      lines.set(key, line);
    }
    if (!line.subjects.includes(laptop.name)) line.subjects.push(laptop.name);
    line.rentalCount += 1;
    line.gross += roundPrice(r.finalPrice ?? r.calcPrice ?? 0);
  }

  for (const line of lines.values()) {
    // שקלים שלמים בלבד - אין אגורות בשום סכום במודול ההשכרות.
    line.amount = roundPrice((line.gross * line.pct) / 100);
  }
  return [...lines.values()];
}

/** שורת החוב הפר-סניפית של חודש אחד, אם ההסדר קיים והיה בו כסף. */
export function branchRevenueShareLine(
  branch: Branch,
  incomeLines: DatedAmount[],
  month: string,
): RevenueShareLine | null {
  const share = branchRevenueShareFor(branch);
  if (!share) return null;
  const inRange = incomeLines.filter(
    (l) => !!l.date && l.date.slice(0, 7) === month && withinRange(l.date, share),
  );
  if (inRange.length === 0) return null;
  const { gross, amount } = revenueShareForMonth(incomeLines, share, month);
  return {
    personName: share.personName,
    pct: share.pct,
    branchId: branch.id,
    kind: "branch",
    subjects: [branch.name],
    rentalCount: inRange.length,
    gross,
    amount,
  };
}
