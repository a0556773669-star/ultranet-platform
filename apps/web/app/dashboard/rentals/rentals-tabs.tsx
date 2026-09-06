"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Banknote, Laptop, Receipt, Tag, Users, ClipboardList, Briefcase, BarChart3, type LucideIcon } from "lucide-react";

type TabItem = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean; branchOnly?: boolean };

const TABS: TabItem[] = [
  { href: "/dashboard/rentals/manage", label: "השכרות", icon: ClipboardList },
  { href: "/dashboard/rentals/mine", label: "השכרות יוני", icon: Briefcase, ownerOnly: true },
  { href: "/dashboard/rentals/clients", label: "לקוחות", icon: Users },
  { href: "/dashboard/rentals/expenses", label: "הוצאות", icon: Banknote },
  // The branch manager's own entry screen (פרק יד׳). Hidden from the owner, who has no single
  // branch of his own and reaches every branch through the accounting module instead.
  { href: "/dashboard/rentals/my-expenses", label: "ההוצאות שלי", icon: Receipt, branchOnly: true },
  { href: "/dashboard/rentals/laptops", label: "מחשבים", icon: Laptop },
  { href: "/dashboard/rentals/labels", label: "מדבקות", icon: Tag },
  { href: "/dashboard/rentals/accounting", label: "הנה\"ח", icon: BarChart3 },
  { href: "/dashboard/rentals/branches", label: "סניפים", icon: Building2, ownerOnly: true },
];

export function RentalsTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const visibleTabs = TABS.filter((tab) => (!tab.ownerOnly || isOwner) && (!tab.branchOnly || !isOwner));

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1">
      {visibleTabs.map((tab) => {
        const active =
          tab.href === "/dashboard/rentals"
            ? pathname === "/dashboard/rentals"
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
