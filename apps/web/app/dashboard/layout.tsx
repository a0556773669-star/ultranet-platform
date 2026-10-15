import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";
import { cookies } from "next/headers";
import { DEVICE_TRUST_COOKIE, verifyDeviceToken } from "@/lib/device-trust";
import { SideNav } from "./side-nav";
import { getAssignments, isOwnerSession, topRole, unionPerms } from "@/lib/perms";

import { NAV_ITEMS, visibleFor } from "@/lib/nav-items";
import { getLogoSrc } from "@/lib/branding";

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

  // הניווט הוא של **האדם**, לא של מודול מסוים: מי שהוא שותף בסניף השכרות וגם עובד בחדר
  // מחשבים צריך לראות את שני הפריטים. לכן כאן נלקח איחוד ההרשאות של כל הכובעים; ההכרעה
  // איזה כובע חל בפועל נעשית בכניסה למודול עצמו (`requireModuleAccess`).
  const assignments = getAssignments(session);
  const role = topRole(assignments);
  const perms = unionPerms(assignments);
  const isOwner = isOwnerSession(session);
  const name = session.user?.name ?? session.user?.email ?? "";

  const items = NAV_ITEMS.filter((item) => visibleFor(role, perms, item, isOwner));
  const navItems = items.map((item) => ({
    href: item.href,
    label: item.label,
    group: item.group,
    icon: <item.icon className="h-[18px] w-[18px]" />,
  }));

  const logoUrl = await getLogoSrc();
  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="אולטרנט" className="h-10 w-auto object-contain" />
  ) : (
    <span className="text-xl font-extrabold tracking-tight text-teal">אולטרנט</span>
  );

  // תפריט צד מימין (אפיון שדרוג v2, סעיף 2) במקום שורת הלשוניות העליונה. אותם פריטים ואותן
  // הרשאות; הצבעים והגופן של האתר לא השתנו.
  return (
    <div className="flex min-h-screen bg-page">
      <SideNav variant="desktop" items={navItems} logo={logo} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative flex flex-wrap items-center justify-between gap-3 border-b border-card-border bg-white px-6 py-3">
          <div className="flex items-center gap-3 md:hidden">
            <SideNav variant="mobile" items={navItems} />
            {logo}
          </div>
          <div className="flex-1" />
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
        <main className="min-w-0 p-6">{children}</main>
      </div>
    </div>
  );
}
