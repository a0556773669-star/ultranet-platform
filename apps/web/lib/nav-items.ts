import { Home, BarChart3, ArrowLeftRight, Wallet, type LucideIcon } from "lucide-react";
import type { PermKey } from "@/lib/perms";

export type NavItem = { href: string; label: string; icon: LucideIcon; perm?: PermKey | PermKey[] };

/**
 * ארבעה מסכים, לא מיליון.
 *
 * The site used to carry a module per business line, each with its own tabs, and the accounting
 * that was supposed to tie them together was one entry among many. What is left is the money
 * model itself plus the two screens that feed it: what each branch owes, and what a branch
 * manager paid. Everything else was removed rather than hidden, so there is nothing to get lost in.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "בית", icon: Home },
  { href: "/dashboard/accounting", label: "הנה\"ח", icon: BarChart3, perm: "accounting" },
  { href: "/dashboard/settlement", label: "העברות ודוחות", icon: ArrowLeftRight, perm: "rentals" },
  { href: "/dashboard/my-expenses", label: "ההוצאות שלי", icon: Wallet, perm: "rentals" },
];

export function visibleFor(role: string, perms: Partial<Record<PermKey, boolean>> | null | undefined, item: NavItem) {
  if (!item.perm) return true;
  if (role === "owner") return true;
  const keys = Array.isArray(item.perm) ? item.perm : [item.perm];
  return keys.some((key) => Boolean(perms?.[key]));
}
