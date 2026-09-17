import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAssignments, resolveModuleScope, unionPerms, type PermKey } from "@/lib/perms";

/** אותו סדר וכללים כמו ב-`ComputerRoomsTabs` — זה הטאב הראשון שהמשתמש באמת יכול לפתוח. */
const FIRST_TAB: { href: string; perm: PermKey[]; managerOnly?: boolean }[] = [
  { href: "/dashboard/branches", perm: ["branches"], managerOnly: true },
  { href: "/dashboard/operations", perm: ["computers", "tasks"] },
  { href: "/dashboard/expenses", perm: ["computers"], managerOnly: true },
];

export default async function ComputerRoomsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const scope = resolveModuleScope(session, "computers");
  const perms = unionPerms(getAssignments(session));
  const has = (key: PermKey) => scope.isOwner || Boolean(perms[key]);

  const firstTab = FIRST_TAB.find(
    (tab) => (!tab.managerOnly || scope.isManager) && tab.perm.some(has),
  );
  redirect(firstTab?.href ?? "/dashboard");
}
