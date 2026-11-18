/**
 * ספר ההשקעה — הסכם "השקעה ושותפות במיזם תוכנה" בין יונה ארנטרוי (היזם) ליצחק ברון (המשקיע),
 * נחתם 11.11.2026. הקובץ הזה טהור: מקבל תנועות ומחזיר מספרים. ראו SPEC, פרק "השקעה".
 *
 * מה שנגזר מההסכם (סעיפים בסוגריים):
 *   - תקרת השקעה 200,000 ₪; 80,000 ₪ בחתימה (2.1–2.2); היתרה לפי צורכי הפיתוח (2.3).
 *   - רווח נקי חודשי (הכנסות פחות הוצאות תפעוליות) מתחלק 75% ליזם / 25% למשקיע (3.1).
 *   - ריבית קבועה בפירעון: 9% לשנה על הקרן, והשלמה עד 13% — ללא כפל (5.1–5.3).
 *   - מלאה על הקרן בפירעון מוקדם (5.4). קניין רוחני ושליטה אצל היזם (6).
 *
 * פרשנות — דורשת אישור הבעלים (ומוצגת בממשק כ"חישוב מידע", לא כהתחייבות):
 *   - רווח חודשי שלילי לא מקטין את חלק המשקיע ולא נצבר (אין בהסכם סעיף של העברת הפסד).
 *   - ה-9%/13% מחושבים על הקרן המשוקללת בזמן (כל הפקדה מרגע התאריך שלה), שנתי, בלי ריבית דריבית.
 */
import type { InvestmentEntry, InvestmentEntryKind } from "@ultranet/shared-types";

export const INVESTMENT_COLLECTION = "n_investment_entries";

export const INVESTMENT_TERMS = {
  investorName: "יצחק ברון",
  founderName: "יונה ארנטרוי",
  signedOn: "2026-11-11",
  cap: 200_000,
  initial: 80_000,
  founderShare: 0.75,
  investorShare: 0.25,
  floorRate: 0.09,
  ceilingRate: 0.13,
  lockMonths: 24,
  exitNoticeDays: 90,
} as const;

export const KIND_LABELS: Record<InvestmentEntryKind, string> = {
  deposit: "העברה מהמשקיע",
  expense: "הוצאה",
  income: "הכנסה",
  profit_payout: "רווחים למשקיע",
  principal_return: "החזר קרן",
};

export const EXPENSE_CATEGORIES = [
  "פיתוח",
  "שכר מפתחת",
  "שיווק",
  "תשתיות ושרתים",
  "ציוד",
  "משפטי והנה\"ח",
  "אחר",
] as const;

const DAY_MS = 86_400_000;

function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

export interface InvestmentMonth {
  month: string;
  income: number;
  operatingExpenses: number;
  capitalExpenses: number;
  /** הכנסות פחות הוצאות תפעוליות */
  net: number;
  /** חלק המשקיע בחודש (0 כשהחודש לא רווחי) */
  investorShare: number;
  founderShare: number;
  payouts: number;
}

export interface InvestmentSummary {
  deposited: number;
  returnedPrincipal: number;
  /** הקרן שעדיין אצל המיזם */
  principalOutstanding: number;
  capRemaining: number;
  capUsedPct: number;
  expensesTotal: number;
  capitalExpenses: number;
  operatingExpenses: number;
  incomeTotal: number;
  /** הכנסות פחות הוצאות תפעוליות, מצטבר */
  netProfit: number;
  /** הפקדות פחות כל ההוצאות. שלילי = היזם מימן מכיסו ומחכה להחזר */
  fundBalance: number;
  investorShareAccrued: number;
  investorPaid: number;
  investorOwed: number;
  /** מה שהמשקיע קיבל/צבר בפועל: רווחים ששולמו + החזרי קרן */
  receivedTotal: number;
  floorAccrued: number;
  ceilingAccrued: number;
  /** כמה חסר כדי שהחלק מהרווחים יגיע ל-9% / 13% (ריבית קבועה בפירעון) */
  shortfallToFloor: number;
  shortfallToCeiling: number;
  /** תשואה שנתית משוקללת-זמן של חלק הרווחים שנצבר, באחוזים */
  annualizedReturnPct: number;
  months: InvestmentMonth[];
  expensesByCategory: { category: string; amount: number }[];
}

