"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Banknote, Laptop, Tag, Users, ClipboardList, Briefcase, BarChart3, type LucideIcon } from "lucide-react";

type TabItem = { href: string; label: string; icon: LucideIcon; ownerOnly?: boolean };

const TABS: TabItem[] = [
  { href: "/dashboard/rentals/manage", label: "השכרות", icon: ClipboardList },
  { href: "/dashboard/rentals/mine", label: "השכרות יוני", icon: Briefcase, ownerOnly: true },
  { href: "/dashboard/rentals/clients", label: "לקוחות", icon: Users },
  // One expenses screen, not two. The owner gets the branch list plus the shared ledger; a branch
  // manager is redirected straight into his own branch's book. The second screen that used to sit
  // here ("ההוצאות שלי") wrote to n_tx, which no accounting screen reads — see SPEC פרק יד׳.
  { href: "/dashboard/rentals/expenses", label: "הוצאות", icon: Banknote },
  { href: "/dashboard/rentals/laptops", label: "מחשבים", icon: Laptop },
  { href: "/dashboard/rentals/labels", label: "מדבקות", icon: Tag },
  { href: "/dashboard/rentals/accounting", label: "הנה\"ח", icon: BarChart3 },
  { href: "/dashboard/rentals/branches", label: "סניפים", icon: Building2, ownerOnly: true },
];

export function RentalsTabs({ isOwner }: { isOwner: boolean }) {
  const pathname = usePathname();
  const visibleTabs = TABS.filter((tab) => !tab.ownerOnly || isOwner);

  // הלשונית הפעילה היא ההתאמה הארוכה ביותר, כדי שמסך-בן לא ידליק שתי לשוניות בבת אחת.
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
