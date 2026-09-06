import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Laptop as LaptopIcon, Users, FolderOpen, AlertCircle, Package, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { PermKey } from "@/lib/perms";
import { NAV_ITEMS, visibleFor, type NavItem } from "@/lib/nav-items";
import HomeClock from "./home-clock";
import { getInventorySnapshotAction } from "./(computer-rooms)/inventory/actions";
import type { Laptop, Rental } from "@ultranet/shared-types";
import type { BranchKey, InventoryItem } from "@/lib/legacy-inventory";
import { loadMainLedger } from "@/lib/main-ledger";

export default async function DashboardHomePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const role = session.user?.role ?? "employee";
  const perms = (session.user as { perms?: Partial<Record<PermKey, boolean>> } | undefined)?.perms;
  const name = session.user?.name ?? session.user?.email ?? "";
  const branchId = session.user?.branchId;
  const isOwner = role === "owner";
  const has = (key: PermKey) => isOwner || Boolean(perms?.[key]);

  const db = getAdminFirestore();

  let moneyStats: {
    todayIncome: number;
    todayExpenses: number;
    monthIncome: number;
    monthExpenses: number;
  } | null = null;

  if (has("accounting")) {
    // Read from the same ledger the accounting screen shows, so the number on the home page and
    // the number on /dashboard/accounting can never disagree: both are the sum of the rows
    // marked countsToMain, and nothing is added back on top here.
    const ledger = await loadMainLedger();
    const today = new Date().toISOString().slice(0, 10);
    moneyStats = {
      todayIncome: ledger.income.filter((r) => r.date === today).reduce((s, r) => s + r.amount, 0),
      todayExpenses: ledger.expenses.filter((r) => r.date === today).reduce((s, r) => s + r.amount, 0),
      monthIncome: ledger.thisMonth.income,
      monthExpenses: ledger.thisMonth.expense,
    };
  }

  let rentedLaptops: { name: string; startDate: string }[] | null = null;
  let unpaidRentals: { id: string; clientName: string; itemName: string; amount: number }[] | null = null;

  if (has("rentals")) {
    // One wave instead of two: the second pair used to wait on the first for no reason, doubling
    // this section's latency. The laptop and client collections are read for names only, so they
    // fetch just that field rather than every document in full.
    const [laptopsSnap, rentalsSnap, clientsSnap2, unpaidSnap] = await Promise.all([
      db.collection("n_laptops").select("name").get(),
      db.collection("n_rentals").where("status", "==", "active").where("kind", "==", "laptop").get(),
      db.collection("n_rental_clients").select("name").get(),
      db.collection("n_rentals").where("status", "==", "returned").where("paid", "==", false).get(),
    ]);
    const laptopNames: Record<string, string> = {};
    laptopsSnap.docs.forEach((d) => {
      laptopNames[d.id] = (d.data() as Laptop).name;
    });
    rentedLaptops = rentalsSnap.docs
      .map((d) => d.data() as Rental)
      .filter((r) => isOwner || r.branchId === branchId)
      .map((r) => ({ name: laptopNames[r.itemId] || "נייד", startDate: r.startDate }));

    const clientNames: Record<string, string> = {};
    clientsSnap2.docs.forEach((d) => {
      clientNames[d.id] = (d.data() as { name: string }).name;
    });
    unpaidRentals = unpaidSnap.docs
      .map((d) => ({ ...(d.data() as Omit<Rental, "id">), id: d.id }))
      .filter((r) => isOwner || r.branchId === branchId)
      .map((r) => ({
        id: r.id,
        clientName: clientNames[r.clientId] || "לקוח",
        itemName: laptopNames[r.itemId] || "פריט",
        amount: r.finalPrice ?? r.calcPrice,
      }));
  }

  let inventoryItemCount = 0;
  let lowStockItems: { name: string; qty: number; min: number }[] | null = null;

  if (has("computers")) {
    const snapshot = await getInventorySnapshotAction();
    const branchKeys: BranchKey[] = isOwner
      ? snapshot.branches.map((b) => b.key)
      : snapshot.branches.filter((b) => String(b.key) === branchId).map((b) => b.key);
    const items: { name: string; qty: number; min: number }[] = [];
    branchKeys.forEach((key) => {
      const branchInv: Record<string, InventoryItem> = snapshot.inventory[key] ?? {};
      Object.entries(branchInv).forEach(([itemName, item]) => {
        items.push({ name: itemName, qty: item.qty, min: item.min });
      });
    });
    inventoryItemCount = items.length;
    lowStockItems = items.filter((i) => i.qty <= i.min).slice(0, 6);
  }

  const categories: (NavItem)[] = NAV_ITEMS.filter(
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

        {rentedLaptops && (
          <div className="card">
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
              <span className="flex items-center gap-1.5"><LaptopIcon className="h-4 w-4" />{"ניידים מושכרים כעת"}</span>
              <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{rentedLaptops.length}</span>
            </div>
            {rentedLaptops.length === 0 ? (
              <div className="text-sm text-muted">{"אין השכרות פעילות"}</div>
            ) : (
              rentedLaptops.map((l, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-card-border py-2 text-[13px] last:border-b-0">
                  <span className="h-2 w-2 rounded-full bg-teal" />
                  <span className="flex-1 font-medium text-ink">{l.name}</span>
                  <span className="text-[11px] text-muted">{"מאז " + l.startDate}</span>
                </div>
              ))
            )}
          </div>
        )}

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

      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><FolderOpen className="h-4 w-4" />{"הקטגוריות שלי"}</div>
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
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

      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {unpaidRentals && unpaidRentals.length > 0 && (
        <div className="card border-red-300 bg-red-50">
          <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-red-700">
            <span className="flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />{"חובות השכרות"}</span>
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-red-700 normal-case">{unpaidRentals.length}</span>
          </div>
          {unpaidRentals.map((u) => (
            <div key={u.id} className="flex items-center gap-2 border-b border-red-100 py-2 text-[13px] last:border-b-0">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="flex-1 font-medium text-ink">{u.clientName} – {u.itemName}</span>
              <span className="text-[11px] font-bold text-red-700">{u.amount} ₪</span>
            </div>
          ))}
          <Link href="/dashboard/rentals/manage" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-red-700 hover:underline">
            {"למעבר לאיחוד השכרות"}
            <ArrowLeft className="h-3 w-3" />
          </Link>
        </div>
      )}

      {lowStockItems && (
          <div className="card">
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
              <span className="flex items-center gap-1.5"><Package className="h-4 w-4" />{"מלאי - פריטים בחוסר"}</span>
              <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{inventoryItemCount}</span>
            </div>
            {lowStockItems.length === 0 ? (
              <div className="text-sm text-muted">{"אין פריטים בחוסר במלאי"}</div>
            ) : (
              lowStockItems.map((it, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-card-border py-2 text-[13px] last:border-b-0">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="flex-1 font-medium text-ink">{it.name}</span>
                  <span className="text-[11px] text-muted">
                    {it.qty}
                    {" " + "מתוך" + " "}
                    {it.min}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <div className="card">
        <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />{"משימות לטיפול"}</span>
          <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">0</span>
        </div>
        <div className="text-sm text-muted">{"ריכוז משימות ייבנה לכל אורך הפיתוח, לפי קטגוריה וצבע"}</div>
      </div>
      <div className="card">
        <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />{"התראות"}</span>
          <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">0</span>
        </div>
        <div className="text-sm text-muted">{"התראות יופיעו כאן בהמשך הפיתוח"}</div>
      </div>
    </div>
  );
}