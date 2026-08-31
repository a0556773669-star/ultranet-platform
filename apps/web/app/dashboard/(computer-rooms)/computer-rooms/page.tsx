import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { PermKey } from "@/lib/perms";

const FIRST_TAB: { href: string; perm?: PermKey }[] = [
  { href: "/dashboard/branches", perm: "branches" },
  { href: "/dashboard/inventory", perm: "computers" },
  { href: "/dashboard/tasks", perm: "tasks" },
  { href: "/dashboard/tickets", perm: "computers" },
  { href: "/dashboard/news" },
  { href: "/dashboard/orders", perm: "computers" },
];

export default async function ComputerRoomsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user?.role ?? "employee";
  const isOwner = role === "owner";
  const perms = (session.user as { perms?: Partial<Record<PermKey, boolean>> } | undefined)?.perms;
  const has = (key?: PermKey) => !key || isOwner || Boolean(perms?.[key]);

  const firstTab = FIRST_TAB.find((tab) => has(tab.perm));
  redirect(firstTab?.href ?? "/dashboard");
}
