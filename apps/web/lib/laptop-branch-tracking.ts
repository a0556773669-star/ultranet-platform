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
import { monthsBetween, PROFIT_PER_COMPUTER_TARGET } from "./branch-accounting";
import { laptopActiveInMonth } from "./laptop-names";

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
  /** ממוצע הרווח למחשב על החודשים שהסניף היה בהם פעיל */
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
      // מחשב נספר מהחודש שנוסף ועד החודש שיצא בו (מכירה/הוצאה) כולל — `laptopActiveInMonth`.
      // עד 09/2026 נספרו כאן רק תאריכי ההוספה, כך שמחשב שיצא מהסניף המשיך לחלק את הרווח לנצח.
      const computerCount = laptops.filter((l) => laptopActiveInMonth(l, month)).length;
      const netProfit = f.ownerOperatingProfitThisMonth;
      const perComputer = computerCount > 0 ? netProfit / computerCount : 0;
      return {
        month,
        existed: true,
        profitPerComputer: computerCount > 0 ? perComputer : null,
        netProfit,
        saleIncome: f.saleIncomeThisMonth,
        computerCount,
        isHealthy: computerCount > 0 && perComputer >= PROFIT_PER_COMPUTER_TARGET,
      };
    });

    const live = cells.filter((c) => c.profitPerComputer !== null);
    const average =
      live.length > 0 ? live.reduce((s, c) => s + (c.profitPerComputer ?? 0), 0) / live.length : null;

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
