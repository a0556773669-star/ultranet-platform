"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Banknote, Laptop, Receipt, Tag, Users, ClipboardList, Briefcase, BarChart3, Eraser, type LucideIcon } from "lucide-react";

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
  // זמני: מסך ניקוי ההוצאות (app/dashboard/rentals/expenses/cleanup). למחוק את השורה הזו
  // יחד עם המסך כשהניקוי יסתיים.
  { href: "/dashboard/rentals/expenses/cleanup", label: "ניקוי הוצאות", icon: Eraser, ownerOnly: true },
];

export function RentalsTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const visibleTabs = TABS.filter((tab) => (!tab.ownerOnly || isOwner) && (!tab.branchOnly || !isOwner));

  // הלשונית הפעילה היא ההתאמה הארוכה ביותר, כדי ש-/expenses/cleanup לא ידליק גם את /expenses.
  const activeHref = visibleTabs
    .filter((tab) => pathname === tab.href || pathname?.startsWith(`${tab.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1">
      {visibleTabs.map((tab) => {
        const active = tab.href === activeHref;
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
