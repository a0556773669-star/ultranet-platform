"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Package, CheckCircle2, Tag, Megaphone, Mail, Banknote, BarChart3, type LucideIcon } from "lucide-react";
import type { PermKey } from "@/lib/perms";

type TabItem = { href: string; label: string; icon: LucideIcon; perm?: PermKey };

const TABS: TabItem[] = [
  { href: "/dashboard/branches", label: "סניפים", icon: Building2, perm: "branches" },
  { href: "/dashboard/inventory", label: "מלאי", icon: Package, perm: "computers" },
  { href: "/dashboard/tasks", label: "משימות", icon: CheckCircle2, perm: "tasks" },
  { href: "/dashboard/tickets", label: "פניות", icon: Tag, perm: "computers" },
  { href: "/dashboard/news", label: "עדכונים", icon: Megaphone },
  { href: "/dashboard/orders", label: "הזמנות", icon: Mail, perm: "computers" },
  { href: "/dashboard/expenses", label: "הוצאות", icon: Banknote, perm: "computers" },
  { href: "/dashboard/computer-rooms-accounting", label: "הנה\"ח", icon: BarChart3, perm: "computers" },
];

export function ComputerRoomsTabs({
  isOwner,
  perms,
}: {
  isOwner: boolean;
  perms: Partial<Record<PermKey, boolean>> | undefined;
}) {
  const pathname = usePathname();
  const has = (key?: PermKey) => !key || isOwner || Boolean(perms?.[key]);
  const visibleTabs = TABS.filter((tab) => has(tab.perm));

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
