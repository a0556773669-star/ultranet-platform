import {
  Home,
  Monitor,
  Laptop,
  Handshake,
  BarChart3,
  BookOpen,
  Sparkles,
  Target,
  LifeBuoy,
  Users,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import type { PermKey } from "@/lib/perms";

/**
 * `group`: "main" = אזורי העבודה בתפריט הצד; "tools" = קבוצת "כלים וניהול" בתחתית
 * (אפיון שדרוג v2, סעיף 2). `ownerOnly` = מוצג רק לבעלים — המסכים עצמם כבר נעולים
 * ב-`requireOwner`, וההסתרה כאן רק כדי לא להציע קישור שמחזיר לדף הבית.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  perm?: PermKey | PermKey[];
  group: "main" | "tools";
  ownerOnly?: boolean;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "בית", icon: Home, group: "main" },
  { href: "/dashboard/rentals", label: "השכרות", icon: Laptop, perm: "rentals", group: "main" },
  { href: "/dashboard/computer-rooms", label: "חדרי מחשבים", icon: Monitor, perm: ["branches", "computers", "tasks"], group: "main" },
  { href: "/dashboard/coworking", label: "משרד שיתופי", icon: Handshake, perm: "coworking", group: "main" },
  // "כספים" = ההנה"ח הראשית + ניידים (רווחיות והתחשבנות). אותו נתיב ואותה הרשאה כמו "הנה"ח" הקודם.
  { href: "/dashboard/accounting", label: "כספים", icon: BarChart3, perm: "accounting", group: "main" },
  { href: "/dashboard/duxus", label: "משימות", icon: Target, perm: "duxus", group: "main" },
  { href: "/dashboard/users", label: "משתמשים", icon: Users, group: "tools", ownerOnly: true },
  { href: "/dashboard/tutorials", label: "נהלים והדרכות", icon: BookOpen, group: "tools" },
  { href: "/dashboard/help", label: "עזרה ושאלות", icon: LifeBuoy, group: "tools" },
  { href: "/dashboard/shop", label: "חנות AI", icon: Sparkles, perm: "shop", group: "tools" },
  { href: "/dashboard/maintenance", label: "בדיקת נתונים", icon: Stethoscope, group: "tools", ownerOnly: true },
];

export function visibleFor(
  role: string,
  perms: Partial<Record<PermKey, boolean>> | null | undefined,
  item: NavItem,
  isOwner = role === "owner",
) {
  if (item.ownerOnly) return isOwner;
  if (!item.perm) return true;
  if (isOwner) return true;
  const keys = Array.isArray(item.perm) ? item.perm : [item.perm];
  return keys.some((key) => Boolean(perms?.[key]));
}
