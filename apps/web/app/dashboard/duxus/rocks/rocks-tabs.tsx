"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutList, History, type LucideIcon } from "lucide-react";

type TabItem = { href: string; label: string; icon: LucideIcon };

// אין יותר טאבים נפרדים לרבעון/חודשי/שבועי - הכל יושב בלוח אחד, קומה מעל קומה.
const TABS: TabItem[] = [
  { href: "/dashboard/duxus/rocks", label: "לוח העבודה", icon: LayoutList },
  { href: "/dashboard/duxus/rocks/history", label: "היסטוריה", icon: History },
];

export function RocksTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 border-b border-card-border pb-3">
      {TABS.map((tab) => {
        // אשף "פתיחת רבעון חדש" הוא חלק מלוח העבודה, ולכן משאיר אותו מסומן.
        const active =
          tab.href === "/dashboard/duxus/rocks"
            ? pathname === "/dashboard/duxus/rocks" || pathname === "/dashboard/duxus/rocks/rollover"
            : pathname?.startsWith(tab.href);
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
