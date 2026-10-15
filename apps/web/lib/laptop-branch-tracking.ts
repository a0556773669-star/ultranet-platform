/**
 * מעקב סניפי ניידים — רווח פר מחשב, חודש-חודש, לכל הסניפים במסך אחד.
 *
 * הטבלה הקיימת (`ComputerProfitTable`) ענתה על השאלה הזו לסניף בודד. השאלה שנשאלת
 * בפועל היא אחרת: איזה סניף מרוויח לי כמה על כל מחשב, ומתי זה השתנה - וזו שאלה שאי
 * אפשר לענות עליה מסתכלים על סניף אחד בכל פעם. לכן כאן החודשים הם עמודות, הסניפים
 * הם שורות, וחודש שבו הסניף עדיין לא היה קיים נשאר ריק ולא אפס: "לא היה" ו"היה ולא
 * הרוויח" הן שתי תשובות שונות, ואפס היה מוחק את ההבדל.
 *
 * החישוב עצמו נשען על מה שכבר קיים: `computeBranchFinancials` יודע את הרווח של הבעלים
 * לחודש, ו-`laptopActiveInMonth` יודע כמה מחשבים היו באותו חודש (לפי `addedDate` ו-`endedAt` של כל
 * מחשב) - כך שמחשב שנוסף באמצע הדרך מחלק את הרווח רק מהחודש שנוסף בו.
 *
 * **המונה כאן הוא `ownerOperatingProfitThisMonth` ולא `ownerNetProfitThisMonth`**: שורה
 * שהבעלים שילם והחוב כולה עליו היא רכש, לא עלות תפעול. בלי ההוצאה הזו מהמדד, חודש שנקנו
 * בו שני מחשבים היה נראה כמו חודש הפסד בסניף שתפקד בדיוק כרגיל - וזו בדיוק השאלה שהטבלה
 * הזו לא רוצה לענות עליה. "כמה יצא לי מהכיס" נשאלת במקום אחר.
 */
import type { Branch } from "@ultranet/shared-types";
import {
  computeBranchFinancials,
  currentMonth,
  type BranchAccountingRawData,
} from "./branch-accounting-data";
import { exVat, monthsBetween, PROFIT_PER_COMPUTER_TARGET } from "./branch-accounting";
import { equivalentComputersInMonth } from "./equivalent-computers";

export interface TrackingCell {
  month: string;
  /** false = הסניף לא היה קיים בחודש הזה (לפני הפתיחה / אחרי הסגירה) */
  existed: boolean;
  /** null = הסניף לא היה קיים בחודש הזה - התא נשאר ריק */
  profitPerComputer: number | null;
  /** הרווח התפעולי של הבעלים באותו חודש, בלי שורות רכש שהסניף לא לוקח בהן חלק */
  netProfit: number;
  /** מכירות מחשבים באותו חודש — 100% שלי, אבל **לא** חלק מהרווח התפעולי שבתא (מכירה היא לא
   *  השכרה, וחודש שנמכר בו מחשב היה נראה כמו חודש מצוין בסניף שתפקד כרגיל). מוצג בנפרד. */
  saleIncome: number;
  computerCount: number;
  isHealthy: boolean;
}

export interface TrackingRow {
  branch: Branch;
  isMineBranch: boolean;
  cells: TrackingCell[];
  /** ממוצע משוקלל של הרווח למחשב: Σ רווח ÷ Σ מחשבים שקולים, על החודשים שאפשר לחשב בהם */
  average: number | null;
  /** ממוצע הרווח הכולל (לא למחשב) על אותם חודשים */
  averageTotal: number | null;
}

export interface LaptopBranchTracking {
  months: string[];
  rows: TrackingRow[];
  target: number;
}

/** חלון של `count` חודשים שמסתיים ב-`end` (כולל). */
export function trackingWindow(end: string, count = 12): string[] {
  const [y, m] = end.split("-").map(Number);
  let sy = y ?? new Date().getFullYear();
  let sm = (m ?? 1) - (count - 1);
  while (sm < 1) {
    sm += 12;
    sy -= 1;
  }
  return monthsBetween(`${sy}-${String(sm).padStart(2, "0")}`, end);
}

/** החודש הראשון שבו הסניף נחשב קיים: `openedAt`, ובהיעדרו `founded`. */
function firstActiveMonth(branch: Branch): string | null {
  const raw = branch.openedAt || branch.founded;
  return raw ? raw.slice(0, 7) : null;
}

