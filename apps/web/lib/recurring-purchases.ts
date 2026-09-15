/**
 * רכישות חוזרות (`n_expense_types`).
 *
 * נייר למדפסת, שקיות אשפה, פחיות. כל קנייה כזו היא באמת הוצאה חד-פעמית — קונים כשנגמר,
 * בסכום אחר ובתאריך לא צפוי — ולכן היא נשארת שורה רגילה ב-`n_var_expenses` או
 * `n_multi_branch_expenses`, והכסף נספר בהנה"ח בחודש שבו הוא יצא. **המודול הזה לא מזיז
 * אף שקל.**
 *
 * מה שחסר היה לא מקום אחר לרשום בו, אלא הידיעה ששתי השורות האלה הן אותו מוצר. שלוש
 * קניות נייר של 300 ₪ מפוזרות על השנה נראות כלום כל אחת לחוד, וביחד הן 900 ₪ שראוי
 * לדעת עליהם. `expenseTypeId` הוא החוט שמחבר אותן, וכל מה שכאן הוא חישוב מעליו:
 *
 * - **סה"כ שנתי** לכל סוג — התשובה ל"כמה בעצם הולך על נייר".
 * - **חלוקה ל-12** (`perMonth`) — כמה הסוג הזה "עולה" בחודש ממוצע, כדי שאפשר יהיה
 *   להשוות אותו להוצאה קבועה. זה מספר של דוח, לא רישום: אף שקל לא זז לחודש אחר.
 * - **חלוקה בין הסניפים** (`perBranch`) — אותו היגיון על הציר השני.
 * - **השוואה לשנה שעברה** — שלוש קניות נייר השנה מול שבע בשנה שעברה היא המסקנה
 *   שבגללה בכלל שווה לסמן.
 */
import { getAdminFirestore } from "./firebase-admin";
import type {
  Branch,
  MultiBranchExpense,
  RecurringPurchaseType,
  VariableExpense,
} from "@ultranet/shared-types";
import { MULTI_BRANCH_EXPENSES_COLLECTION } from "./multi-branch-expense";
import { isSharedExpenseBranch } from "./expense-shared-scope";

export const EXPENSE_TYPES_COLLECTION = "n_expense_types";

export type RecurringPurchaseModule = RecurringPurchaseType["module"];

export const RECURRING_PURCHASE_MODULE_LABELS: Record<RecurringPurchaseModule, string> = {
  computers: "חדרי מחשבים",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
  general: "כל העסק",
};

export function currentYear(): string {
  return new Date().toISOString().slice(0, 4);
}

/** רכישה אחת של סוג חוזר, אחרי שהושטחה מהקולקשן שהיא חיה בו. */
export interface RecurringPurchase {
  id: string;
  typeId: string;
  source: "variable" | "multi-branch";
  desc: string;
  amount: number;
  date: string;
  /** YYYY-MM */
  month: string;
  /** YYYY */
  year: string;
  /** הסניף שהשורה נרשמה תחתיו, לתצוגה בלבד. `undefined` בהוצאה על כמה סניפים. */
  branchId?: string;
}

export async function loadRecurringPurchaseTypes(params?: {
  module?: RecurringPurchaseModule;
  includeArchived?: boolean;
}): Promise<RecurringPurchaseType[]> {
  const snap = await getAdminFirestore().collection(EXPENSE_TYPES_COLLECTION).get();
  let rows = snap.docs.map(
    (d) => ({ ...(d.data() as Omit<RecurringPurchaseType, "id">), id: d.id }) as RecurringPurchaseType,
  );
  if (params?.module) rows = rows.filter((r) => r.module === params.module || r.module === "general");
  if (!params?.includeArchived) rows = rows.filter((r) => !r.archived);
  return rows.sort((a, b) => a.name.localeCompare(b.name, "he"));
}

/**
 * כל הרכישות החד-פעמיות משני הקולקשנים שאפשר לרשום בהם אחת, מחולקות לפי האם הן כבר
 * שויכו לסוג.
 *
 * שתי הקבוצות נקראות יחד ולא בשתי פונקציות, כי המסך צריך את שתיהן — את המסומנות לדוח
 * ואת הלא-מסומנות להצעות — והפרדה הייתה קוראת את אותן שתי קולקשנים פעמיים.
 *
 * הוצאה על כמה סניפים נספרת בסכום המלא שלה: הדוח שואל "כמה הלך על נייר", והתשובה היא מה
 * שיצא מהכיס, לא החלק של סניף כזה או אחר.
 */
