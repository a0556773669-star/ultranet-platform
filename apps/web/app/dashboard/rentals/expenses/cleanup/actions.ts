"use server";
/** ראה `./types.ts` — מסך זמני. */
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { DocumentReference } from "firebase-admin/firestore";
import type { FixedExpense, MultiBranchExpense, VariableExpense } from "@ultranet/shared-types";
import { MULTI_BRANCH_EXPENSES_COLLECTION } from "@/lib/multi-branch-expense";
import { belongsToRentalsCleanup, loadRentalsExpenseScope } from "./scope";
import type { CleanupSelection } from "./types";

/** מחיקה המונית היא פעולה של בעלים בלבד — היא חוצה סניפים שמנהל סניף לא רואה בכלל. */
async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  if (session.user?.role !== "owner") throw new Error("אין הרשאה");
  return session;
}

/** גג לכל לחיצה, כדי שלא ננסה למחוק את כל הדאטאבייס בבקשה אחת */
const MAX_PER_CALL = 1000;
/** מגבלת הכתיבות ב-batch של Firestore היא 500; שורה אחת יכולה לייצר שתי מחיקות */
const WRITES_PER_BATCH = 400;

const COLLECTION_BY_KIND = {
  fixed: "n_fixed_expenses",
  variable: "n_var_expenses",
  multi: MULTI_BRANCH_EXPENSES_COLLECTION,
} as const;

function revalidateAll() {
  revalidatePath("/dashboard/rentals/expenses");
  revalidatePath("/dashboard/rentals/expenses/cleanup");
  revalidatePath("/dashboard/rentals/accounting");
  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/accounting/extra-expenses");
  revalidatePath("/dashboard");
}

/**
 * מוחקת את כל השורות שסומנו.
 *
 * כל שורה נטענת ונבדקת מחדש בשרת: ה-id שהגיע מהדפדפן לא מוכיח שהשורה באמת שייכת למודול
 * ההשכרות (הקולקשנים משותפים לכל המודולים), ולכן שורה שלא עוברת את `belongsToRentalsCleanup`
 * פשוט מדולגת ונספרת ב-`skipped` במקום להימחק.
 *
 * `linkedAhExpenseId` הוא עותק ישן בספר של הבעלים (`n_ah_expenses`) שנוצר לפני שהמנגנון
 * בוטל (ראה `lib/branch-expense-ledger.ts`) — הוא נמחק יחד עם השורה, בדיוק כמו במחיקה בודדת.
 */
export async function bulkDeleteRentalsExpensesAction(
  items: CleanupSelection[],
): Promise<{ deleted: number; skipped: number }> {
  await requireOwner();

  const unique = new Map<string, CleanupSelection>();
  for (const item of items ?? []) {
    const kind = item?.kind;
    const id = String(item?.id ?? "").trim();
    if (!id || !(kind in COLLECTION_BY_KIND)) continue;
    unique.set(`${kind}:${id}`, { id, kind });
  }
  const selections = [...unique.values()];
  if (selections.length === 0) throw new Error("לא סומנה אף שורה");
  if (selections.length > MAX_PER_CALL) {
    throw new Error(`אפשר למחוק עד ${MAX_PER_CALL} שורות בפעם אחת — סמן פחות שורות ותמחק בכמה פעימות`);
  }

  const db = getAdminFirestore();
  const scope = await loadRentalsExpenseScope();
  const refs = selections.map((s) => db.collection(COLLECTION_BY_KIND[s.kind]).doc(s.id));

  // getAll מוגבל במספר המסמכים לבקשה — נטען במנות.
  const docs = [];
  for (let i = 0; i < refs.length; i += 250) {
    docs.push(...(await db.getAll(...refs.slice(i, i + 250))));
  }

  const toDelete: DocumentReference[] = [];
  let skipped = 0;
  let deleted = 0;

  docs.forEach((doc, index) => {
    const selection = selections[index];
    if (!selection) return;
    const kind = selection.kind;
    const data = doc.data();
    if (!data) {
      skipped += 1;
      return;
    }
    if (kind === "multi") {
      const expense = data as Omit<MultiBranchExpense, "id">;
      if (expense.module !== "rentals") {
        skipped += 1;
        return;
      }
      if (expense.linkedAhExpenseId) toDelete.push(db.collection("n_ah_expenses").doc(expense.linkedAhExpenseId));
    } else {
      // `n_fixed_expenses` ו-`n_var_expenses` חולקים את שני השדות שמעניינים כאן.
      const expense = data as Pick<FixedExpense, "branchId"> & Pick<VariableExpense, "linkedAhExpenseId">;
      if (!belongsToRentalsCleanup(scope, expense.branchId)) {
        skipped += 1;
        return;
      }
      if (kind === "variable" && expense.linkedAhExpenseId) {
        toDelete.push(db.collection("n_ah_expenses").doc(expense.linkedAhExpenseId));
      }
    }
    toDelete.push(doc.ref);
    deleted += 1;
  });

  for (let i = 0; i < toDelete.length; i += WRITES_PER_BATCH) {
    const batch = db.batch();
    for (const ref of toDelete.slice(i, i + WRITES_PER_BATCH)) batch.delete(ref);
    await batch.commit();
  }

  revalidateAll();
  return { deleted, skipped };
}