export function summarize(entries: InvestmentEntry[], today: string): InvestmentSummary {
  const sum = (kind: InvestmentEntryKind, pick?: (e: InvestmentEntry) => boolean) =>
    entries.filter((e) => e.kind === kind && (!pick || pick(e))).reduce((s, e) => s + e.amount, 0);

  const deposited = sum("deposit");
  const returnedPrincipal = sum("principal_return");
  const expensesTotal = sum("expense");
  const operatingExpenses = sum("expense", (e) => e.expenseType === "operating");
  const capitalExpenses = expensesTotal - operatingExpenses;
  const incomeTotal = sum("income");
  const investorPaid = sum("profit_payout");

  const byMonth = new Map<string, InvestmentMonth>();
  const month = (m: string): InvestmentMonth => {
    let row = byMonth.get(m);
    if (!row) {
      row = { month: m, income: 0, operatingExpenses: 0, capitalExpenses: 0, net: 0, investorShare: 0, founderShare: 0, payouts: 0 };
      byMonth.set(m, row);
    }
    return row;
  };
  for (const e of entries) {
    const row = month(e.date.slice(0, 7));
    if (e.kind === "income") row.income += e.amount;
    else if (e.kind === "expense") {
      if (e.expenseType === "operating") row.operatingExpenses += e.amount;
      else row.capitalExpenses += e.amount;
    } else if (e.kind === "profit_payout") row.payouts += e.amount;
  }
  const months = [...byMonth.values()].sort((a, b) => b.month.localeCompare(a.month));
  for (const row of months) {
    row.net = round2(row.income - row.operatingExpenses);
    const positive = Math.max(0, row.net);
    row.investorShare = round2(positive * INVESTMENT_TERMS.investorShare);
    row.founderShare = round2(positive - row.investorShare);
  }
  const investorShareAccrued = round2(months.reduce((s, m) => s + m.investorShare, 0));

  const todayN = dayNumber(today);
  let capitalYears = 0;
  for (const e of entries) {
    if (e.kind !== "deposit" && e.kind !== "principal_return") continue;
    const years = Math.max(0, todayN - dayNumber(e.date)) / 365;
    capitalYears += (e.kind === "deposit" ? e.amount : -e.amount) * years;
  }
  capitalYears = Math.max(0, capitalYears);
  const floorAccrued = round2(capitalYears * INVESTMENT_TERMS.floorRate);
  const ceilingAccrued = round2(capitalYears * INVESTMENT_TERMS.ceilingRate);

  const cats = new Map<string, number>();
  for (const e of entries) {
    if (e.kind !== "expense") continue;
    const c = e.category?.trim() || "אחר";
    cats.set(c, (cats.get(c) ?? 0) + e.amount);
  }

  const principalOutstanding = Math.max(0, deposited - returnedPrincipal);
  return {
    deposited,
    returnedPrincipal,
    principalOutstanding,
    capRemaining: Math.max(0, INVESTMENT_TERMS.cap - deposited),
    capUsedPct: Math.min(100, (deposited / INVESTMENT_TERMS.cap) * 100),
    expensesTotal,
    capitalExpenses,
    operatingExpenses,
    incomeTotal,
    netProfit: round2(incomeTotal - operatingExpenses),
    fundBalance: round2(deposited - expensesTotal),
    investorShareAccrued,
    investorPaid,
    investorOwed: round2(investorShareAccrued - investorPaid),
    receivedTotal: investorPaid + returnedPrincipal,
    floorAccrued,
    ceilingAccrued,
    shortfallToFloor: round2(Math.max(0, floorAccrued - investorShareAccrued)),
    shortfallToCeiling: round2(Math.max(0, ceilingAccrued - investorShareAccrued)),
    annualizedReturnPct: capitalYears > 0 ? round2((investorShareAccrued / capitalYears) * 100) : 0,
    months,
    expensesByCategory: [...cats.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}
