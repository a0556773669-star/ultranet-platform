import { Home, BarChart3, Receipt, type LucideIcon } from "lucide-react";
import type { PermKey } from "@/lib/perms";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  perm?: PermKey | PermKey[];
  /** shown only to a branch manager - the owner has no single branch of his own */
  branchOnly?: boolean;
};

/**
 * The whole system, in three entries.
 *
 * There used to be eight, and the accounting module behind one of them had fifteen tabs on top of
 * that. Most of them were different ways of entering the same shekel, which is exactly what the
 * three-layer model replaced - so they went with it. What is left is one module, because there is
 * one question: where did the money go, what do I own, and what did I earn.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "בית", icon: Home },
  { href: "/dashboard/accounting", label: "הנהלת חשבונות", icon: BarChart3, perm: "accounting" },
  { href: "/dashboard/my-expenses", label: "ההוצאות שלי", icon: Receipt, branchOnly: true },
];

export function visibleFor(role: string, perms: Partial<Record<PermKey, boolean>> | null | undefined, item: NavItem) {
  const isOwner = role === "owner";
  if (item.branchOnly && isOwner) return false;
  if (!item.perm) return true;
  if (isOwner) return true;
  const keys = Array.isArray(item.perm) ? item.perm : [item.perm];
  return keys.some((key) => Boolean(perms?.[key]));
}