export async function loadPurchaseRows(): Promise<{
  tagged: RecurringPurchase[];
  untagged: RecurringPurchase[];
}> {
  const db = getAdminFirestore();
  const [varSnap, multiSnap] = await Promise.all([
    db.collection("n_var_expenses").get(),
    db.collection(MULTI_BRANCH_EXPENSES_COLLECTION).get(),
  ]);

  const tagged: RecurringPurchase[] = [];
  const untagged: RecurringPurchase[] = [];

  for (const d of varSnap.docs) {
    const e = { ...(d.data() as Omit<VariableExpense, "id">), id: d.id } as VariableExpense;
    if (!e.date) continue;
    const row: RecurringPurchase = {
      id: e.id,
      typeId: e.expenseTypeId ?? "",
      source: "variable",
      desc: e.desc ?? "",
      amount: e.amount || 0,
      date: e.date,
      month: e.month ?? e.date.slice(0, 7),
      year: e.date.slice(0, 4),
      branchId: e.branchId,
    };
    (row.typeId ? tagged : untagged).push(row);
  }
  for (const d of multiSnap.docs) {
    const e = { ...(d.data() as Omit<MultiBranchExpense, "id">), id: d.id } as MultiBranchExpense;
    if (!e.date) continue;
    const row: RecurringPurchase = {
      id: e.id,
      typeId: e.expenseTypeId ?? "",
      source: "multi-branch",
      desc: e.desc ?? "",
      amount: e.amount || 0,
      date: e.date,
      month: e.month ?? e.date.slice(0, 7),
      year: e.date.slice(0, 4),
    };
    (row.typeId ? tagged : untagged).push(row);
  }

  const newestFirst = (a: RecurringPurchase, b: RecurringPurchase) => b.date.localeCompare(a.date);
  return { tagged: tagged.sort(newestFirst), untagged: untagged.sort(newestFirst) };
}

/** סיכום של סוג אחד בשנה אחת. */
export interface RecurringPurchaseYear {
  year: string;
  purchases: RecurringPurchase[];
  total: number;
  count: number;
  /** ממוצע לקנייה — "כמה עולה חבילת נייר" */
  avgPerPurchase: number;
  /**
   * הסה"כ השנתי חלקי 12. זה המספר שמאפשר להשוות רכישה חוזרת להוצאה קבועה, והוא
   * **של הדוח בלבד** — בהנה"ח הכסף נשאר בחודש שבו יצא.
   */
  perMonth: number;
  /** הסה"כ השנתי חלקי מספר הסניפים שהסוג מתחלק ביניהם */
  perBranch: number;
  /** כמה סניפים נכנסו ל-`perBranch` */
  branchCount: number;
  /** מה שולם בפועל בכל חודש: 12 מספרים, ינואר עד דצמבר */
  byMonth: number[];
  /** מרווח ממוצע בין קנייה לקנייה, בימים. `null` כשיש קנייה אחת בלבד. */
  avgGapDays: number | null;
}

function monthIndex(month: string): number {
  return Number(month.slice(5, 7)) - 1;
}

export function summarizeYear(
  year: string,
  purchases: RecurringPurchase[],
  branchCount: number,
): RecurringPurchaseYear {
  const rows = purchases.filter((p) => p.year === year).sort((a, b) => a.date.localeCompare(b.date));
  const total = rows.reduce((s, p) => s + p.amount, 0);
  const byMonth = Array.from({ length: 12 }, () => 0);
  for (const p of rows) {
    const i = monthIndex(p.month);
    if (i >= 0 && i < 12) byMonth[i] = (byMonth[i] ?? 0) + p.amount;
  }

  let avgGapDays: number | null = null;
  if (rows.length > 1) {
    const first = Date.parse(rows[0]!.date);
    const last = Date.parse(rows[rows.length - 1]!.date);
    if (Number.isFinite(first) && Number.isFinite(last)) {
      avgGapDays = Math.round((last - first) / 86_400_000 / (rows.length - 1));
    }
  }

  return {
    year,
    purchases: rows.slice().reverse(),
    total,
    count: rows.length,
    avgPerPurchase: rows.length > 0 ? total / rows.length : 0,
    // תמיד 12 ולא "החודשים שחלפו": השאלה היא כמה המוצר עולה בחודש ממוצע לאורך שנה,
    // ושנה היא 12 חודשים גם כשהיא עוד באמצע. חצי שנה חלקי 6 היה מנפח את המספר.
    perMonth: total / 12,
    perBranch: branchCount > 0 ? total / branchCount : 0,
    branchCount,
    byMonth,
    avgGapDays,
  };
}

/** כל מה שצריך כדי לצייר את השורה של סוג אחד בדוח. */
export interface RecurringPurchaseReport {
  type: RecurringPurchaseType;
  /** הסניפים שהעלות מתחלקת ביניהם, אחרי הצלבה מול הסניפים הקיימים */
  branches: Branch[];
  /** כל השנים שיש בהן רכישה, מהחדשה לישנה */
  years: RecurringPurchaseYear[];
  /** סה"כ מאז ומתמיד */
  grandTotal: number;
  /** הרכישה האחרונה, אם יש */
  lastPurchase: RecurringPurchase | null;
}

