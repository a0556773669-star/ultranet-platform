import type { DefaultSession } from "next-auth";
import type { PermissionKey, UserAssignment, UserRole } from "@ultranet/shared-types";

/**
 * `role` / `branchId` / `perms` הם תמיד של **הכובע שחל בהקשר הנוכחי**, לא בהכרח מה שנשמר
 * ב-`n_users`: `requireModuleAccess` מחליף אותם בערכי השיוך של המודול שנכנסים אליו.
 * `assignments` הוא הרשימה המלאה ואינו משתנה. ראה `apps/web/lib/perms.ts`.
 */
type UltranetUserFields = {
  role?: UserRole;
  branchId?: string;
  perms?: Partial<Record<PermissionKey, boolean>> | null;
  assignments?: UserAssignment[] | null;
  viewClientBranchIds?: string[];
};

declare module "next-auth" {
  interface Session {
    user: UltranetUserFields & DefaultSession["user"];
  }

  interface User extends UltranetUserFields {}
}

declare module "next-auth/jwt" {
  interface JWT extends UltranetUserFields {}
}
