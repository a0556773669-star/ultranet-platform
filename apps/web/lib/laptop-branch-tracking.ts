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
 * לחודש, ו-`computersActiveInMonth` יודע כמה מחשבים היו באותו חודש (לפי `addedDate` של כל
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
import {
  computersActiveInMonth,
  monthsBetween,
  PROFIT_PER_COMPUTER_TARGET,
} from "./branch-accounting";

export interface TrackingCell {
  month: string;
  /** null = הסניף לא היה קיים בחודש הזה - התא נשאר ריק */
  profitPerComputer: number | null;
  /** הרווח התפעולי של הבעלים באותו חודש, בלי שורות רכש שהסניף לא לוקח בהן חלק */
  netProfit: number;
  computerCount: number;
  isHealthy: boolean;
}

export interface TrackingRow {
  branch: Branch;
  isMineBranch: boolean;
  cells: TrackingCell[];
  /** ממוצע הרווח למחשב על החודשים שהסניף היה בהם פעיל */
  average: number | null;
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
    const addedDates = laptops.map((l) => l.addedDate);

    const cells: TrackingCell[] = months.map((month) => {
      const existed = !branch.notStarted && (!opened || opened <= month) && (!closed || month <= closed);
      if (!existed) {
        return { month, profitPerComputer: null, netProfit: 0, computerCount: 0, isHealthy: false };
      }
      const f = computeBranchFinancials(branch, raw, month);
      const computerCount = computersActiveInMonth(addedDates, month);
      const netProfit = f.ownerOperatingProfitThisMonth;
      const perComputer = computerCount > 0 ? netProfit / computerCount : 0;
      return {
        month,
        profitPerComputer: computerCount > 0 ? perComputer : null,
        netProfit,
        computerCount,
        isHealthy: computerCount > 0 && perComputer >= PROFIT_PER_COMPUTER_TARGET,
      };
    });

    const live = cells.filter((c) => c.profitPerComputer !== null);
    const average =
      live.length > 0 ? live.reduce((s, c) => s + (c.profitPerComputer ?? 0), 0) / live.length : null;

    return { branch, isMineBranch: branch.isMine !== false, cells, average };
  });

  return { months, rows, target: PROFIT_PER_COMPUTER_TARGET };
}

/**
 * חלקה של המזכירה במחשבי הסניף הראשי.
 *
 * המזכירה מתפעלת את המחשבים שבסניף שלי ומקבלת 30% מהברוטו שלהם כמשכורת. הסכום הזה
 * במכוון לא מופיע בטבלת ההעברות (שם יושבים רק סניפים שחייבים לי כסף) אלא כאן, כדי
 * שיוזן כשורה ב"הוצאות נוספות" - זו משכורת, לא התחשבנות בין שותפים.
 */
export const SECRETARY_PCT = 30;

export interface SecretaryShare {
  month: string;
  grossIncome: number;
  pct: number;
  amount: number;
  branchNames: string[];
}

export function computeSecretaryShare(
  branches: Branch[],
  raw: BranchAccountingRawData,
  month: string,
): SecretaryShare {
  const mine = branches.filter((b) => b.branchType === "rentals" && b.isMine !== false && !b.deleted);
  const grossIncome = mine.reduce(
    (sum, b) => sum + computeBranchFinancials(b, raw, month).grossIncomeThisMonth,
    0,
  );
  return {
    month,
    grossIncome,
    pct: SECRETARY_PCT,
    amount: (grossIncome * SECRETARY_PCT) / 100,
    branchNames: mine.map((b) => b.name),
  };
}

export { currentMonth };
