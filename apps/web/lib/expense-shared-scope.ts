/**
 * Sentinel `branchId` values for a fixed/variable expense that applies to ALL branches of one
 * module together (e.g. shared advertising, shared software licenses) rather than to a single
 * branch. Kept distinct per module (rentals vs. computer-rooms vs. coworking) since all modules'
 * branches live in the same `n_branches`/`n_fixed_expenses`/`n_var_expenses` collections.
 */
export const SHARED_RENTALS_BRANCH_ID = "shared-rentals";
export const SHARED_COMPUTERS_BRANCH_ID = "shared-computers";
export const SHARED_COWORKING_BRANCH_ID = "shared-coworking";

export function isSharedExpenseBranch(branchId: string): boolean {
  return (
    branchId === SHARED_RENTALS_BRANCH_ID ||
    branchId === SHARED_COMPUTERS_BRANCH_ID ||
    branchId === SHARED_COWORKING_BRANCH_ID
  );
}

/**
 * היקף הסניפים של הוצאה משותפת.
 *
 * הוצאה משותפת נשמרת תחת סנטינל אחד (`shared-computers` וכו') ולא תחת סניף אמיתי, ולכן עד
 * היום היא התחלקה אוטומטית בין *כל* סניפי המודול — כולל סניף שנפתח אתמול ולא היה קיים
 * כשההוצאה נרשמה. `branchIds` הוא הבורר: שדה חסר או ריק שומר על ההתנהגות ההיסטורית (כל
 * הסניפים, גם עתידיים), ורשימה מפורשת מצמצמת את ההוצאה לסניפים שנבחרו בלבד.
 *
 * הרשימה תמיד מוצלבת מול הסניפים הקיימים: סניף שנמחק (soft-delete) או שכבר לא במודול לא
 * ממשיך להחזיק חלק בהוצאה, אחרת המחלק היה גדול מכמות הסניפים שמופיעים על המסך ואותה הוצאה
 * הייתה מוצגת בשני סכומים שונים.
 */
export function sharedExpenseBranchIds(
  expense: { branchIds?: string[] },
  allBranchIds: readonly string[],
): string[] {
  const chosen = expense.branchIds;
  if (!chosen || chosen.length === 0) return [...allBranchIds];
  const chosenSet = new Set(chosen);
  return allBranchIds.filter((id) => chosenSet.has(id));
}

/** האם הוצאה משותפת חלה על הסניף הזה (אחרי הצלבה מול הסניפים הקיימים). */
export function sharedExpenseAppliesTo(
  expense: { branchIds?: string[] },
  branchId: string,
  allBranchIds: readonly string[],
): boolean {
  return sharedExpenseBranchIds(expense, allBranchIds).includes(branchId);
}

/** התווית שמסבירה על מי ההוצאה חלה, למשל "כל הסניפים" או "אלעד · בני ברק". */
export function sharedExpenseScopeLabel(
  expense: { branchIds?: string[] },
  branchNameById: ReadonlyMap<string, string>,
): string {
  const chosen = expense.branchIds;
  if (!chosen || chosen.length === 0) return "כל הסניפים (כולל סניפים שייפתחו)";
  // סניף שנמחק נשאר ברשימה השמורה אבל כבר לא מחזיק חלק בהוצאה - מוצג ככזה ולא כמזהה גולמי.
  const names = chosen.map((id) => branchNameById.get(id) ?? "סניף שנמחק");
  return names.length > 0 ? names.join(" · ") : "אין סניפים פעילים";
}

/**
 * קריאת בחירת הסניפים מהטופס. הטופס שולח `branchScope` = "all" | "selected" ואת הסניפים
 * שנבחרו ב-`branchIds`. מחזיר `undefined` כשההוצאה חלה על כל הסניפים — כדי שהשדה כלל לא
 * ייכתב ל-Firestore ומסמכים ישנים יישארו כפי שהם.
 */
export function sharedExpenseBranchIdsFromForm(formData: {
  get(name: string): unknown;
  getAll(name: string): unknown[];
}): string[] | undefined {
  if (String(formData.get("branchScope") ?? "all") !== "selected") return undefined;
  const ids = formData
    .getAll("branchIds")
    .map((v) => String(v).trim())
    .filter(Boolean);
  return ids.length > 0 ? Array.from(new Set(ids)) : undefined;
}
