"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarDays, Mountain, Archive, type LucideIcon } from "lucide-react";

type TabItem = { href: string; label: string; icon: LucideIcon };

// תתי-הלשוניות של "משימות ויעדים" (סעיף 7): מהקרוב לרחוק - קודם מה עושים השבוע.
const TABS: TabItem[] = [
  { href: "/dashboard/duxus/rocks/week", label: "השבוע", icon: CalendarCheck },
  { href: "/dashboard/duxus/rocks/month", label: "החודש", icon: CalendarDays },
  { href: "/dashboard/duxus/rocks/quarter", label: "הרבעון", icon: Mountain },
  { href: "/dashboard/duxus/rocks/archive", label: "ארכיון", icon: Archive },
];

/** `quarterKey` נשמר במעבר בין הלשוניות, כדי שדפדוף לרבעון קודם לא יתאפס בכל קליק. */
export function TasksTabs({ quarterKey }: { quarterKey: string }) {
  const pathname = usePathname();
  const suffix = quarterKey ? `?q=${encodeURIComponent(quarterKey)}` : "";

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 border-b border-card-border pb-3">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link key={tab.href} href={`${tab.href}${suffix}`} className={active ? "pill-active" : "pill-inactive"}>
            <tab.icon className="ml-1 h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
