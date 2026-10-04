/**
 * רכישות חוזרות — **סימון על ההוצאה עצמה, לא מודול**.
 *
 * נייר למדפסת, שקיות אשפה, פחיות. כל קנייה כזו היא באמת הוצאה חד-פעמית — קונים כשנגמר,
 * בסכום אחר ובתאריך לא צפוי — ולכן היא נשארת שורה רגילה בדיוק במקום שבו היא נרשמה:
 * `n_var_expenses` (סניף), `n_multi_branch_expenses` (כמה סניפים) או `n_ah_expenses`
 * (העסק עצמו). הכסף נספר בהנה"ח בחודש שבו הוא יצא, ו**שום דבר כאן לא מזיז אף שקל**.
 *
 * מה שחסר היה לא מקום אחר לרשום בו אלא הידיעה ששתי השורות האלה הן אותו מוצר, ולכן
 * הפתרון הוא שדה אחד על ההוצאה (`expenseTypeId`) ולא מסך נפרד: מסמנים ברגע שרושמים את
 * הקנייה — הרגע היחיד שבו באמת יודעים את התשובה — והחיבור קורה מעצמו בכל מקום שבו
 * ההוצאות מוצגות (חדרי מחשבים, השכרות, משרד שיתופי, הנה"ח ראשית).
 *
 * הסוגים (`n_expense_types`) הם **גלובליים**: אותו "נייר למדפסת" שנקנה בחדר מחשבים
 * ובהשכרות הוא אותו מוצר, ופיצול לפי מודול היה מפצל בדיוק את המספר שהסימון נועד לאחד.
 * גם הסניפים לא מוגדרים על הסוג אלא **נגזרים מהשורות שסומנו** — הקנייה כבר יודעת אם
 * היא של סניף אחד, של כמה סניפים או של כל הסניפים.
 */
import { getAdminFirestore } from "./firebase-admin";
import type {
  AccountingExpense,
  Branch,
  MultiBranchExpense,
  RecurringPurchaseType,
  VariableExpense,
} from "@ultranet/shared-types";
import { MULTI_BRANCH_EXPENSES_COLLECTION } from "./multi-branch-expense";
import { isSharedExpenseBranch } from "./expense-shared-scope";

export const EXPENSE_TYPES_COLLECTION = "n_expense_types";

export type RecurringPurchaseModule = RecurringPurchaseType["module"];

/** הקולקשן שהרכישה נרשמה בו. אינו משנה את החישוב - רק את התווית "מאיפה זה". */
export type RecurringPurchaseSource = "variable" | "multi-branch" | "main";

export function currentYear(): string {
  return new Date().toISOString().slice(0, 4);
}

