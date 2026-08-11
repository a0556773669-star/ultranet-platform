"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotebookText, Mountain, type LucideIcon } from "lucide-react";

type TabItem = { href: string; label: string; icon: LucideIcon };

const TABS: TabItem[] = [
  { href: "/dashboard/duxus", label: "נהלים", icon: NotebookText },
  { href: "/dashboard/duxus/rocks", label: "סלעים ואבני דרך", icon: Mountain },
];

export function DuxusTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1">
      {TABS.map((tab) => {
        const active =
          tab.href === "/dashboard/duxus"
            ? pathname === "/dashboard/duxus" ||
              (!!pathname?.startsWith("/dashboard/duxus/") && !pathname.startsWith("/dashboard/duxus/rocks"))
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
