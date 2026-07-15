"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

export function TopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-wrap items-center justify-center gap-1">
      {items.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname?.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "pill-active" : "pill-inactive"}>
            <item.icon className="ml-1 h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
