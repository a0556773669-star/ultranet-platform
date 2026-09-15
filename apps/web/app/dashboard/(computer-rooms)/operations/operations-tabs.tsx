"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, ListChecks, Settings2, type LucideIcon } from "lucide-react";

type OpsTab = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean };

const TABS: OpsTab[] = [
  { href: "/dashboard/operations/stock", label: "עדכון מלאי", icon: ClipboardCheck },
  { href: "/dashboard/operations/tasks", label: "משימות", icon: ListChecks },
  { href: "/dashboard/operations/settings", label: "הגדרות תפעול", icon: Settings2, ownerOnly: true },
];

export function OperationsTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {TABS.filter((t) => !t.ownerOnly || isOwner).map((tab) => {
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
