import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Building2, Package, CheckCircle2, Tag, Megaphone, Mail, Monitor, type LucideIcon } from "lucide-react";
import { authOptions } from "@/lib/auth";
import type { PermKey } from "@/lib/perms";

type SubItem = { href: string; label: string; icon: LucideIcon; perm?: PermKey };

const SUB_ITEMS: SubItem[] = [
  { href: "/dashboard/branches", label: "סניפים", icon: Building2, perm: "branches" },
  { href: "/dashboard/inventory", label: "מלאי", icon: Package, perm: "computers" },
  { href: "/dashboard/tasks", label: "משימות", icon: CheckCircle2, perm: "tasks" },
  { href: "/dashboard/tickets", label: "פניות", icon: Tag, perm: "computers" },
  { href: "/dashboard/news", label: "עדכונים", icon: Megaphone },
  { href: "/dashboard/orders", label: "הזמנות", icon: Mail, perm: "computers" },
];

export default async function ComputerRoomsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const role = session.user?.role ?? "employee";
  const isOwner = role === "owner";
  const perms = (session.user as { perms?: Partial<Record<PermKey, boolean>> } | undefined)?.perms;
  const has = (key?: PermKey) => !key || isOwner || Boolean(perms?.[key]);

  const hasAnyAccess = has("branches") || has("computers") || has("tasks");
  if (!hasAnyAccess) {
    redirect("/dashboard");
  }

  const visibleItems = SUB_ITEMS.filter((item) => has(item.perm));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><Monitor className="h-5 w-5" />{"חדרי מחשבים"}</h1>
        <p className="text-sm text-muted">{"סניפים, מלאי, משימות, פניות, עדכונים והזמנות"}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {visibleItems.length === 0 && (
          <div className="col-span-full rounded-card border border-card-border bg-white p-6 text-center text-sm text-muted shadow-card">
            {"אין לך הרשאה לאף תחום כרגע"}
          </div>
        )}
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 rounded-card border border-card-border bg-white p-4 text-center shadow-card transition hover:-translate-y-0.5 hover:border-teal hover:shadow-primary"
          >
            <item.icon className="h-6 w-6 text-teal-dark" />
            <span className="text-[13px] font-bold text-ink">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
