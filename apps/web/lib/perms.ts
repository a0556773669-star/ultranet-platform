import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";
import type { BranchType, PermissionKey, UserAssignment, UserRole } from "@ultranet/shared-types";

export type PermKey = PermissionKey;

export const PERM_KEYS: readonly PermKey[] = [
  "branches",
  "computers",
  "rentals",
  "coworking",
  "accounting",
  "tasks",
  "charging",
  "shop",
  "duxus",
] as const;

type PermMap = Partial<Record<PermKey, boolean>>;

/**
 * לאיזה סוג סניף שייך כל מודול. זה מה שמכריע איזה כובע של משתמש רב-תפקידים חל היכן:
 * מי שהוא שותף בסניף השכרות **וגם** עובד בחדר מחשבים נכנס למודול ההשכרות כשותף של סניף
 * ההשכרות שלו, ולמודול חדרי המחשבים כעובד של חדר המחשבים שלו.
 *
 * `null` = מודול שאינו תלוי סניף (הנה"ח ראשית, חנות, משימות ונהלים); שם אין מה להכריע
 * ולכן נבחר הכובע החזק ביותר.
 */
const MODULE_BRANCH_TYPE: Record<PermKey, BranchType | null> = {
  branches: "computers",
  computers: "computers",
  tasks: "computers",
  rentals: "rentals",
  charging: "rentals",
  coworking: "coworking",
  accounting: null,
  shop: null,
  duxus: null,
};

const ROLE_RANK: Record<UserRole, number> = { employee: 1, partner: 2, owner: 3 };

function strongest(a: UserRole, b: UserRole): UserRole {
  return ROLE_RANK[a] >= ROLE_RANK[b] ? a : b;
}

type SessionUserFields = {
  role?: UserRole;
  branchId?: string;
  perms?: PermMap | null;
  assignments?: UserAssignment[] | null;
};

function userFields(session: Session | null | undefined): SessionUserFields {
  return (session?.user ?? {}) as SessionUserFields;
}

/**
 * הכובעים של המשתמש, תמיד כרשימה לא ריקה.
 *
 * משתמש בלי `assignments` (כלומר: כל מי שנשמר לפני הפיצ'ר, וכל מי שיש לו תפקיד אחד) מקבל
 * כאן שיוך יחיד שנגזר מ-`role`/`branchId`/`perms` — ולכן כל מה שמתחת רץ עליו בדיוק כמו
 * קודם, בלי מיגרציה ובלי הבדל התנהגותי.
 */
export function getAssignments(session: Session | null | undefined): UserAssignment[] {
  const user = userFields(session);
  const stored = Array.isArray(user.assignments) ? user.assignments.filter((a) => a && a.role) : [];
  if (stored.length > 0) return stored;
  return [
    {
      role: user.role ?? "employee",
      branchId: user.branchId ?? "",
      perms: user.perms ?? {},
    },
  ];
}

/** איחוד ההרשאות של כל הכובעים — מה שהמשתמש יכול להגיע אליו *באיזשהו* תפקיד. לניווט. */
export function unionPerms(assignments: UserAssignment[]): PermMap {
  const out: PermMap = {};
  for (const assignment of assignments) {
    for (const key of PERM_KEYS) {
      if (assignment.perms?.[key]) out[key] = true;
    }
  }
  return out;
}

/** התפקיד החזק ביותר מבין כל הכובעים. לתגית התפקיד בכותרת ולבדיקות ברמת בעלים. */
export function topRole(assignments: UserAssignment[]): UserRole {
  return assignments.reduce<UserRole>((acc, a) => strongest(acc, a.role), "employee");
}

export function isOwnerSession(session: Session | null | undefined): boolean {
  return getAssignments(session).some((a) => a.role === "owner");
}

/** ההקשר שבו המשתמש נמצא במודול מסוים: באיזה תפקיד, ועל אילו סניפים. */
export type ModuleScope = {
  key: PermKey;
  /** התפקיד שהמשתמש מחזיק **במודול הזה** (לא בהכרח התפקיד החזק ביותר שלו). */
  role: UserRole;
  isOwner: boolean;
  /** בעלים או שותף — כלומר מנהל, להבדיל מעובד. */
  isManager: boolean;
  /** האם יש לו גישה למודול בכלל. */
  granted: boolean;
  /** הסניפים שהוא מחזיק במודול הזה. ריק לבעלים — לבעלים יש את כולם. */
  branchIds: string[];
  /** הסניף הראשי במודול הזה, לשימושי "קח אותי לסניף שלי". */
  branchId: string | undefined;
  /** האם הסניף הזה בתחום השיוכים שלו במודול. בעלים — תמיד כן. */
  allows: (branchId: string) => boolean;
};

/**
 * בוחר את הכובעים הרלוונטיים למודול.
 *
 * כובע יחיד (כלומר: כמעט כל המשתמשים) חל בכל מקום, בדיוק כמו קודם. רק כשיש יותר מכובע
 * אחד יש מה להכריע, ואז ההכרעה היא לפי `branchType` של השיוך; אם אף שיוך לא תואם את סוג
 * הסניף של המודול — או שהמודול לא תלוי סניף — נלקחים כל הכובעים והתפקיד הוא החזק שבהם.
 */
function assignmentsForModule(assignments: UserAssignment[], key: PermKey): UserAssignment[] {
  if (assignments.length <= 1) return assignments;
  const wanted = MODULE_BRANCH_TYPE[key];
  if (!wanted) return assignments;
  const matching = assignments.filter((a) => a.branchType === wanted);
  return matching.length > 0 ? matching : assignments;
}

