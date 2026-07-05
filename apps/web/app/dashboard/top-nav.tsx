"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string; icon: string };

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
            <span className="ml-1">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
