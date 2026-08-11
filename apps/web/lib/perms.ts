import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";

export type PermKey = "branches" | "computers" | "rentals" | "coworking" | "accounting" | "tasks" | "charging" | "shop" | "duxus";

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
