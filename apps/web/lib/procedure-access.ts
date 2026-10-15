import type { Session } from "next-auth";
import type { Procedure, ProcedureAudience } from "@ultranet/shared-types";
import { getAssignments, isOwnerSession, resolveModuleScope } from "@/lib/perms";

/**
 * מי רשאי לצפות בנוהל (אפיון שדרוג v2, סעיף 12). אותה בדיקה בכל מקום שנוהל מוצג — רשימה,
 * כרטיס, חיפוש וקישור ישיר — כדי שקישור לא יעקוף את ההרשאה.
 *
 * - בעלים (וגם המזכירה, שעובדת על החשבון שלו) רואה הכול.
 * - `audience` חסר = **בדיוק ההרשאה של היום**: מי שיש לו את מודול `duxus`.
 * - "branch_managers" = מי שיש לו כובע שותף בסניף כלשהו.
 * - "users" = המייל ברשימה.
 */
export function canViewProcedure(session: Session | null | undefined, procedure: Pick<Procedure, "audience">): boolean {
  if (!session) return false;
  if (isOwnerSession(session)) return true;
  const audience: ProcedureAudience = procedure.audience ?? { mode: "duxus" };
  switch (audience.mode) {
    case "owner":
      return false;
    case "duxus":
      return resolveModuleScope(session, "duxus").granted;
    case "branch_managers":
      return getAssignments(session).some((a) => a.role === "partner");
    case "users": {
      const email = (session.user?.email ?? "").toLowerCase();
      return Boolean(email) && (audience.userEmails ?? []).includes(email);
    }
    default:
      return false;
  }
}

export { AUDIENCE_LABEL } from "@/lib/procedure-audience";

/** קריאת השדה מהטופס. ערך לא מוכר → הנהלה בלבד (הבחירה הבטוחה). */
export function readAudience(formData: FormData): ProcedureAudience {
  const mode = String(formData.get("audienceMode") ?? "owner");
  if (mode === "duxus" || mode === "branch_managers") return { mode };
  if (mode === "users") {
    const userEmails = Array.from(
      new Set(formData.getAll("audienceEmails").map((v) => String(v).trim().toLowerCase()).filter(Boolean)),
    );
    return { mode, userEmails };
  }
  return { mode: "owner" };
}
