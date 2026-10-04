import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { resolveModuleScope } from "./perms";
import { getAdminFirestore } from "./firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import type { OpsBranch } from "./operations-shared";

export type { OpsBranch } from "./operations-shared";
export {
  appliesToBranch,
  checkDocId,
  formatPeriod,
  getMonthKey,
  getWeekKey,
  periodKeyForFreq,
} from "./operations-shared";

export const OPS_STOCK_ITEMS = "n_ops_stock_items";
export const OPS_STOCK_CHECKS = "n_ops_stock_checks";
export const OPS_TASKS = "n_ops_tasks";
export const OPS_TASK_CHECKS = "n_ops_task_checks";

export async function listComputerBranches(): Promise<OpsBranch[]> {
  const snap = await getAdminFirestore()
    .collection("n_branches")
    .where("branchType", "==", "computers")
    .get();
  return snap.docs
    .map((d) => {
      const data = d.data() as Omit<Branch, "id">;
      return { id: d.id, name: data.name ?? d.id };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

export type OpsAccess = {
  isOwner: boolean;
  /** הסניפים שהמשתמש רשאי לראות ולעדכן. מנהל סניף — הסניף שלו בלבד. */
  branches: OpsBranch[];
  userLabel: string;
};

/**
 * מי רואה מה. הבעלים רואה את כל סניפי חדרי המחשבים; כל אחד אחר רואה אך ורק את
 * הסניף שמשויך אליו (`n_users.branchId`). ההפרדה הזו נאכפת גם בכל Server Action
 * דרך `assertBranchAllowed`, ולא רק בתצוגה.
 */
export async function getOpsAccess(): Promise<OpsAccess> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("יש להתחבר למערכת");
  // הכובע שחל בחדרי מחשבים, ולא התפקיד הראשי: `scope.allows` מכסה גם מי שמשויך ליותר
  // מחדר מחשבים אחד, מה ש-`branchId` יחיד מעולם לא ידע לבטא.
  const scope = resolveModuleScope(session, "computers");
  const isOwner = scope.isOwner;
  const all = await listComputerBranches();
  const branches = isOwner ? all : all.filter((b) => scope.allows(b.id));
  return {
    isOwner,
    branches,
    userLabel: session.user?.name ?? session.user?.email ?? "",
  };
}

export function assertBranchAllowed(access: OpsAccess, branchId: string) {
  if (!access.branches.some((b) => b.id === branchId)) {
    throw new Error("אין הרשאה לסניף הזה");
  }
}
