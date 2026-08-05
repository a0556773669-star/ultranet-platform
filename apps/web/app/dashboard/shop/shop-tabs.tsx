"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Cpu, Backpack, type LucideIcon } from "lucide-react";

type TabItem = { href: string; label: string; icon: LucideIcon };

const TABS: TabItem[] = [
  { href: "/dashboard/shop", label: "לידים", icon: Users },
  { href: "/dashboard/shop/catalog", label: "קטלוג מחשבים", icon: Cpu },
  { href: "/dashboard/shop/addons", label: "ציוד נלווה", icon: Backpack },
];

export function ShopTabs() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1">
      {TABS.map((tab) => {
        const active = tab.href === "/dashboard/shop" ? pathname === "/dashboard/shop" : pathname?.startsWith(tab.href);
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
