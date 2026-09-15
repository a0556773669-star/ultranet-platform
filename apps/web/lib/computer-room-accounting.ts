/**
 * Investment-vs-profit tracking for חדרי מחשבים (computer-room) branches.
 * Deliberately separate from n_ah_income/n_ah_expenses (the main ledger): this is a
 * per-branch view of money spent (beyond setup) and money in, for owner/partner visibility only.
 * It never reconciles into the main accounting totals or the home dashboard.
 *
 * The flow is one-way: nothing here is written back to the main ledger, but cash pulled from a
 * room's till - which is recorded once, in the main ledger, as an `n_ah_income` row of type
 * `cash` with that room's branchId - is READ back into this screen as an income line. Otherwise
 * the room whose whole income is cash showed 0 ₪ in and looked like it never earned anything,
 * and the only way to fix it was to retype the same shekel as a manual tracking row - exactly
 * the double entry the manual form refuses to offer. See `RoomIncomeLine.source`.
 *
 * Setup cost is read from the asset layer when a real purchase exists for the branch, and only
 * falls back to the branch's `setupCost` field when it doesn't (פרק י״ב): setting up a room is
 * buying equipment, so it is a purchase with items like any other, and this screen becomes the
 * branch card of פרק ז׳ for free. The field stays readable so a room whose invoice was never
 * entered still shows its number.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { Branch, FixedExpense, VariableExpense, BranchIncome, AccountingIncome } from "@ultranet/shared-types";
import { monthsBetween } from "./branch-accounting";
import { SHARED_COMPUTERS_BRANCH_ID, sharedExpenseBranchIds } from "./expense-shared-scope";
import { loadAssets } from "./assets-data";
import { paybackStatus, type PaybackStatus } from "./assets";

/** Sentinel branchId for fixed/variable expenses that apply to all computer-room branches together
 *  (e.g. shared advertising, shared software) rather than to one specific branch. */
export const SHARED_EXPENSE_BRANCH_ID = SHARED_COMPUTERS_BRANCH_ID;

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** שורה אחת בפירוט "מאיפה הסכום הזה". קיימת כדי שאפשר יהיה לפענח את המספר הגדול בלי לנחש. */
export interface ExpenseLine {
  kind: "fixed" | "variable" | "shared";
  label: string;
  /** ההסבר לסכום - בעיקר "X לחודש × N חודשים", שהוא הדבר שהכי מפתיע בהוצאה קבועה */
  detail: string;
  amount: number;
}

function fixedExpenseLines(fixed: FixedExpense[], uptoMonth: string): ExpenseLine[] {
  const lines: ExpenseLine[] = [];
  for (const e of fixed) {
    if (!e.startDate) continue;
    const endMonth = e.endDate && e.endDate.slice(0, 7) < uptoMonth ? e.endDate.slice(0, 7) : uptoMonth;
    const monthly = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
    const months = monthsBetween(e.startDate, endMonth).length;
    lines.push({
      kind: "fixed",
      label: e.name,
      detail: `${Math.round(monthly).toLocaleString("he-IL")} ₪ לחודש × ${months} חודשים (מ-${e.startDate.slice(0, 7)}${e.endDate ? ` עד ${e.endDate.slice(0, 7)}` : ""})`,
      amount: monthly * months,
    });
  }
  return lines;
}

function variableExpenseLines(variable: VariableExpense[]): ExpenseLine[] {
  return variable.map((e) => ({
    kind: "variable" as const,
    label: e.desc || "הוצאה חד פעמית",
    detail: `${e.category || "ללא קטגוריה"} · ${e.date ?? ""}`,
    amount: e.amount || 0,
  }));
}

function sumLines(lines: ExpenseLine[]): number {
  return lines.reduce((total, l) => total + l.amount, 0);
}

/**
 * הוצאה משותפת אחת, יחד עם הסניפים שהיא באמת מתחלקת ביניהם.
 *
 * עד היום כל הוצאה משותפת התחלקה בין כל הסניפים, כך שסניף שנפתח היום ירש מיד חלק בהוצאה
 * קבועה שנרשמה שנה לפניו. מאז אפשר לבחור לכל הוצאה משותפת את הסניפים שלה (`branchIds`),
 * וכל הוצאה מחלקת את עצמה במחלק שלה - לא במספר הסניפים הכולל.
 */
