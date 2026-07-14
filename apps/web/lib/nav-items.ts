import type { PermKey } from "@/lib/perms";

export type NavItem = { href: string; label: string; icon: string; perm?: PermKey | PermKey[] };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "בית", icon: "🏠" },
  { href: "/dashboard/computer-rooms", label: "חדרי מחשבים", icon: "🖥️", perm: ["branches", "computers", "tasks"] },
  { href: "/dashboard/rentals", label: "השכרות", icon: "💻", perm: "rentals" },
  { href: "/dashboard/coworking", label: "משרד שיתופי", icon: "🤝", perm: "coworking" },
  { href: "/dashboard/accounting", label: "הנה\"ח", icon: "📊", perm: "accounting" },
  { href: "/dashboard/tutorials", label: "הדרכות", icon: "📚" },
];

export function visibleFor(role: string, perms: Partial<Record<PermKey, boolean>> | null | undefined, item: NavItem) {
  if (!item.perm) return true;
  if (role === "owner") return true;
  const keys = Array.isArray(item.perm) ? item.perm : [item.perm];
  return keys.some((key) => Boolean(perms?.[key]));
}
