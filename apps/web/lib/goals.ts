/**
 * דף היעדים — יעד מחזור חודשי לכל סניף / קו עסקי, מול מה שנכנס בפועל.
 *
 * היעדים נשמרים ב-`n_goals` ומגיעים מקובץ אקסל שהבעלים מעלה (ייבוא חד-פעמי, בלי חיבור חי
 * לגיליון — מחיקה בגיליון לא נוגעת באתר). **הביצוע לא נשמר בשום מקום**: הוא נגזר בכל טעינה
 * מאותם מקורות שכל מודול כבר מציג, כדי שהמספר כאן יהיה בדיוק המספר שבמסך הסניף:
 *  - השכרות: `grossIncomeThisMonth` + `saleIncomeThisMonth` של `computeBranchFinancials` —
 *    כל ההכנסה של הסניף לפני חלוקה עם השותף, כולל מכירות מחשבים.
 *  - חדרי מחשבים: שורות ההכנסה של `loadComputerRoomAccounting` (מעקב ידני + מזומן מהקופה).
 *  - משרד שיתופי: התשלומים שנרשמו ללקוחות הסניף (`payments`), לפי החודש שלהם.
 *  - מכירת מחשבים: הכנסות מסוג "מכירת מחשבים" בהנה"ח הראשית (`n_ah_income`, `type: "sale"`).
 *  - סניפי ניידים חדשים: כל סניף השכרות שאף שורה אחרת בקובץ לא מחוברת אליו.
 */
import * as XLSX from "xlsx";
import type { AccountingIncome, Branch, BranchType, Goal, GoalLinkKind } from "@ultranet/shared-types";
import { getAdminFirestore } from "./firebase-admin";
import { monthsBetween } from "./branch-accounting";
import { computeBranchFinancials, loadBranchAccountingRawData } from "./branch-accounting-data";
import { loadComputerRoomAccounting } from "./computer-room-accounting";
import { loadCoworkingData } from "./coworking";
import { isLaptopActive } from "./laptop-names";

export const GOALS_COLLECTION = "n_goals";