export interface SharedExpenseEntry {
  id: string;
  kind: "fixed" | "variable";
  /** השורה כפי שהיא בספר המשותף - הסכום המלא, לפני החלוקה בין הסניפים */
  line: ExpenseLine;
  /** הסניפים הקיימים שההוצאה מתחלקת ביניהם */
  branchIds: string[];
  /** מה סניף אחד נושא מההוצאה הזו */
  perBranch: number;
  /** true כשההוצאה חלה על כל הסניפים (גם עתידיים) ולא על רשימה שנבחרה */
  appliesToAll: boolean;
}

function sharedEntriesOf(
  fixed: FixedExpense[],
  variable: VariableExpense[],
  branchIds: string[],
  month: string,
): SharedExpenseEntry[] {
  const entries: SharedExpenseEntry[] = [];
  for (const e of fixed.filter((x) => x.startDate)) {
    const scope = sharedExpenseBranchIds(e, branchIds);
    const [line] = fixedExpenseLines([e], month);
    if (!line) continue;
    entries.push({
      id: e.id,
      kind: "fixed",
      line,
      branchIds: scope,
      perBranch: scope.length > 0 ? line.amount / scope.length : 0,
      appliesToAll: !e.branchIds || e.branchIds.length === 0,
    });
  }
  for (const e of variable) {
    const scope = sharedExpenseBranchIds(e, branchIds);
    const [line] = variableExpenseLines([e]);
    if (!line) continue;
    entries.push({
      id: e.id,
      kind: "variable",
      line,
      branchIds: scope,
      perBranch: scope.length > 0 ? line.amount / scope.length : 0,
      appliesToAll: !e.branchIds || e.branchIds.length === 0,
    });
  }
  return entries;
}

/**
 * שורת הכנסה אחת במסך המעקב של חדר מחשבים, משני מקורות שונים.
 *
 * `manual` - שורה ידנית שהוזנה כאן (`n_branch_income`): מעקב סטטוס, אף פעם לא כסף שנספר.
 * `main-cash` - מזומן שנמשך מקופת הסניף ונרשם **פעם אחת בלבד** בהנה"ח הראשית
 *   (`n_ah_income` מסוג `cash` עם ה-`branchId` של הקופה). היא נקראת לכאן ולא נכתבת: אותו
 *   שקל ממשיך להיספר פעם אחת בספר הראשי, וכאן הוא רק *מוצג* כדי שהסניף שכל הכנסתו מזומן
 *   לא ייראה כאילו לא הכניס כלום. לכן היא גם לא ניתנת למחיקה מכאן - מוחקים אותה במקום
 *   שבו היא נרשמה.
 */
export interface RoomIncomeLine {
  id: string;
  source: "manual" | "main-cash";
  date: string;
  month: string;
  desc: string;
  amount: number;
}

export interface ComputerRoomBranchStats {
  branch: Branch;
  /** real investment from the asset layer when it exists, else the legacy `setupCost` field */
  setupCost: number;
  /** true when the number above came from real purchases rather than the legacy estimate */
  setupFromAssets: boolean;
  /** how much of the investment the room has already earned back (פרק ז׳) */
  payback: PaybackStatus;
  ownExpensesToDate: number;
  sharedExpenseShare: number;
  /** total spent to date, including setup cost and this branch's share of shared expenses */
  spentToDate: number;
  /** פירוט מלא של ההוצאות השוטפות (בלי ההקמה) - כל שורה והסכום שהיא תרמה */
  expenseLines: ExpenseLine[];
  /** סך ההכנסות המוצגות כאן - שורות המעקב הידניות ועוד המזומן שנמשך מהקופה */
  incomeToDate: number;
  /** מתוך `incomeToDate`: שורות המעקב הידניות (`n_branch_income`) */
  manualIncomeToDate: number;
  /** מתוך `incomeToDate`: מזומן מהקופה שנרשם בהנה"ח הראשית (`n_ah_income` מסוג `cash`) */
  cashIncomeToDate: number;
  profitHeld: number;
}

