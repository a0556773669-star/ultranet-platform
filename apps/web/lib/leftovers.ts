/**
 * "שאריות מהעבר" — רשומות שקיימות ב-Firestore ואין שום מסך שמציג אותן.
 *
 * המערכת הזו יושבת על ה-DB של `app.html` הישן בלי מיגרציה, וכל מסך במודולים מסנן לפי
 * הסניף הנבחר. לכן רשומה שה-`branchId` שלה מצביע על סניף שנמחק, על סניף מסוג אחר או על
 * מסמך שכבר לא קיים **נופלת מכל המסכים** — אבל ממשיכה להיספר במקומות שלא מסננים: כרטיסי
 * ההתראות בדף הבית ו-`loadMainLedger`. התוצאה היא הדבר הכי מבלבל שיכול לקרות בתוכנת
 * ניהול: התראה על כסף, בלי שום מקום לראות או לתקן בו את הרשומה שמאחוריה.
 *
 * הקובץ הזה הוא הצד השני של המשוואה: הוא סורק את הקולקשנים האלה ומחזיר בדיוק מה נפל,
 * למה, וכמה כסף מעורב בו — כדי שהמסך `/dashboard/maintenance` יוכל להראות את זה לבעלים.
 * הוא **לא מוחק כלום**: הסריקה היא דוח, וההחלטה על כל שורה היא של הבעלים.
 */
import { getAdminFirestore } from "./firebase-admin";
import type {
  Branch,
  CoworkingClient,
  CoworkingStation,
  FixedExpense,
  RecurringVariableExpense,
  VariableExpense,
} from "@ultranet/shared-types";
import { isSharedExpenseBranch } from "./expense-shared-scope";
import { countsToMain } from "./counts-to-main";
import { RECURRING_VAR_EXPENSES_COLLECTION, totalToDate } from "./recurring-expenses";

/** הקולקשנים שמסך התחזוקה רשאי למחוק מהם. רשימה סגורה, ולא פרמטר חופשי. */
export const LEFTOVER_COLLECTIONS = [
  "n_cw_clients",
  "n_cw_stations",
  "n_recurring_var_expenses",
  "n_fixed_expenses",
  "n_var_expenses",
] as const;

export type LeftoverCollection = (typeof LEFTOVER_COLLECTIONS)[number];

export interface LeftoverItem {
  collection: LeftoverCollection;
  id: string;
  /** מה זה, בשפה של הבעלים */
  title: string;
  /** עובדות מזהות: תאריכים, סניף, סכום */
  detail: string;
  /** למה אף מסך לא מציג את זה */
  reason: string;
  /** מה קורה לכסף אם מוחקים */
  moneyNote?: string;
  fixHref?: string;
  fixLabel?: string;
}

export interface LeftoverGroup {
  key: string;
  title: string;
  explain: string;
  items: LeftoverItem[];
}

export interface LeftoverReport {
  groups: LeftoverGroup[];
  total: number;
  /** כמה מסמכים נסרקו בסך הכל — כדי שיהיה ברור שהדוח באמת רץ */
  scanned: number;
}

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const SCOPE_LABELS: Record<string, string> = {
  computers: "חדרי מחשבים",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
  main: 'הנה"ח ראשית',
};