export const BRANCH_TYPE_LABEL: Record<BranchType, string> = {
  rentals: "השכרות",
  computers: "חדרי מחשבים",
  coworking: "משרד שיתופי",
};

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = (y ?? 1970) * 12 + ((m ?? 1) - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

/** כמה מהחודש כבר עבר (0–1). לחודש שהסתיים — 1. */
export function monthElapsed(month: string, today = new Date()): number {
  const now = today.toISOString().slice(0, 7);
  if (month < now) return 1;
  if (month > now) return 0;
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return today.getDate() / days;
}

export interface GoalBranchOption {
  id: string;
  name: string;
  type: BranchType;
}

export interface GoalRow {
  goal: Goal;
  /** שם המקור באתר, לתצוגה ("סניף צפת", "כל המשרד השיתופי"...); ריק כשאין חיבור */
  sourceLabel: string;
  /** null = אין נתון באתר לשורה הזו */
  actual: number | null;
  /** ממוצע שלושת החודשים שלפני החודש הנבחר */
  avg3: number | null;
  /** מחשבים פעילים כרגע באתר (סניפי השכרות בלבד) */
  computersActual: number | null;
}

export interface GoalsBoard {
  month: string;
  elapsed: number;
  rows: GoalRow[];
  branches: GoalBranchOption[];
}

function isLive(b: Branch) {
  return !b.deleted && !b.notStarted;
}

export async function loadGoalsBoard(month = currentMonth()): Promise<GoalsBoard> {
  const db = getAdminFirestore();
  const [goalsSnap, salesSnap, rentalsRaw, rooms, coworking] = await Promise.all([
    db.collection(GOALS_COLLECTION).get(),
    db.collection("n_ah_income").where("type", "==", "sale").get(),
    loadBranchAccountingRawData(),
    loadComputerRoomAccounting(),
    loadCoworkingData(),
  ]);

  const goals = goalsSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Goal, "id">), id: d.id }) as Goal)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const window = [shiftMonth(month, -3), shiftMonth(month, -2), shiftMonth(month, -1), month];
  const wanted = new Set(window);

  // מחזור לפי סניף ולפי חודש, רק לחודשים שהדף צריך.
  const byBranch = new Map<string, Record<string, number>>();
  const add = (branchId: string, m: string, amount: number) => {
    if (!wanted.has(m)) return;
    const rec = byBranch.get(branchId) ?? {};
    rec[m] = (rec[m] ?? 0) + amount;
    byBranch.set(branchId, rec);
  };

  const rentalBranches = rentalsRaw.branches.filter((b) => b.branchType === "rentals" && isLive(b));
  const linkedBranchIds = new Set(goals.filter((g) => g.linkKind === "branch").map((g) => g.branchId));
  // "סניפים שאקים בעתיד": כל סניף השכרות שאין לו שורה משלו בקובץ נכנס לשורת הסניפים החדשים.
  const newRentals = rentalBranches.filter((b) => !linkedBranchIds.has(b.id));
  const wantNew = goals.some((g) => g.linkKind === "new_rentals");
  for (const branch of rentalBranches) {
    if (!linkedBranchIds.has(branch.id) && !wantNew) continue;
    for (const m of window) {
      const f = computeBranchFinancials(branch, rentalsRaw, m);
      add(branch.id, m, f.grossIncomeThisMonth + f.saleIncomeThisMonth);
    }
  }
  const roomBranches = rooms.branches.filter(isLive);
  for (const branch of roomBranches) {
    for (const line of rooms.incomeLinesByBranch.get(branch.id) ?? []) {
      add(branch.id, line.month || line.date.slice(0, 7), line.amount || 0);
    }
  }
  const cwBranches = coworking.branches.filter(isLive);
  const cwIds = new Set(cwBranches.map((b) => b.id));
  const coworkingAll: Record<string, number> = {};
  for (const client of coworking.clients) {
    for (const p of client.payments ?? []) {
      add(client.branchId, p.month, p.amount || 0);
      if (cwIds.has(client.branchId) && wanted.has(p.month)) {
        coworkingAll[p.month] = (coworkingAll[p.month] ?? 0) + (p.amount || 0);
      }
    }
  }
  const computerSales: Record<string, number> = {};
  for (const d of salesSnap.docs) {
    const i = d.data() as AccountingIncome;
    const m = i.month || (i.date ?? "").slice(0, 7);
    if (wanted.has(m)) computerSales[m] = (computerSales[m] ?? 0) + (i.amount || 0);
  }
  const laptopSales: Record<string, number> = {};
  for (const sales of rentalsRaw.salesByBranch.values()) {
    for (const s of sales) {
      const m = s.month || s.date.slice(0, 7);
      if (wanted.has(m)) laptopSales[m] = (laptopSales[m] ?? 0) + (s.price || 0);
    }
  }

  const branches: GoalBranchOption[] = [...rentalBranches, ...roomBranches, ...cwBranches].map((b) => ({
    id: b.id,
    name: b.name,
    type: b.branchType,
  }));
  const branchById = new Map(branches.map((b) => [b.id, b]));

  const rows: GoalRow[] = goals.map((goal) => {
    let series: Record<string, number> | null = null;
    let sourceLabel = "";
    let computersActual: number | null = null;
    if (goal.linkKind === "branch" && goal.branchId && branchById.has(goal.branchId)) {
      const b = branchById.get(goal.branchId)!;
      series = byBranch.get(b.id) ?? {};
      sourceLabel = `${BRANCH_TYPE_LABEL[b.type]} · ${b.name}`;
      if (b.type === "rentals") {
        computersActual = (rentalsRaw.laptopsByBranch.get(b.id) ?? []).filter(isLaptopActive).length;
      }
    } else if (goal.linkKind === "coworking_all") {
      series = coworkingAll;
      sourceLabel = "כל סניפי המשרד השיתופי";
    } else if (goal.linkKind === "laptop_sales") {
      series = laptopSales;
      sourceLabel = "מכירות מחשבים מסניפי הניידים";
    } else if (goal.linkKind === "computer_sales") {
      series = computerSales;
      sourceLabel = "הכנסות \"מכירת מחשבים\" בכספים";
    } else if (goal.linkKind === "new_rentals") {
      series = {};
      for (const b of newRentals) {
        for (const [m, v] of Object.entries(byBranch.get(b.id) ?? {})) series[m] = (series[m] ?? 0) + v;
      }
      computersActual = newRentals.reduce(
        (s, b) => s + (rentalsRaw.laptopsByBranch.get(b.id) ?? []).filter(isLaptopActive).length,
        0,
      );
      sourceLabel = newRentals.length
        ? `סניפים חדשים: ${newRentals.map((b) => b.name).join(", ")}`
        : "עוד אין סניפים חדשים";
    }
    const prev = window.slice(0, 3).map((m) => series?.[m] ?? 0);
    return {
      goal,
      sourceLabel,
      actual: series ? series[month] ?? 0 : null,
      avg3: series ? prev.reduce((s, n) => s + n, 0) / 3 : null,
      computersActual,
    };
  });

  branches.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, "he"));
  return { month, elapsed: monthElapsed(month), rows, branches };
}

/* ---------------------------------------------------------------------------
 * ייבוא מקובץ האקסל
 * ------------------------------------------------------------------------- */