export function resolveModuleScope(session: Session | null | undefined, key: PermKey): ModuleScope {
  const all = getAssignments(session);
  const relevant = assignmentsForModule(all, key);
  const role = topRole(relevant);
  const isOwner = all.some((a) => a.role === "owner");
  const granted = isOwner || relevant.some((a) => Boolean(a.perms?.[key]));
  const branchIds = isOwner
    ? []
    : Array.from(new Set(relevant.map((a) => a.branchId).filter((id): id is string => Boolean(id))));

  return {
    key,
    role: isOwner ? "owner" : role,
    isOwner,
    isManager: isOwner || role === "partner",
    granted,
    branchIds,
    branchId: isOwner ? undefined : branchIds[0],
    allows: (branchId: string) => isOwner || branchIds.includes(branchId),
  };
}

/**
 * ה-session כפי שהוא נראה **מתוך מודול מסוים**: `role` / `branchId` / `perms` מוחלפים בערכי
 * הכובע שחל שם.
 *
 * זה מה שמאפשר לכל המסכים להמשיך לקרוא `session.user?.branchId` כאילו יש סניף אחד — למשתמש
 * עם כובע אחד אלה בדיוק הערכים המקוריים, ולמשתמש רב-תפקידים אלה הערכים הנכונים למודול
 * שהוא נמצא בו. בדיקות שנוגעות ביותר מסניף אחד צריכות את `ModuleScope.allows` ולא את השדה.
 */
function sessionForScope(session: Session, scope: ModuleScope): Session {
  return {
    ...session,
    user: {
      ...session.user,
      role: scope.role,
      branchId: scope.isOwner ? (userFields(session).branchId ?? "all") : (scope.branchId ?? ""),
      perms: unionPerms(getAssignments(session)),
    },
  } as Session;
}

/**
 * ההקשר הנוכחי במודול, בלי הפניה — ל-Server Actions, שזורקות שגיאה ולא מפנות.
 * מחזיר `null` כשאין session בכלל.
 */
export async function currentModuleScope(key: PermKey): Promise<ModuleScope | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return resolveModuleScope(session, key);
}

/**
 * ה-session כפי שהוא נראה מתוך מודול מסוים, ל-Server Actions.
 *
 * **לא** בודק הרשאה — שער הכניסה למודול כבר עשה את זה במסך שממנו ה-action נקרא; מה שזה
 * נותן הוא שכל `session.user?.role` / `branchId` בתוך הקובץ מדבר על הכובע הנכון, במקום על
 * הכובע הראשון של המשתמש. פעולות שנוגעות בסניף ספציפי צריכות גם בדיקת סניף משלהן.
 */
export async function scopedSession(key: PermKey): Promise<Session> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("יש להתחבר");
  return sessionForScope(session, resolveModuleScope(session, key));
}

/**
 * התפקיד שהמשתמש מחזיק בסניף מסוים, **מכל הכובעים שלו** ובלי תלות במודול. `undefined` =
 * אין לו שם כובע בכלל.
 *
 * זה מה שצריך כשהסניף מגיע מבחוץ (מזהה בטופס) והקוד משותף לכמה סוגי סניפים — למשל
 * `components/recurring-expenses`, שמשרת גם חדרי מחשבים וגם השכרות.
 */
export function roleAtBranch(session: Session | null | undefined, branchId: string): UserRole | undefined {
  const assignments = getAssignments(session);
  if (assignments.some((a) => a.role === "owner")) return "owner";
  const hats = assignments.filter((a) => a.branchId && a.branchId === branchId);
  return hats.length > 0 ? topRole(hats) : undefined;
}

export type ModuleAccessOptions = {
  /**
   * חוסם עובדים ומשאיר את המסך לבעלים ולשותפים בלבד.
   *
   * זה הגבול בין "לתפעל" לבין "לראות כמה זה שווה": עובד בחדר מחשבים מתפעל מלאי ומשימות,
   * ואת ההוצאות וההנה"ח של הסניף רואה רק מי שמנהל אותו. ראה סעיף 5 ב-SPEC.
   */
  managerOnly?: boolean;
};

async function gate(keys: readonly PermKey[], options: ModuleAccessOptions) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const scopes = keys.map((key) => resolveModuleScope(session, key));
  // המפתח הראשון הוא זה שקובע את ההקשר (הסניף והתפקיד); שאר המפתחות הם דרכי כניסה חלופיות.
  const scope = scopes[0]!;
  if (!scopes.some((s) => s.granted)) {
    redirect("/dashboard");
  }
  if (options.managerOnly && !scope.isManager) {
    redirect("/dashboard");
  }
  return { session: sessionForScope(session, scope), scope };
}

/**
 * Owners always pass. Partners/employees pass only if the hat that applies in this module has
 * `perms[key] === true`. Redirects to /dashboard when access is denied, and to /login when
 * there's no session at all.
 */
export async function requireModuleAccess(key: PermKey, options: ModuleAccessOptions = {}) {
  const { session } = await gate([key], options);
  return session;
}

/**
 * כניסה למסך שמספיקה לו **אחת** מכמה הרשאות.
 *
 * הראשונה ברשימה קובעת את הסניף והתפקיד; השאר הן דרכי כניסה חלופיות. זה מה שמאפשר למסך
 * המשימות לקבל גם את מי שיש לו `computers` (מלאי, וממילא גם משימות — ההתנהגות ההיסטורית)
 * וגם את מי שיש לו `tasks` בלבד.
 */
export async function requireAnyModuleAccess(keys: readonly PermKey[], options: ModuleAccessOptions = {}) {
  const { session } = await gate(keys, options);
  return session;
}

export async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  if (!isOwnerSession(session)) {
    redirect("/dashboard");
  }
  return session;
}
