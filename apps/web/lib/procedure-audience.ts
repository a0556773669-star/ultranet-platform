import type { ProcedureAudience } from "@ultranet/shared-types";

/** תוויות "מי רשאי לצפות" — קובץ נפרד בלי תלות בשרת, כדי שטופס הנוהל (קוד דפדפן) יוכל לייבא אותו. */
export const AUDIENCE_LABEL: Record<ProcedureAudience["mode"], string> = {
  duxus: "כל מי שיש לו גישה למשימות ונהלים (כמו קודם)",
  owner: "הנהלה בלבד",
  branch_managers: "כל מנהלי הסניפים",
  users: "משתמשים נבחרים",
};
