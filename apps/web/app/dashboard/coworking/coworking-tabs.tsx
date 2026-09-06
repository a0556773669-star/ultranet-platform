import Link from "next/link";
import { Building2, Armchair, Banknote, BarChart3 } from "lucide-react";

const TABS = [
  { href: "/dashboard/coworking", label: "לקוחות ותשלומים", icon: Building2 },
  { href: "/dashboard/coworking/stations", label: "עמדות", icon: Armchair },
  { href: "/dashboard/coworking/expenses", label: "הוצאות", icon: Banknote },
  { href: "/dashboard/coworking/accounting", label: 'הנה"ח', icon: BarChart3 },
];

export function CoworkingTabs({ active }: { active: string }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={t.href === active ? "pill-active" : "pill-inactive"}>
          <t.icon className="ml-1 h-4 w-4" />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
