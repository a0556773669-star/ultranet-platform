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
