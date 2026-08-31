import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Users, FolderOpen } from "lucide-react";
import { authOptions } from "@/lib/auth";
import type { PermKey } from "@/lib/perms";
import { NAV_ITEMS, visibleFor, type NavItem } from "@/lib/nav-items";
import HomeClock from "./home-clock";
import { loadTransactionModel } from "@/lib/tx-data";
import { flowSnapshot } from "@/lib/business-ledger";

/**
 * The home page used to open four collections' worth of widgets - rented laptops, unpaid rentals,
 * low stock - one per module. Those modules are gone, and with them the reason to read their
 * collections here. What is left is the one number the owner actually opens this page for: money
 * in and out, derived from the same transaction model every accounting screen reads, so the home
 * page can never disagree with the screen it links to.
 */
export default async function DashboardHomePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const role = session.user?.role ?? "employee";
  const perms = (session.user as { perms?: Partial<Record<PermKey, boolean>> } | undefined)?.perms;
  const name = session.user?.name ?? session.user?.email ?? "";
  const isOwner = role === "owner";
  const has = (key: PermKey) => isOwner || Boolean(perms?.[key]);

  let moneyStats: {
    todayIncome: number;
    todayExpenses: number;
    monthIncome: number;
    monthExpenses: number;
  } | null = null;

  if (has("accounting")) {
    const model = await loadTransactionModel();
    moneyStats = flowSnapshot(model.transactions, new Date().toISOString().slice(0, 10));
  }

  const categories: NavItem[] = NAV_ITEMS.filter(
    (item) => item.href !== "/dashboard" && visibleFor(role, perms, item),
  );
  if (isOwner) {
    categories.push({ href: "/dashboard/users", label: "משתמשים והרשאות", icon: Users });
  }

  return (
    <div>
      <div className="mb-4">
        <HomeClock name={name} />
      </div>

      {moneyStats && (
        <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
            <span className="absolute right-0 top-0 h-full w-1 bg-emerald-500" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{"הכנסות עד היום"}</div>
            <div className="mt-1 text-[25px] font-black text-emerald-600">{moneyStats.todayIncome.toLocaleString()} ₪</div>
          </div>
          <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
            <span className="absolute right-0 top-0 h-full w-1 bg-red-500" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{"הוצאות עד היום"}</div>
            <div className="mt-1 text-[25px] font-black text-red-600">{moneyStats.todayExpenses.toLocaleString()} ₪</div>
          </div>
          <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
            <span className="absolute right-0 top-0 h-full w-1 bg-teal" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{"הכנסות החודש"}</div>
            <div className="mt-1 text-[25px] font-black text-teal-dark">{moneyStats.monthIncome.toLocaleString()} ₪</div>
          </div>
          <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
            <span className="absolute right-0 top-0 h-full w-1 bg-amber-500" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{"הוצאות החודש"}</div>
            <div className="mt-1 text-[25px] font-black text-amber-600">{moneyStats.monthExpenses.toLocaleString()} ₪</div>
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
        <FolderOpen className="h-4 w-4" />
        {"הקטגוריות שלי"}
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {categories.length === 0 && (
          <div className="col-span-full rounded-card border border-card-border bg-white p-6 text-center text-sm text-muted shadow-card">
            {"אין קטגוריות זמינות עבורך"}
          </div>
        )}
        {categories.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex flex-col items-center gap-1 rounded-card border border-card-border bg-white p-4 text-center shadow-card transition hover:-translate-y-0.5 hover:border-teal hover:shadow-primary"
          >
            <c.icon className="h-6 w-6 text-teal-dark" />
            <span className="text-[13px] font-bold text-ink">{c.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
