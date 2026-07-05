import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";
import { cookies } from "next/headers";
import { DEVICE_TRUST_COOKIE, verifyDeviceToken } from "@/lib/device-trust";
import { TopNav } from "./top-nav";

const NAV_ITEMS = [
  { href: "/dashboard", label: "בית", icon: "🏠" },
  { href: "/dashboard/branches", label: "סניפים", icon: "🏢" },
  { href: "/dashboard/inventory", label: "מלאי", icon: "📦" },
  { href: "/dashboard/tasks", label: "משימות", icon: "✅" },
  { href: "/dashboard/tickets", label: "פניות", icon: "🔧" },
  { href: "/dashboard/news", label: "עדכונים", icon: "📢" },
  { href: "/dashboard/orders", label: "הזמנות", icon: "🛒" },
  { href: "/dashboard/rentals", label: "השכרות", icon: "💻" },
  { href: "/dashboard/coworking", label: "קוורקינג", icon: "🪩" },
  { href: "/dashboard/accounting", label: "הנה\"ח", icon: "📊" },
];

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
  const name = session.user?.name ?? session.user?.email ?? "";

  return (
    <div className="min-h-screen bg-page">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-white px-6 py-3">
        <div className="text-xl font-bold text-teal">אולטרנט</div>
        <TopNav items={NAV_ITEMS} />
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
