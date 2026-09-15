/** ראה `./types.ts` — מסך זמני. */
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import {
  SHARED_RENTALS_BRANCH_ID,
  SHARED_COMPUTERS_BRANCH_ID,
  SHARED_COWORKING_BRANCH_ID,
} from "@/lib/expense-shared-scope";

/**
 * `n_fixed_expenses` ו-`n_var_expenses` משותפים לכל המודולים (השכרות, חדרי מחשבים, משרד
 * שיתופי) ומופרדים רק לפי `branchId`. המסך הזה נוגע בהשכרות בלבד, ולכן גם התצוגה וגם
 * המחיקה נגזרות מאותו היקף אחד שמחושב כאן — כדי שלא יקרה שמסמנים משהו שהמחיקה לא תיגע בו,
 * או להפך.
 */
export interface RentalsExpenseScope {
  /** סניפי ההשכרות, כולל כאלה שנמחקו (soft-delete) — ההוצאות שלהם עדיין קיימות וצריכות ניקוי */
  branches: Branch[];
  /** שם לכל סניף בכל המודולים, לתצוגה בלבד */
  branchNameById: Map<string, string>;
  /** כל מזהי הסניפים שקיימים ב-n_branches */
  knownBranchIds: Set<string>;
  /** מזהי סניפי ההשכרות + הסנטינל של "כל סניפי ההשכרות" */
  rentalsBranchIds: Set<string>;
}

const OTHER_MODULE_SENTINELS = new Set([SHARED_COMPUTERS_BRANCH_ID, SHARED_COWORKING_BRANCH_ID]);

export async function loadRentalsExpenseScope(): Promise<RentalsExpenseScope> {
  const snap = await getAdminFirestore().collection("n_branches").get();
  const all = snap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const branches = all
    .filter((b) => b.branchType === "rentals")
    .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
  return {
    branches,
    branchNameById: new Map(all.map((b) => [b.id, b.name])),
    knownBranchIds: new Set(all.map((b) => b.id)),
    rentalsBranchIds: new Set([...branches.map((b) => b.id), SHARED_RENTALS_BRANCH_ID]),
  };
}

/**
 * האם שורה עם ה-`branchId` הזה שייכת למסך הזה.
 *
 * סניף השכרות או הסנטינל המשותף — כן. סנטינל של מודול אחר — לא. `branchId` שאין לו סניף
 * ב-`n_branches` בכלל הוא שורה יתומה: אי אפשר לדעת לאיזה מודול היא הייתה שייכת, היא לא
 * מוצגת באף מסך אחר, וזה בדיוק סוג הזבל שהמסך הזה נועד לנקות — ולכן היא נכללת, בקבוצה
 * נפרדת ומסומנת.
 */
export function belongsToRentalsCleanup(scope: RentalsExpenseScope, branchId: string | undefined): boolean {
  if (!branchId) return false;
  if (scope.rentalsBranchIds.has(branchId)) return true;
  if (OTHER_MODULE_SENTINELS.has(branchId)) return false;
  return !scope.knownBranchIds.has(branchId);
}
