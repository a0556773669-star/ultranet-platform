import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";

/**
 * One module, one key. The other eight keys guarded modules that no longer exist; keeping them
 * would leave permission checks in the code that nothing can ever fail, which is worse than
 * having none - it reads like protection and protects nothing.
 */
export type PermKey = "accounting";

/**
 * Owners always pass. Partners/employees pass only if their n_users.perms[key] is true.
 * Redirects to /dashboard when access is denied, and to /login when there's no session at all.
 */
export async function requireModuleAccess(key: PermKey) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const role = session.user?.role;
  if (role === "owner") {
    return session;
  }
  const perms = (session.user as { perms?: Partial<Record<PermKey, boolean>> } | undefined)?.perms;
  if (!perms?.[key]) {
    redirect("/dashboard");
  }
  return session;
}

export async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  if (session.user?.role !== "owner") {
    redirect("/dashboard");
  }
  return session;
}
