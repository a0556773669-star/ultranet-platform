"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, ClipboardList, Coins, BookText, type LucideIcon } from "lucide-react";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard/store", label: "איך זה עובד + נהלים", icon: Home },
  { href: "/dashboard/store/new", label: "התאמת מחשב ללקוח", icon: PlusCircle },
  { href: "/dashboard/store/requests", label: "הבקשות שלי", icon: ClipboardList },
];

const OWNER_TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard/store/commissions", label: "עמלות", icon: Coins },
  { href: "/dashboard/store/glossary", label: "מושגים ל-AI", icon: BookText },
];

export function StoreTabs({ isOwner = false }: { isOwner?: boolean }) {
  const pathname = usePathname();
  const tabs = isOwner ? [...TABS, ...OWNER_TABS] : TABS;
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1">
      {tabs.map((tab) => {
        const active = tab.href === "/dashboard/store" ? pathname === tab.href : pathname?.startsWith(tab.href);
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
