import type { ModuleScope } from "./perms";

/** הסניף של בקשה שנוצרה ע"י משתמש שלא שויך לסניף (ראו `resolveBranch`). */
export const UNASSIGNED_BRANCH_ID = "unassigned";

/** מי רשאי לראות/לטפל בבקשת חנות: בעלים, מי שמשויך לסניף הבקשה, או (בקשה בלי סניף) מי שיצר אותה. */
export function canAccessStoreRequest(
  scope: Pick<ModuleScope, "isOwner" | "allows"> | null | undefined,
  request: { branchId: string; createdByEmail?: string },
  email?: string | null,
): boolean {
  if (!scope) return false;
  if (scope.isOwner || scope.allows(request.branchId)) return true;
  return request.branchId === UNASSIGNED_BRANCH_ID && !!email && request.createdByEmail === email;
}
