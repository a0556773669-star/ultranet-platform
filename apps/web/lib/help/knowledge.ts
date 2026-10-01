import type { Session } from "next-auth";
export { MODULE_LABELS, searchFaqs, type FaqMatch } from "./search";
import { getAssignments, isOwnerSession, unionPerms } from "@/lib/perms";
import type { HelpAudience, HelpFaq } from "./types";
import { OWNER_FAQ, OWNER_GUIDE } from "./kb-owner";
import { RENTER_FAQ, RENTER_GUIDE } from "./kb-renter";

/**
 * בסיס הידע שמשתמש מסוים רשאי לראות.
 *
 * מרכז העזרה לא חושף נתונים — רק "איך עושים" — אבל גם הסבר על מסך שאין לך אליו גישה הוא
 * רעש ומבלבל. לכן כל משתמש מקבל רק את מה שהוא רואה בפועל במערכת:
 * - בעלים (וכל מי שעובד על חשבון הבעלים, כמו המזכירה): הכל.
 * - שותף/עובד בסניף השכרות: מדריך המשכירים בלבד.
 * - משתמש עם הרשאות אחרות: שאלות מהמודולים שיש לו אליהם הרשאה, בלי מסכי בעלים.
 */
export type HelpScope = {
  audience: HelpAudience;
  faqs: HelpFaq[];
  guide: string;
};

/** מודולים במדריך הבעלים שמסכיהם פתוחים גם למי שאינו בעלים, כשיש לו את ההרשאה. */
const NON_OWNER_MODULES: Record<string, string | null> = {
  login: null,
  home: null,
  tutorials: null,
  computers: "computers",
  coworking: "coworking",
  duxus: "duxus",
  shop: "shop",
};

export function helpScopeFor(session: Session | null | undefined): HelpScope {
  if (isOwnerSession(session)) {
    return {
      audience: "owner",
      faqs: [...OWNER_FAQ, ...RENTER_FAQ],
      guide: `${OWNER_GUIDE}\n\n---\n\n# מסכי ההשכרות כפי שהשותף בסניף רואה אותם (גם הבעלים רואה אותם)\n\n${RENTER_GUIDE}`,
    };
  }
  const perms = unionPerms(getAssignments(session));
  const faqs: HelpFaq[] = [];
  if (perms.rentals) faqs.push(...RENTER_FAQ);
  faqs.push(
    ...OWNER_FAQ.filter((f) => {
      if (!(f.module in NON_OWNER_MODULES)) return false;
      const key = NON_OWNER_MODULES[f.module];
      // שאלות כלליות (התחברות/בית/הדרכות) כבר מכוסות במדריך המשכירים כשיש לו השכרות.
      if (key === null) return !perms.rentals && f.module === "login";
      return Boolean(perms[key as keyof typeof perms]);
    }),
  );
  return { audience: "renter", faqs, guide: perms.rentals ? RENTER_GUIDE : "" };
}
