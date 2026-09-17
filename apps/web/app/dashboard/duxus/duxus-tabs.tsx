"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotebookText, Target, History, Settings, type LucideIcon } from "lucide-react";

type TabItem = { href: string; label: string; icon: LucideIcon };

// ארבע הלשוניות של האזור לפי סעיף 7 באפיון, בסדר העבודה: קודם מה עושים, אחר כך
// איך עושים, אחר כך מה היה, ובסוף ההגדרות.
const TABS: TabItem[] = [
  { href: "/dashboard/duxus/rocks", label: "משימות ויעדים", icon: Target },
  { href: "/dashboard/duxus/procedures", label: "נהלים", icon: NotebookText },
  { href: "/dashboard/duxus/history", label: "היסטוריה", icon: History },
  { href: "/dashboard/duxus/settings", label: "הגדרות", icon: Settings },
];

export function DuxusTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1">
      {TABS.map((tab) => {
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
