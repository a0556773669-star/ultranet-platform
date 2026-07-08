import type { PermKey } from "@/lib/perms";

export type NavItem = { href: string; label: string; icon: string; perm?: PermKey };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "בית", icon: "🏠" },
  { href: "/dashboard/branches", label: "סניפים", icon: "🏢", perm: "branches" },
  { href: "/dashboard/inventory", label: "מלאי", icon: "📦", perm: "computers" },
  { href: "/dashboard/tasks", label: "משימות", icon: "✅", perm: "tasks" },
  { href: "/dashboard/tickets", label: "פניות", icon: "🔧", perm: "computers" },
  { href: "/dashboard/news", label: "עדכונים", icon: "📢" },
  { href: "/dashboard/orders", label: "הזמנות", icon: "🛍️", perm: "computers" },
  { href: "/dashboard/rentals", label: "השכרות", icon: "💻", perm: "rentals" },
  { href: "/dashboard/coworking", label: "משרד שיתופי", icon: "🪩", perm: "coworking" },
  { href: "/dashboard/accounting", label: "הנה\"ח", icon: "📊", perm: "accounting" },
];

export function visibleFor(role: string, perms: Partial<Record<PermKey, boolean>> | null | undefined, item: NavItem) {
  if (!item.perm) return true;
  if (role === "owner") return true;
  return Boolean(perms?.[item.perm]);
}