/** רכישה אחת של סוג חוזר, אחרי שהושטחה מהקולקשן שהיא חיה בו. */
export interface RecurringPurchase {
  id: string;
  typeId: string;
  source: RecurringPurchaseSource;
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

/**
 * כל הסוגים, בלי סינון לפי מודול.
 *
 * הסינון שהיה כאן הוא בדיוק מה שמנע את החיבור: "נייר למדפסת" שנוצר בהשכרות לא הוצע
 * בחדרי מחשבים, שם נוצר סוג שני באותו שם, ושני הסוגים החזיקו כל אחד חצי מהמספר.
 */
export async function loadRecurringPurchaseTypes(params?: {
  includeArchived?: boolean;
}): Promise<RecurringPurchaseType[]> {
  const snap = await getAdminFirestore().collection(EXPENSE_TYPES_COLLECTION).get();
  let rows = snap.docs.map(
    (d) => ({ ...(d.data() as Omit<RecurringPurchaseType, "id">), id: d.id }) as RecurringPurchaseType,
  );
  if (!params?.includeArchived) rows = rows.filter((r) => !r.archived);
  return rows.sort((a, b) => a.name.localeCompare(b.name, "he"));
}

/**
 * כל הרכישות החד-פעמיות משלושת הקולקשנים שאפשר לרשום בהם אחת, מחולקות לפי האם כבר
 * סומנו כסוג חוזר.
 *
 * `n_ah_expenses` נכלל כאן כי רכישה של העסק עצמו ("קניתי נייר למשרד") היא בדיוק אותו
 * מוצר שסניף קונה, וכל עוד היא לא נספרה החיבור היה חלקי — ודוח חלקי גרוע מאין דוח.
 *
 * הוצאה על כמה סניפים נספרת בסכום המלא שלה: השאלה היא "כמה הלך על נייר", והתשובה היא מה
 * שיצא מהכיס, לא החלק של סניף כזה או אחר.
 */
export async function loadPurchaseRows(): Promise<{
  tagged: RecurringPurchase[];
  untagged: RecurringPurchase[];
}> {
  const db = getAdminFirestore();
  const [varSnap, multiSnap, mainSnap] = await Promise.all([
    db.collection("n_var_expenses").get(),
    db.collection(MULTI_BRANCH_EXPENSES_COLLECTION).get(),
    db.collection("n_ah_expenses").get(),
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

  for (const d of mainSnap.docs) {
    const e = { ...(d.data() as Omit<AccountingExpense, "id">), id: d.id } as AccountingExpense;
    if (!e.date) continue;
    const row: RecurringPurchase = {
      id: e.id,
      typeId: e.expenseTypeId ?? "",
      source: "main",
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

/**
 * הסניפים שהסוג נוגע בהם - **נגזר מהשורות שסומנו**, לא מהגדרה על הסוג.
 *
 * זו הנקודה: הקנייה כבר יודעת על מי היא. קנייה של סניף אחד מביאה את הסניף שלה, קנייה
 * על כמה סניפים או על "כל הסניפים" מביאה את כולם, ורכישה של העסק עצמו לא מביאה אף אחד.
 * הגדרה ידנית של סניפים על הסוג הייתה מצריכה לתחזק פעמיים את אותו מידע, ולהיות לא
 * מסונכרנת ברגע שנפתח סניף.
 */
export function branchesOfPurchases(purchases: RecurringPurchase[], allBranches: Branch[]): Branch[] {
  const live = allBranches.filter((b) => !b.deleted);
  const ids = new Set<string>();
  let all = false;
  for (const p of purchases) {
    if (p.source === "multi-branch") all = true;
    else if (p.branchId && isSharedExpenseBranch(p.branchId)) all = true;
    else if (p.branchId) ids.add(p.branchId);
  }
  if (all) return live;
  return live.filter((b) => ids.has(b.id));
}

/** תווית לסניף של רכישה, כולל הסנטינלים של הוצאה משותפת. */
export function purchaseBranchLabel(
  purchase: RecurringPurchase,
  branchNameById: ReadonlyMap<string, string>,
): string {
  if (purchase.source === "multi-branch") return "כמה סניפים";
  if (purchase.source === "main") return "העסק עצמו";
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

  // דדופ לפי שם בלבד, בלי קשר למודול: מי שמקליד "נייר למדפסת" בחדר מחשבים ומי שמקליד
  // אותו דבר בהשכרות מתכוונים לאותו מוצר, ושני סוגים באותו שם היו מפצלים בדיוק את
  // המספר שהסימון נועד לאחד.
  const existing = await loadRecurringPurchaseTypes({ includeArchived: true });
  const hit = existing.find((t) => t.name.trim().toLowerCase() === name.toLowerCase());
  if (hit) return hit.id;

  const data: Omit<RecurringPurchaseType, "id"> = {
    name,
    module,
    createdAt: new Date().toISOString(),
  };
  const ref = await db.collection(EXPENSE_TYPES_COLLECTION).add(data);
  return ref.id;
}

/**
 * הסיכום של סוג אחד, כפי שהוא מוצג ליד ההוצאות עצמן.
 *
 * זה מה שהחליף את המסך הנפרד: אין "מודול רכישות חוזרות" להיכנס אליו, אלא שורה מסומנת
 * שיודעת להגיד ליד עצמה כמה בסך הכל הלך על המוצר הזה השנה, בכל העסק.
 */
export interface RecurringPurchaseTypeSummary {
  type: RecurringPurchaseType;
  /** כל הרכישות של הסוג, מהחדשה לישנה - בכל המודולים */
  purchases: RecurringPurchase[];
  year: string;
  thisYearTotal: number;
  thisYearCount: number;
  grandTotal: number;
  lastPurchase: RecurringPurchase | null;
  /** הסה"כ השנתי חלקי 12 - להשוואה מול הוצאה קבועה. מספר של דוח בלבד. */
  perMonth: number;
  /** הסניפים שהרכישות של הסוג נגעו בהם */
  branches: Branch[];
}

export function summarizeType(
  type: RecurringPurchaseType,
  allPurchases: RecurringPurchase[],
  allBranches: Branch[],
  year = currentYear(),
): RecurringPurchaseTypeSummary {
  const mine = allPurchases.filter((p) => p.typeId === type.id).sort((a, b) => b.date.localeCompare(a.date));
  const thisYear = mine.filter((p) => p.year === year);
  const thisYearTotal = thisYear.reduce((sum, p) => sum + p.amount, 0);
  return {
    type,
    purchases: mine,
    year,
    thisYearTotal,
    thisYearCount: thisYear.length,
    grandTotal: mine.reduce((sum, p) => sum + p.amount, 0),
    lastPurchase: mine[0] ?? null,
    // תמיד 12 ולא "החודשים שחלפו": השאלה היא כמה המוצר עולה בחודש ממוצע לאורך שנה.
    perMonth: thisYearTotal / 12,
    branches: branchesOfPurchases(mine, allBranches),
  };
}

/**
 * כל מה שמסך הוצאות צריך כדי להציג את החיבור: הסוגים לבחירה בטופס, והסיכום של כל סוג
 * לפי מזהה. קריאה אחת לכל מסך - ולכן אין צורך שאף מסך יחשב את זה בעצמו.
 */
export async function loadRecurringPurchaseIndex(): Promise<{
  types: RecurringPurchaseType[];
  byType: Map<string, RecurringPurchaseTypeSummary>;
}> {
  const db = getAdminFirestore();
  const [types, { tagged }, branchesSnap] = await Promise.all([
    loadRecurringPurchaseTypes({ includeArchived: true }),
    loadPurchaseRows(),
    db.collection("n_branches").get(),
  ]);
  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted);
  const year = currentYear();
  const byType = new Map(types.map((t) => [t.id, summarizeType(t, tagged, branches, year)]));
  return { types: types.filter((t) => !t.archived), byType };
}