/** החודש האחרון שבו הסניף נחשב קיים: `closedAt`, ובהיעדרו `deletedAt`. */
function lastActiveMonth(branch: Branch): string | null {
  const raw = branch.closedAt || branch.deletedAt;
  return raw ? raw.slice(0, 7) : null;
}

export function buildLaptopBranchTracking(
  branches: Branch[],
  raw: BranchAccountingRawData,
  months: string[],
): LaptopBranchTracking {
  const rows: TrackingRow[] = branches.map((branch) => {
    const opened = firstActiveMonth(branch);
    const closed = lastActiveMonth(branch);
    const laptops = raw.laptopsByBranch.get(branch.id) ?? [];
    const repairs = raw.repairsByBranch.get(branch.id) ?? [];

    const cells: TrackingCell[] = months.map((month) => {
      const existed = !branch.notStarted && (!opened || opened <= month) && (!closed || month <= closed);
      if (!existed) {
        return {
          month,
          existed: false,
          profitPerComputer: null,
          netProfit: 0,
          saleIncome: 0,
          computerCount: 0,
          isHealthy: false,
        };
      }
      const f = computeBranchFinancials(branch, raw, month);
      // **מחשבים שקולים** (החלטת יוני, 2026-10-15; אפיון שדרוג v2 סעיף 5): לכל מחשב — ימי הזכאות
      // והזמינות שלו בחודש ÷ ימי החודש. מחשב שנוסף באמצע החודש נספר כחלק, ימי תיקון יוצאים, ויום
      // היציאה (מכירה/הוצאה) לא נספר. הכללים המדויקים: `lib/equivalent-computers.ts`.
      // עד 2026-10-15: כל מחשב שהיה בסניף ולו יום אחד בחודש נספר כמחשב שלם (`laptopActiveInMonth`).
      const equivalent = equivalentComputersInMonth(laptops, repairs, month).equivalent;
      const computerCount = equivalent ?? 0;
      // נטו בלי מע"מ — ראו `exVat` / `PROFIT_PER_COMPUTER_TARGET` ב-branch-accounting.ts.
      const netProfit = exVat(f.ownerOperatingProfitThisMonth);
      const perComputer = computerCount > 0 ? netProfit / computerCount : 0;
      return {
        month,
        existed: true,
        profitPerComputer: computerCount > 0 ? perComputer : null,
        netProfit,
        saleIncome: f.saleIncomeThisMonth,
        computerCount,
        // סבולת זעירה: חלוקה ב-1.18 מייצרת שברים כמו 149.99999999999997 ל-177 בדיוק, שעד היום נחשב ירוק.
        isHealthy: computerCount > 0 && perComputer >= PROFIT_PER_COMPUTER_TARGET - 1e-6,
      };
    });

    // ממוצע **משוקלל** (מסמך המשך 1, סעיף 22): סך הרווח הנטו בחודשים שאפשר לחשב בהם ÷ סך
    // חודשי-המחשב השקולים באותם חודשים — לא ממוצע פשוט של ממוצעים, שנותן לחודש עם מחשב אחד אותו
    // משקל כמו לחודש עם עשרה.
    const live = cells.filter((c) => c.profitPerComputer !== null && c.computerCount > 0);
    const liveComputers = live.reduce((s, c) => s + c.computerCount, 0);
    const average = liveComputers > 0 ? live.reduce((s, c) => s + c.netProfit, 0) / liveComputers : null;

    const existed = cells.filter((c) => c.existed);
    const averageTotal =
      existed.length > 0 ? existed.reduce((s, c) => s + c.netProfit, 0) / existed.length : null;

    return { branch, isMineBranch: branch.isMine !== false, cells, average, averageTotal };
  });

  return { months, rows, target: PROFIT_PER_COMPUTER_TARGET };
}

/*
 * כאן ישב `computeSecretaryShare` / `SECRETARY_PCT` — "חלק המזכירה", 30% מהברוטו של כל
 * הסניפים שלי, בלי שם, בלי תאריך התחלה ובלי זיכרון של מה כבר הועבר. הוא הוחלף בהסדר
 * מפורש ב-`lib/revenue-shares.ts`: אדם בשם, סניף אחד, תאריך התחלה, וחוב שמצטבר
 * ב-`/dashboard/accounting/mobile` עד שמסמנים שהועבר.
 *
 * הסכום כבר מנוכה מ-`ownerOperatingProfitThisMonth`, ולכן הרווח-פר-מחשב שבטבלה הזו
 * הוא מה שנשאר לי **אחרי** האחוזים שאני מעביר — לא לפניהם.
 */

export { currentMonth };