/**
 * הסניפים שסוג מתחלק ביניהם. אותה סמנטיקה כמו הוצאה משותפת: רשימה ריקה = כל סניפי
 * המודול (כולל כאלה שייפתחו), ורשימה מפורשת תמיד מוצלבת מול הסניפים החיים — סניף שנמחק
 * לא ממשיך להחזיק חלק בעלות, אחרת אותה שנה הייתה מוצגת בשני מספרים שונים.
 */
export function branchesForType(type: RecurringPurchaseType, allBranches: Branch[]): Branch[] {
  const live = allBranches.filter((b) => !b.deleted);
  const inModule = type.module === "general" ? live : live.filter((b) => b.branchType === type.module);
  const chosen = type.branchIds;
  if (!chosen || chosen.length === 0) return inModule;
  const chosenSet = new Set(chosen);
  return inModule.filter((b) => chosenSet.has(b.id));
}

export function buildRecurringPurchaseReport(
  type: RecurringPurchaseType,
  allPurchases: RecurringPurchase[],
  allBranches: Branch[],
): RecurringPurchaseReport {
  const branches = branchesForType(type, allBranches);
  const mine = allPurchases.filter((p) => p.typeId === type.id);
  const years = [...new Set(mine.map((p) => p.year))].sort((a, b) => b.localeCompare(a));
  return {
    type,
    branches,
    years: years.map((y) => summarizeYear(y, mine, branches.length)),
    grandTotal: mine.reduce((s, p) => s + p.amount, 0),
    lastPurchase: mine.slice().sort((a, b) => b.date.localeCompare(a.date))[0] ?? null,
  };
}

/**
 * רכישות שנראה שהן של הסוג הזה אבל עוד לא סומנו — התיאור מכיל את שם הסוג.
 *
 * זו ה"המערכת תדע לבד שקניתי שוב את אותו מוצר" בפועל: אי אפשר לדעת מהסכום או מהתאריך,
 * אבל מי שכתב "נייר למדפסת" בתיאור כבר אמר את זה. ההצעה אף פעם לא מסמנת לבד — קנייה
 * שסומנה בטעות מזהמת את הדוח לשנים, והסימון הוא לחיצה אחת ממילא.
 */
export function suggestPurchasesForType(
  type: RecurringPurchaseType,
  untagged: RecurringPurchase[],
): RecurringPurchase[] {
  const needle = type.name.trim().toLowerCase();
  if (needle.length < 2) return [];
  return untagged.filter((p) => p.desc.toLowerCase().includes(needle));
}

/** תווית לסניף של רכישה, כולל הסנטינלים של הוצאה משותפת. */
export function purchaseBranchLabel(
  purchase: RecurringPurchase,
  branchNameById: ReadonlyMap<string, string>,
): string {
  if (purchase.source === "multi-branch") return "כמה סניפים";
  if (!purchase.branchId) return "—";
  if (isSharedExpenseBranch(purchase.branchId)) return "כל הסניפים";
  return branchNameById.get(purchase.branchId) ?? "סניף שנמחק";
}

/** הערך שהטופס שולח כשמבקשים ליצור סוג חדש במקום לבחור קיים. */
export const NEW_EXPENSE_TYPE_VALUE = "__new__";

/**
 * קורא את בחירת הסוג מטופס ההוצאה, ויוצר סוג חדש כשביקשו.
 *
 * הדדופ לפי שם הוא מכוון: שני אנשים שמקלידים "נייר למדפסת" בשני סניפים מתכוונים לאותו
 * מוצר, ושני סוגים באותו שם היו מפצלים בדיוק את המספר שהמודול נועד לאחד.
 */
export async function resolveExpenseTypeIdFromForm(
  formData: FormData,
  module: RecurringPurchaseModule,
): Promise<string | undefined> {
  const raw = String(formData.get("expenseTypeId") ?? "").trim();
  if (!raw) return undefined;
  const db = getAdminFirestore();

  if (raw !== NEW_EXPENSE_TYPE_VALUE) {
    const doc = await db.collection(EXPENSE_TYPES_COLLECTION).doc(raw).get();
    return doc.exists ? raw : undefined;
  }

  const name = String(formData.get("expenseTypeName") ?? "").trim();
  if (!name) return undefined;

  const existing = await loadRecurringPurchaseTypes({ includeArchived: true });
  const hit = existing.find(
    (t) => t.name.trim().toLowerCase() === name.toLowerCase() && (t.module === module || t.module === "general"),
  );
  if (hit) return hit.id;

  const data: Omit<RecurringPurchaseType, "id"> = {
    name,
    module,
    createdAt: new Date().toISOString(),
  };
  const ref = await db.collection(EXPENSE_TYPES_COLLECTION).add(data);
  return ref.id;
}