export async function loadLeftovers(): Promise<LeftoverReport> {
  const db = getAdminFirestore();
  const [branchesSnap, cwClientsSnap, cwStationsSnap, recurringSnap, fixedSnap, varSnap] = await Promise.all([
    db.collection("n_branches").get(),
    db.collection("n_cw_clients").get(),
    db.collection("n_cw_stations").get(),
    db.collection(RECURRING_VAR_EXPENSES_COLLECTION).get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
  ]);

  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const branchById = new Map(branches.map((b) => [b.id, b]));
  // סדר המסמכים הוא סדר ה-id, בדיוק כמו בשאילתות של המסכים — ולכן "הסניף הראשון" כאן הוא
  // אותו סניף שמסך ההנה"ח של המשרד השיתופי בוחר בפועל.
  const liveCoworking = branches.filter((b) => b.branchType === "coworking" && !b.deleted);
  const liveCoworkingIds = new Set(liveCoworking.map((b) => b.id));
  const firstCoworkingId = liveCoworking[0]?.id;
  const liveComputersIds = new Set(
    branches.filter((b) => b.branchType === "computers" && !b.deleted).map((b) => b.id),
  );

  /** למה הסניף שרשום ברשומה אינו סניף חי — או `null` אם הוא דווקא בסדר. */
  const branchProblem = (branchId: string | undefined, wanted: Branch["branchType"]): string | null => {
    if (!branchId) return "לא נרשם סניף ברשומה";
    const branch = branchById.get(branchId);
    if (!branch) return "הסניף שרשום ברשומה לא קיים יותר";
    if (branch.deleted) return `הסניף "${branch.name}" נמחק`;
    if (branch.branchType !== wanted) return `הסניף "${branch.name}" אינו סניף מהסוג הנכון`;
    return null;
  };

  const groups: LeftoverGroup[] = [];

  /* ── 1. השכרות משרד שיתופי ללא סניף פעיל ─────────────────────────────────── */
  const cwItems: LeftoverItem[] = [];
  for (const d of cwClientsSnap.docs) {
    const c = { ...(d.data() as Omit<CoworkingClient, "id">), id: d.id } as CoworkingClient;
    const problem = branchProblem(c.branchId, "coworking");
    if (!problem) continue;
    const payments = c.payments ?? [];
    const toMain = payments.filter((p) => countsToMain(p));
    cwItems.push({
      collection: "n_cw_clients",
      id: c.id,
      title: `${c.name}${c.stationNumber ? ` — עמדה ${c.stationNumber}` : ""}`,
      detail: `${c.startDate || "ללא תאריך התחלה"} — ${c.endDate ?? "ממשיך"}${
        c.phone ? ` · ${c.phone}` : ""
      }`,
      reason: problem,
      moneyNote:
        payments.length === 0
          ? "לא נרשמו עליה תשלומים — מחיקה לא משנה שום סכום."
          : `${payments.length} תשלומים בסך ${money(
              payments.reduce((s, p) => s + (p.amount || 0), 0),
            )}, מתוכם ${money(
              toMain.reduce((s, p) => s + (p.amount || 0), 0),
            )} נספרים בהנה"ח הראשית — מחיקה תגרע אותם משם.`,
      fixHref: "/dashboard/coworking",
      fixLabel: "לשיוך לסניף ולעמדה",
    });
  }
  groups.push({
    key: "cw-clients",
    title: "השכרות משרד שיתופי ללא סניף פעיל",
    explain:
      'אלה ההשכרות שמייצרות את כרטיס "תשלומי משרד שיתופי" בדף הבית בלי שיופיעו בעמדות. אפשר לשייך אותן לסניף ולעמדה (ואז הן חוזרות לתמונה) או למחוק אותן.',
    items: cwItems,
  });

  /* ── 2. הוצאות קבועות משתנות שאין להן מסך ────────────────────────────────── */
  const recurringItems: LeftoverItem[] = [];
  for (const d of recurringSnap.docs) {
    const e = { ...(d.data() as Omit<RecurringVariableExpense, "id">), id: d.id } as RecurringVariableExpense;
    let reason: string | null = null;
    if (e.scope === "main") {
      reason = null; // מסך ההוצאות הנוספות מציג את כל ה-main בלי סינון סניף
    } else if (e.scope === "computers") {
      reason = e.branchId && liveComputersIds.has(e.branchId) ? null : branchProblem(e.branchId, "computers");
    } else if (e.scope === "coworking") {
      if (!e.branchId || !liveCoworkingIds.has(e.branchId)) {
        reason = branchProblem(e.branchId, "coworking");
      } else if (e.branchId !== firstCoworkingId) {
        reason = 'מסך ההנה"ח של המשרד השיתופי מציג רק את הסניף הראשון';
      }
    } else if (e.scope === "rentals") {
      reason = "אין מסך שמציג הוצאות קבועות משתנות של מודול ההשכרות";
    } else {
      reason = "לרשומה אין scope מוכר, ולכן היא לא שייכת לשום מסך";
    }
    if (!reason) continue;

    const paid = totalToDate(e);
    recurringItems.push({
      collection: "n_recurring_var_expenses",
      id: e.id,
      title: `${e.name} · ${SCOPE_LABELS[e.scope] ?? e.scope ?? "ללא שיוך"}`,
      detail: `מ-${e.startDate || "ללא תאריך"}${e.endDate ? ` עד ${e.endDate}` : ""} · ${
        (e.amounts ?? []).length
      } חודשים שהוזנו`,
      reason,
      moneyNote:
        paid === 0
          ? "לא הוזנו סכומים — מחיקה לא משנה שום סכום."
          : `נרשמו ${money(paid)} לאורך החודשים${
              countsToMain(e) ? ' — נספרים בהנה"ח הראשית, ומחיקה תגרע אותם משם.' : " (לא נספרים בראשי)."
            }`,
    });
  }
  groups.push({
    key: "recurring",
    title: "הוצאות קבועות משתנות בלי מסך",
    explain:
      'אלה השורות שמייצרות את כרטיס "הוצאות קבועות לתשלום" בדף הבית. כשהשורה לא שייכת לסניף חי, אפשר לעדכן אותה רק מהבית — ואי אפשר לראות את ההיסטוריה שלה בשום מסך.',
    items: recurringItems,
  });

  /* ── 3. הוצאות על סניף שלא קיים ──────────────────────────────────────────── */
  const expenseItems: LeftoverItem[] = [];
  const pushExpense = (
    collection: "n_fixed_expenses" | "n_var_expenses",
    id: string,
    branchId: string | undefined,
    title: string,
    detail: string,
    amount: number,
    inMain: boolean,
  ) => {
    // הוצאה משותפת נשמרת תחת סנטינל (`shared-computers` וכו') ולא תחת סניף אמיתי — זה תקין.
    if (branchId && isSharedExpenseBranch(branchId)) return;
    const branch = branchId ? branchById.get(branchId) : undefined;
    const reason = !branchId
      ? "לא נרשם סניף בהוצאה"
      : !branch
        ? "הסניף שרשום בהוצאה לא קיים יותר"
        : branch.deleted
          ? `הסניף "${branch.name}" נמחק`
          : null;
    if (!reason) return;
    expenseItems.push({
      collection,
      id,
      title,
      detail,
      reason,
      moneyNote: inMain
        ? `${money(amount)} שנספרים בהנה"ח הראשית — מחיקה תגרע אותם משם.`
        : `${money(amount)} שאינם נספרים בהנה"ח הראשית.`,
    });
  };

  for (const d of fixedSnap.docs) {
    const e = { ...(d.data() as Omit<FixedExpense, "id">), id: d.id } as FixedExpense;
    pushExpense(
      "n_fixed_expenses",
      e.id,
      e.branchId,
      `${e.name} (קבועה)`,
      `${money(e.amount || 0)} לחודש · מ-${e.startDate || "ללא תאריך"}${e.endDate ? ` עד ${e.endDate}` : ""}`,
      e.amount || 0,
      countsToMain(e),
    );
  }
  for (const d of varSnap.docs) {
    const e = { ...(d.data() as Omit<VariableExpense, "id">), id: d.id } as VariableExpense;
    pushExpense(
      "n_var_expenses",
      e.id,
      e.branchId,
      `${e.desc} (משתנה)`,
      `${money(e.amount || 0)} · ${e.date || e.month || "ללא תאריך"}`,
      e.amount || 0,
      countsToMain(e),
    );
  }
  groups.push({
    key: "expenses",
    title: "הוצאות שרשומות על סניף שלא קיים",
    explain:
      'ההוצאות האלה לא מופיעות בשום מסך סניף, כי כל מסכי ההוצאות מסננים לפי סניף — אבל אם הן מסומנות "לחשבן בהנה\"ח הראשית" הן עדיין משפיעות על השורה התחתונה.',
    items: expenseItems,
  });

  /* ── 4. עמדות של סניף שאינו משרד שיתופי חי ───────────────────────────────── */
  const stationItems: LeftoverItem[] = [];
  for (const d of cwStationsSnap.docs) {
    const s = { ...(d.data() as Omit<CoworkingStation, "id">), id: d.id } as CoworkingStation;
    const problem = branchProblem(s.branchId, "coworking");
    if (!problem) continue;
    stationItems.push({
      collection: "n_cw_stations",
      id: s.id,
      title: `עמדה ${s.name || "ללא מספר"}`,
      detail: `מחיר ${money(s.price || 0)}`,
      reason: problem,
      moneyNote: "מסמך העמדה עצמו לא מחזיק כסף — התשלומים יושבים בהשכרות.",
    });
  }
  groups.push({
    key: "stations",
    title: "עמדות ללא סניף פעיל",
    explain:
      "מסמכי עמדה שנוצרו לסניף שכבר לא קיים. הם לא מזיקים, אבל גם לא משמשים לכלום — עמדה חדשה נוצרת מעצמה בפעם הראשונה שמשכירים אותה.",
    items: stationItems,
  });

  return {
    groups,
    total: groups.reduce((sum, g) => sum + g.items.length, 0),
    scanned:
      branchesSnap.size + cwClientsSnap.size + cwStationsSnap.size + recurringSnap.size + fixedSnap.size + varSnap.size,
  };
}
