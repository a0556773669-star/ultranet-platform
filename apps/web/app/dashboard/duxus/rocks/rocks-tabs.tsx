"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, CalendarRange, CalendarDays, History, type LucideIcon } from "lucide-react";

type TabItem = { href: string; label: string; icon: LucideIcon };

const TABS: TabItem[] = [
  { href: "/dashboard/duxus/rocks", label: "רבעון", icon: Flag },
  { href: "/dashboard/duxus/rocks/month", label: "חודשי", icon: CalendarRange },
  { href: "/dashboard/duxus/rocks/week", label: "שבועי", icon: CalendarDays },
  { href: "/dashboard/duxus/rocks/history", label: "היסטוריה", icon: History },
];

export function RocksTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 border-b border-card-border pb-3">
      {TABS.map((tab) => {
        const active = tab.href === "/dashboard/duxus/rocks" ? pathname === "/dashboard/duxus/rocks" : pathname?.startsWith(tab.href);
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
