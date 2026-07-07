import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";
import { cookies } from "next/headers";
import { DEVICE_TRUST_COOKIE, verifyDeviceToken } from "@/lib/device-trust";
import { TopNav } from "./top-nav";
import type { PermKey } from "@/lib/perms";

type NavItem = { href: string; label: string; icon: string; perm?: PermKey };

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "בית", icon: "🏠" },
  { href: "/dashboard/branches", label: "סניפים", icon: "🏢", perm: "branches" },
  { href: "/dashboard/inventory", label: "מלאי", icon: "📦", perm: "computers" },
  { href: "/dashboard/tasks", label: "משימות", icon: "✅", perm: "tasks" },
  { href: "/dashboard/tickets", label: "פניות", icon: "🔧", perm: "computers" },
  { href: "/dashboard/news", label: "עדכונים", icon: "📢" },
  { href: "/dashboard/orders", label: "הזמנות", icon: "🛍️", perm: "computers" },
  { href: "/dashboard/rentals", label: "השכרות", icon: "💻", perm: "rentals" },
  { href: "/dashboard/coworking", label: "קוורקינג", icon: "🪩", perm: "coworking" },
  { href: "/dashboard/accounting", label: "הנה\"ח", icon: "📊", perm: "accounting" },
];

function visibleFor(role: string, perms: Partial<Record<PermKey, boolean>> | null | undefined, item: NavItem) {
  if (!item.perm) return true;
  if (role === "owner") return true;
  return Boolean(perms?.[item.perm]);
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }
  const email = session.user?.email ?? "";
  const deviceToken = cookies().get(DEVICE_TRUST_COOKIE)?.value;
  if (!verifyDeviceToken(deviceToken, email)) {
    redirect("/verify-device");
  }

  const role = session.user?.role ?? "";
  const perms = (session.user as { perms?: Partial<Record<PermKey, boolean>> } | undefined)?.perms;
  const name = session.user?.name ?? session.user?.email ?? "";

  const items = NAV_ITEMS.filter((item) => visibleFor(role, perms, item));
  if (role === "owner") {
    items.push({ href: "/dashboard/users", label: "משתמשים", icon: "👥" });
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-white px-6 py-3">
        <div className="text-xl font-bold text-teal">אולטרנט</div>
        <TopNav items={items} />
        <div className="flex items-center gap-2 text-sm text-muted">
          <span>
            שלום, <span className="font-medium text-ink">{name}</span>
          </span>
          {role && (
            <span className="rounded-full border border-teal px-2 py-0.5 text-xs text-teal-dark">{role}</span>
          )}
          <SignOutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
