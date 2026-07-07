import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingIncome, AccountingExpense, CollectionRoute } from "@ultranet/shared-types";
import { createIncomeAction, createExpenseAction, manualChargeAction } from "./actions";

const BUSINESS_LABELS: Record<string, string> = {
  computers: "מחשבים",
  rentals: "השכרות",
  coworking: "קוורקינג",
  general: "כללי",
  other: "אחר",
};

const FIELD = "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export default async function AccountingPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "owner") {
    redirect("/dashboard");
  }

  const db = getAdminFirestore();
  const [incomeSnap, expenseSnap, routesSnap] = await Promise.all([
    db.collection("n_ah_income").get(),
    db.collection("n_ah_expenses").get(),
    db.collection("n_collection_routes").get(),
  ]);
  const income = incomeSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingIncome, "id">) }) as AccountingIncome)
    .sort((a, b) => b.date.localeCompare(a.date));
  const expenses = expenseSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingExpense, "id">) }) as AccountingExpense)
    .sort((a, b) => b.date.localeCompare(a.date));

  const routes = routesSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<CollectionRoute, "id">) }) as CollectionRoute,
  );

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-extrabold text-ink">📊 הנהלת חשבונות</h1>
          <p className="mt-1 text-[13px] text-muted">הכנסות והוצאות אישיות</p>
        </div>
        <Link
          href="/dashboard/accounting/routes"
          className="rounded-lg border border-card-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-teal hover:text-teal"
        >
          מסלולי גביה
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
          <span className="absolute right-0 top-0 h-full w-1 bg-emerald-500" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">סה&quot;כ הכנסות</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{totalIncome.toLocaleString()} ₪</p>
        </div>
        <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
          <span className="absolute right-0 top-0 h-full w-1 bg-red-500" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">סה&quot;כ הוצאות</p>
          <p className="mt-1 text-2xl font-black text-red-600">{totalExpenses.toLocaleString()} ₪</p>
        </div>
        <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
          <span className="absolute right-0 top-0 h-full w-1 bg-teal" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">מאזן</p>
          <p className={`mt-1 text-2xl font-black ${totalIncome - totalExpenses >= 0 ? "text-teal-dark" : "text-red-600"}`}>
            {(totalIncome - totalExpenses).toLocaleString()} ₪
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <form action={createIncomeAction} className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">📥 הוספת הכנסה</h2>
          <input type="date" name="date" required className={FIELD} />
          <input name="desc" placeholder="תיאור" className={FIELD} />
          <input type="number" name="amount" min={0} placeholder="סכום" required className={FIELD} />
          <select name="business" className={FIELD}>
            <option value="general">כללי</option>
            <option value="computers">מחשבים</option>
            <option value="rentals">השכרות</option>
            <option value="coworking">קוורקינג</option>
            <option value="other">אחר</option>
          </select>
          <select name="type" className={FIELD}>
            <option value="fixed">קבוע</option>
            <option value="variable">משתנה</option>
            <option value="cash">מזומן</option>
          </select>
          <button type="submit" className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90">
            הוספה
          </button>
        </form>

        <form action={createExpenseAction} className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">📤 הוספת הוצאה</h2>
          <input type="date" name="date" required className={FIELD} />
          <input name="desc" placeholder="תיאור" className={FIELD} />
          <input type="number" name="amount" min={0} placeholder="סכום" required className={FIELD} />
          <select name="business" className={FIELD}>
            <option value="general">כללי</option>
            <option value="computers">מחשבים</option>
            <option value="rentals">השכרות</option>
            <option value="coworking">קוורקינג</option>
          </select>
          <button type="submit" className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90">
            הוספה
          </button>
        </form>

        <form action={manualChargeAction} className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted">💳 גביה ידנית ממסלול</h2>
          <select name="routeId" required className={FIELD}>
            <option value="">בחר מסלול גביה</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <input type="date" name="date" required className={FIELD} />
          <input name="desc" placeholder="תיאור" className={FIELD} />
          <input type="number" name="amount" min={0} placeholder="סכום לחיוב" required className={FIELD} />
          <select name="business" className={FIELD}>
            <option value="general">כללי</option>
            <option value="computers">מחשבים</option>
            <option value="rentals">השכרות</option>
            <option value="coworking">קוורקינג</option>
          </select>
          <button type="submit" className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90">
            חייב עכשיו
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span>📥 הכנסות אחרונות</span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{income.length}</span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {income.slice(0, 15).map((i) => (
              <div key={i.id} className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                <div className="flex-1">
                  <div className="font-bold text-ink">{i.desc || BUSINESS_LABELS[i.business]}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{i.date}</div>
                </div>
                <div className="min-w-[75px] text-left font-extrabold text-emerald-600">{i.amount.toLocaleString()} ₪</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span>📤 הוצאות אחרונות</span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{expenses.length}</span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {expenses.slice(0, 15).map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                <div className="flex-1">
                  <div className="font-bold text-ink">{e.desc || BUSINESS_LABELS[e.business]}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{e.date}</div>
                </div>
                <div className="min-w-[75px] text-left font-extrabold text-red-600">{e.amount.toLocaleString()} ₪</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
