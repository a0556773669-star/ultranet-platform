import { Home, Monitor, Laptop, Handshake, BarChart3, BookOpen, Sparkles, Target, type LucideIcon } from "lucide-react";
import type { PermKey } from "@/lib/perms";

export type NavItem = { href: string; label: string; icon: LucideIcon; perm?: PermKey | PermKey[] };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "בית", icon: Home },
  { href: "/dashboard/computer-rooms", label: "חדרי מחשבים", icon: Monitor, perm: ["branches", "computers", "tasks"] },
  { href: "/dashboard/rentals", label: "השכרות", icon: Laptop, perm: "rentals" },
  { href: "/dashboard/coworking", label: "משרד שיתופי", icon: Handshake, perm: "coworking" },
  { href: "/dashboard/accounting", label: "הנה\"ח", icon: BarChart3, perm: "accounting" },
  { href: "/dashboard/duxus", label: "דוכס", icon: Target, perm: "duxus" },
  { href: "/dashboard/shop", label: "חנות AI", icon: Sparkles, perm: "shop" },
  { href: "/dashboard/tutorials", label: "הדרכות", icon: BookOpen },
];

export function visibleFor(role: string, perms: Partial<Record<PermKey, boolean>> | null | undefined, item: NavItem) {
  if (!item.perm) return true;
  if (role === "owner") return true;
  const keys = Array.isArray(item.perm) ? item.perm : [item.perm];
  return keys.some((key) => Boolean(perms?.[key]));
}
