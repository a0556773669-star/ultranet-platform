"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, ListChecks, Settings2, type LucideIcon } from "lucide-react";

type OpsTab = { href: string; label: string; icon: LucideIcon; show: (p: OpsTabsProps) => boolean };

const TABS: OpsTab[] = [
  { href: "/dashboard/operations/stock", label: "עדכון מלאי", icon: ClipboardCheck, show: (p) => p.canStock },
  { href: "/dashboard/operations/tasks", label: "משימות", icon: ListChecks, show: (p) => p.canTasks },
  { href: "/dashboard/operations/settings", label: "הגדרות תפעול", icon: Settings2, show: (p) => p.isOwner },
];

type OpsTabsProps = {
  isOwner: boolean;
  /** הרשאת "מלאי" (`computers`). */
  canStock: boolean;
  /** הרשאת "משימות" — או `tasks`, או `computers` שתמיד כלל אותה. */
  canTasks: boolean;
};

export function OperationsTabs(props: OpsTabsProps) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {TABS.filter((tab) => tab.show(props)).map((tab) => {
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
