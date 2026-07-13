"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabItem = { href: string; label: string; icon: string; ownerOnly?: boolean };

const TABS: TabItem[] = [
  { href: "/dashboard/rentals", label: "בית", icon: "🏠" },
  { href: "/dashboard/rentals/branches", label: "סניפים", icon: "🏢", ownerOnly: true },
  { href: "/dashboard/rentals/expenses", label: "הוצאות", icon: "💸", ownerOnly: true },
  { href: "/dashboard/rentals/laptops", label: "מחשבים", icon: "💻" },
  { href: "/dashboard/rentals/labels", label: "מדבקות", icon: "🏷️" },
  { href: "/dashboard/rentals/clients", label: "לקוחות", icon: "👥" },
  { href: "/dashboard/rentals/manage", label: "השכרות", icon: "📋" },
  { href: "/dashboard/rentals/accounting", label: "הנה\"ח", icon: "📊" },
];

export function RentalsTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const visibleTabs = TABS.filter((tab) => !tab.ownerOnly || isOwner);

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1">
      {visibleTabs.map((tab) => {
        const active =
          tab.href === "/dashboard/rentals"
            ? pathname === "/dashboard/rentals"
            : pathname?.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={active ? "pill-active" : "pill-inactive"}>
            <span className="ml-1">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