export interface ParsedGoalLine {
  label: string;
  turnover: number;
  profit?: number;
  computersNow?: number;
  computersTarget?: number;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[₪,\s]/g, ""));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * קורא את הלשונית הראשונה שיש בה כותרת "מחזור". העמודות מזוהות לפי שם הכותרת ולא לפי מיקום,
 * כדי שהוספת עמודה בקובץ לא תשבור את הייבוא. שורות סיכום ("סה"כ") ושורות בלי מחזור מדולגות.
 */
export function parseGoalsWorkbook(buf: Buffer): { lines: ParsedGoalLine[]; error?: string } {
  const wb = XLSX.read(buf, { type: "buffer" });
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: null });
    const headerIdx = grid.findIndex((r) => r.some((c) => typeof c === "string" && c.trim() === "מחזור"));
    if (headerIdx < 0) continue;
    const header = grid[headerIdx]!.map((c) => (typeof c === "string" ? c.trim() : ""));
    const col = (title: string) => header.findIndex((h) => h === title);
    const turnoverCol = col("מחזור");
    const profitCol = col("רווחיות");
    const nowCol = col("מס כיום");
    const targetCol = col("יעד במספר");
    const labelCol = turnoverCol > 0 ? 0 : header.findIndex((h) => h === "מוצר");

    const lines: ParsedGoalLine[] = [];
    for (const row of grid.slice(headerIdx + 1)) {
      const label = String(row[labelCol] ?? "").replace(/\s+/g, " ").trim();
      const turnover = num(row[turnoverCol]);
      if (!label || turnover == null || turnover <= 0) continue;
      if (/סה"?כ|סך הכל/.test(label)) continue;
      lines.push({
        label,
        turnover,
        profit: profitCol >= 0 ? num(row[profitCol]) : undefined,
        computersNow: nowCol >= 0 ? num(row[nowCol]) : undefined,
        computersTarget: targetCol >= 0 ? num(row[targetCol]) : undefined,
      });
    }
    if (lines.length) return { lines };
  }
  return { lines: [], error: 'לא נמצאה בקובץ טבלה עם עמודת "מחזור"' };
}

function normalize(s: string): string {
  return s
    .replace(/בי['"׳״`]{1,2}ש/g, "בית שמש")
    .replace(/ק['"׳״`]{1,2}ס/g, "קרית ספר")
    .replace(/ירושליים/g, "ירושלים")
    .replace(/["'׳״`]/g, "")
    .replace(/[-–_.,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * הצעת חיבור לשורה חדשה מהקובץ — לפי מילות השם מול שם הסניף, המיקום ושם השותף. ההצעה היא רק
 * נקודת פתיחה: הבעלים רואה אותה בדף ומתקן בבחירה, והתיקון נשמר גם בייבוא הבא.
 */
export function suggestLink(
  label: string,
  branches: Pick<Branch, "id" | "name" | "branchType" | "location" | "partnerName">[],
): { linkKind: GoalLinkKind; branchId?: string } {
  const text = normalize(label);
  if (/מכירת מחשבים/.test(text)) return { linkKind: "computer_sales" };
  if (/תוכנה|קיוסק/.test(text)) return { linkKind: "inactive" };
  if (/^ניידים סניפים$/.test(text)) return { linkKind: "new_rentals" };
  let type: BranchType | null = null;
  let rest = text;
  if (/^חדר מ+חשבים/.test(text)) {
    type = "computers";
    rest = text.replace(/^חדר מ+חשבים/, "");
  } else if (/^ניידים/.test(text)) {
    type = "rentals";
    rest = text.replace(/^ניידים/, "");
  } else if (/משרד שיתופי/.test(text)) {
    type = "coworking";
    rest = text.replace(/משרד שיתופי/, "");
  }
  const pool = branches.filter((b) => !type || b.branchType === type);
  const tokens = rest.split(" ").filter((t) => t.length > 1);

  if (type === "coworking" && !tokens.length) {
    return pool.length === 1 ? { linkKind: "branch", branchId: pool[0]!.id } : { linkKind: "coworking_all" };
  }
  if (!tokens.length || !type) return { linkKind: "none" };

  let best: { id: string; score: number } | null = null;
  let tie = false;
  for (const b of pool) {
    const hay = normalize([b.name, b.location, b.partnerName].filter(Boolean).join(" "));
    const score = tokens.filter((t) => hay.includes(t)).length;
    if (!score) continue;
    if (!best || score > best.score) {
      best = { id: b.id, score };
      tie = false;
    } else if (score === best.score) tie = true;
  }
  return best && !tie ? { linkKind: "branch", branchId: best.id } : { linkKind: "none" };
}
