import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Users } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";
import { cookies } from "next/headers";
import { DEVICE_TRUST_COOKIE, verifyDeviceToken } from "@/lib/device-trust";
import { TopNav } from "./top-nav";
import type { PermKey } from "@/lib/perms";

import { NAV_ITEMS, visibleFor } from "@/lib/nav-items";
import { getAdminFirestore } from "@/lib/firebase-admin";

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
    items.push({ href: "/dashboard/users", label: "משתמשים", icon: Users });
  }

  let logoUrl = "";
  try {
    const logoDoc = await getAdminFirestore().collection("n_label_settings").doc("default").get();
    logoUrl = String((logoDoc.data() as { logoUrl?: string } | undefined)?.logoUrl ?? "");
  } catch {
    logoUrl = "";
  }

  return (
    <div className="min-h-screen bg-page">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-white px-6 py-3">
        <div className="flex items-center">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="אולטרנט" className="h-12 w-auto object-contain" />
          ) : (
            <span className="text-xl font-extrabold tracking-tight text-teal">אולטרנט</span>
          )}
        </div>
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