export interface ComputerRoomAccountingData {
  branches: Branch[];
  statsByBranch: Map<string, ComputerRoomBranchStats>;
  sharedFixed: FixedExpense[];
  sharedVariable: VariableExpense[];
  /** כל הוצאה משותפת עם המחלק שלה - מי נושא בה וכמה */
  sharedEntries: SharedExpenseEntry[];
  sharedExpenseTotal: number;
  /** שורות ההכנסה פר-סניף, ידניות ומזומן-מהקופה יחד, ממוינות מהחדשה לישנה */
  incomeLinesByBranch: Map<string, RoomIncomeLine[]>;
}

export async function loadComputerRoomAccounting(): Promise<ComputerRoomAccountingData> {
  const db = getAdminFirestore();
  const [branchesSnap, fixedSnap, variableSnap, incomeSnap, cashSnap, assets] = await Promise.all([
    db.collection("n_branches").where("branchType", "==", "computers").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection("n_branch_income").get(),
    // ההכנסות מהספר הראשי שנמשכו מקופה של חדר מחשבים. שאילתת שוויון אחת - אין צורך
    // באינדקס מורכב.
    db.collection("n_ah_income").where("type", "==", "cash").get(),
    loadAssets(),
  ]);

  // סניף מחוק (soft-delete) לא נכנס לכאן, ובעיקר לא למחלק של ההוצאות המשותפות: מסך
  // ההוצאות כבר סינן אותו, וכשהמסכים לא הסכימו על המחלק אותה הוצאה משותפת הוצגה בשני
  // סכומים שונים ואי אפשר היה להבין מאיפה ההפרש.
  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const allFixed = fixedSnap.docs.map((d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense);
  const allVariable = variableSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense,
  );
  const allIncome = incomeSnap.docs.map((d) => ({ ...(d.data() as Omit<BranchIncome, "id">), id: d.id }) as BranchIncome);
  const allCashIncome = cashSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<AccountingIncome, "id">), id: d.id }) as AccountingIncome,
  );

  const branchIds = new Set(branches.map((b) => b.id));
  const month = currentMonth();

  const sharedFixed = allFixed.filter((e) => e.branchId === SHARED_EXPENSE_BRANCH_ID);
  const sharedVariable = allVariable.filter((e) => e.branchId === SHARED_EXPENSE_BRANCH_ID);
  const sharedLines = [...fixedExpenseLines(sharedFixed, month), ...variableExpenseLines(sharedVariable)];
  const sharedExpenseTotal = sumLines(sharedLines);
  // כל הוצאה משותפת מתחלקת במחלק שלה, לא בכמות הסניפים הכוללת: הוצאה שהוגבלה לשני סניפים
  // מתחלקת לשניים, וסניף שלא נבחר בה לא נושא בה כלום.
  const sharedEntries = sharedEntriesOf(
    sharedFixed,
    sharedVariable,
    branches.map((b) => b.id),
    month,
  );

  // שורות המעקב הידניות והמזומן מהקופה נכנסים לאותה רשימה, עם `source` שמבדיל ביניהן:
  // מבחינת הסניף זו אותה שאלה אחת - כמה נכנס כאן עד היום - וההפרדה נחוצה רק כדי לדעת מי
  // כבר נספר בספר הראשי ומי לא, ומאיפה מוחקים כל שורה.
  const incomeLinesByBranch = new Map<string, RoomIncomeLine[]>();
  const pushLine = (branchId: string, line: RoomIncomeLine) => {
    const arr = incomeLinesByBranch.get(branchId) ?? [];
    arr.push(line);
    incomeLinesByBranch.set(branchId, arr);
  };
  for (const inc of allIncome) {
    if (!branchIds.has(inc.branchId)) continue;
    const date = inc.date || "";
    pushLine(inc.branchId, {
      id: inc.id,
      source: "manual",
      date,
      month: inc.month || date.slice(0, 7),
      desc: inc.desc || "הכנסת חודש",
      amount: inc.amount || 0,
    });
  }
  for (const inc of allCashIncome) {
    if (!inc.branchId || !branchIds.has(inc.branchId)) continue;
    const date = inc.date || "";
    pushLine(inc.branchId, {
      id: inc.id,
      source: "main-cash",
      date,
      month: inc.month || date.slice(0, 7),
      desc: inc.desc || "מזומן מקופה",
      amount: inc.amount || 0,
    });
  }
  for (const [, lines] of incomeLinesByBranch) {
    lines.sort((a, b) => b.date.localeCompare(a.date));
  }

  const statsByBranch = new Map<string, ComputerRoomBranchStats>();
  for (const b of branches) {
    const fixed = allFixed.filter((e) => e.branchId === b.id);
    const variable = allVariable.filter((e) => e.branchId === b.id);
    const ownLines = [...fixedExpenseLines(fixed, month), ...variableExpenseLines(variable)];
    const ownExpensesToDate = sumLines(ownLines);
    // שורה נפרדת לכל הוצאה משותפת (ולא שורת "חלק הסניף בהוצאות המשותפות" אחת): זו בדיוק
    // השאלה ששואלים כשסניף חדש נפתח ומיד יש עליו הוצאה קבועה - איזו הוצאה, וכמה סניפים
    // מתחלקים בה.
    const branchSharedEntries = sharedEntries.filter((s) => s.branchIds.includes(b.id));
    const sharedExpenseShare = branchSharedEntries.reduce((total, s) => total + s.perBranch, 0);
    const expenseLines: ExpenseLine[] = [
      ...ownLines,
      ...branchSharedEntries.map((s) => ({
        kind: "shared" as const,
        label: `${s.line.label} (משותפת)`,
        detail: `${Math.round(s.line.amount).toLocaleString("he-IL")} ₪ ÷ ${s.branchIds.length} סניפים${
          s.appliesToAll ? "" : " (נבחרו ידנית)"
        } · ${s.line.detail}`,
        amount: s.perBranch,
      })),
    ];
    // Real investment wins over the estimate whenever the asset layer knows about this branch.
    const assetInvestment = assets.investmentByLocation.get(b.id)?.total ?? 0;
    const setupFromAssets = assetInvestment > 0;
    const setupCost = setupFromAssets ? assetInvestment : b.setupCost ?? 0;
    const spentToDate = setupCost + ownExpensesToDate + sharedExpenseShare;
    const incomeLines = incomeLinesByBranch.get(b.id) ?? [];
    const manualIncomeToDate = incomeLines
      .filter((i) => i.source === "manual")
      .reduce((sum, i) => sum + i.amount, 0);
    const cashIncomeToDate = incomeLines
      .filter((i) => i.source === "main-cash")
      .reduce((sum, i) => sum + i.amount, 0);
    const incomeToDate = manualIncomeToDate + cashIncomeToDate;
    // Operating profit is what pays the investment back - the equipment cost itself is NOT
    // subtracted from it (כלל 7), only compared against it.
    const operatingProfit = incomeToDate - ownExpensesToDate - sharedExpenseShare;
    const monthsRun = b.openedAt ? monthsBetween(b.openedAt, month).length : 0;
    statsByBranch.set(b.id, {
      branch: b,
      setupCost,
      setupFromAssets,
      payback: paybackStatus(setupCost, operatingProfit, monthsRun > 0 ? operatingProfit / monthsRun : 0),
      ownExpensesToDate,
      sharedExpenseShare,
      spentToDate,
      expenseLines,
      incomeToDate,
      manualIncomeToDate,
      cashIncomeToDate,
      profitHeld: incomeToDate - spentToDate,
    });
  }

  return {
    branches,
    statsByBranch,
    sharedFixed,
    sharedVariable,
    sharedEntries,
    sharedExpenseTotal,
    incomeLinesByBranch,
  };
}

/*
 * loadComputerRoomSetupCostTotal() used to live here and was added on top of the main ledger's
 * expense total by hand, because setup cost is not a dated transaction. It is one now: a room's
 * setup is projected as a CAPITAL transaction (lib/tx-data.ts), so it reaches the model with a
 * date, appears in the capital memo below the bottom line, and stays out of operating profit
 * where it never belonged. Nothing is added on top anywhere any more.
 */
