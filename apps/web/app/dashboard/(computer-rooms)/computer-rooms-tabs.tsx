"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ClipboardList, Banknote, BarChart3, type LucideIcon } from "lucide-react";
import type { PermKey } from "@/lib/perms";

/**
 * `managerOnly` הוא הגבול בין לתפעל לבין לראות את הכסף: עובד חדר מחשבים נכנס לתפעול
 * (מלאי ומשימות) בלבד, וסניפים / הוצאות / הנה"ח נשארים לבעלים ולשותף שמנהל את הסניף.
 * אותו גבול נאכף בצד השרת דרך `requireModuleAccess(..., { managerOnly: true })` — הסתרת
 * הטאב כאן היא רק כדי לא להציע קישור שיחזיר את המשתמש לדשבורד.
 */
type TabItem = { href: string; label: string; icon: LucideIcon; perm?: PermKey | PermKey[]; managerOnly?: boolean };

const TABS: TabItem[] = [
  { href: "/dashboard/branches", label: "סניפים", icon: Building2, perm: "branches", managerOnly: true },
  { href: "/dashboard/operations", label: "תפעול", icon: ClipboardList, perm: ["computers", "tasks"] },
  { href: "/dashboard/expenses", label: "הוצאות", icon: Banknote, perm: "computers", managerOnly: true },
  {
    href: "/dashboard/computer-rooms-accounting",
    label: "הנה\"ח",
    icon: BarChart3,
    perm: "computers",
    managerOnly: true,
  },
];

export function ComputerRoomsTabs({
  isOwner,
  isManager,
  perms,
}: {
  isOwner: boolean;
  isManager: boolean;
  perms: Partial<Record<PermKey, boolean>> | undefined;
}) {
  const pathname = usePathname();
  const has = (tab: TabItem) => {
    if (tab.managerOnly && !isManager) return false;
    if (!tab.perm) return true;
    if (isOwner) return true;
    const keys = Array.isArray(tab.perm) ? tab.perm : [tab.perm];
    return keys.some((key) => Boolean(perms?.[key]));
  };
  const visibleTabs = TABS.filter(has);

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1">
      {visibleTabs.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={active ? "pill-active" : "pill-inactive"}>
            <tab.icon className="ml-1 h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
