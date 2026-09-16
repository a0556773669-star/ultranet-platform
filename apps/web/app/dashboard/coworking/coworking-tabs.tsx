import Link from "next/link";
import { Armchair, BarChart3 } from "lucide-react";

/**
 * שתי לשוניות. המשרד השיתופי הוא ארבע עמדות בסניף אחד, וזה כל מה שיש לנהל בו:
 * מי יושב בכל עמדה ומי שילם (סניפים ועמדות), וכמה יצא מול כמה נכנס (הנה"ח).
 */
const TABS = [
  { href: "/dashboard/coworking", label: "סניפים ועמדות", icon: Armchair },
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
