"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotebookText, Mountain, type LucideIcon } from "lucide-react";

type TabItem = { href: string; label: string; icon: LucideIcon };

// סדר הטאבים = סדר העבודה: קודם המשימות (מה עושים עכשיו), ואז הנהלים (איך עושים).
const TABS: TabItem[] = [
  { href: "/dashboard/duxus/rocks", label: "סלעים, יעדים וקצב עבודה", icon: Mountain },
  { href: "/dashboard/duxus/procedures", label: "נהלים", icon: NotebookText },
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
