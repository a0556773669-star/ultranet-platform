import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingIncome, AccountingExpense } from "@ultranet/shared-types";
import {
  createIncomeAction,
  createExpenseAction,
  deleteIncomeAction,
  deleteExpenseAction,
} from "../../accounting/actions";
import { DeleteEntryButton } from "../../accounting/delete-entry-button";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export default async function RentalsAccountingPage() {
  const session = await requireModuleAccess("rentals");
  const isOwner = session.user?.role === "owner";

  const db = getAdminFirestore();
  const [incomeSnap, expenseSnap] = await Promise.all([
    db.collection("n_ah_income").get(),
    db.collection("n_ah_expenses").get(),
  ]);

  const income = incomeSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingIncome, "id">) }) as AccountingIncome)
    .filter((i) => i.business === "rentals")
    .sort((a, b) => b.date.localeCompare(a.date));
  const expenses = expenseSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingExpense, "id">) }) as AccountingExpense)
    .filter((e) => e.business === "rentals")
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthIncome = income
    .filter((i) => i.date.slice(0, 7) === currentMonth)
    .reduce((sum, i) => sum + i.amount, 0);
  const monthExpenses = expenses
    .filter((e) => e.date.slice(0, 7) === currentMonth)
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[21px] font-extrabold text-ink">📊 הנה\"ח השכרות</h1>
        <p className="text-sm text-muted">גביה ותמונת מצב של מודול ההשכרות</p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{"סה\"כ הכנסות"}</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{totalIncome.toLocaleString()} ₪</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{"סה\"כ הוצאות"}</p>
          <p className="mt-1 text-2xl font-black text-red-600">{totalExpenses.toLocaleString()} ₪</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{"רווח נקי כולל"}</p>
          <p className={`mt-1 text-2xl font-black ${totalIncome - totalExpenses >= 0 ? "text-teal-dark" : "text-red-600"}`}>
            {(totalIncome - totalExpenses).toLocaleString()} ₪
          </p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{"רווח החודש"}</p>
          <p className={`mt-1 text-2xl font-black ${monthIncome - monthExpenses >= 0 ? "text-teal-dark" : "text-red-600"}`}>
            {(monthIncome - monthExpenses).toLocaleString()} ₪
          </p>
        </div>
      </div>

      {isOwner && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <form
            action={createIncomeAction}
            className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card"
          >
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{"➕ הוספת הכנסה"}</h2>
            <input type="hidden" name="business" value="rentals" />
            <input type="date" name="date" required className={FIELD} />
            <input name="desc" placeholder="תיאור" className={FIELD} />
            <input type="number" name="amount" min={0} placeholder="סכום" required className={FIELD} />
            <button
              type="submit"
              className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              הוספה
            </button>
          </form>
          <form
            action={createExpenseAction}
            className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card"
          >
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted">{"➖ הוספת הוצאה"}</h2>
            <input type="hidden" name="business" value="rentals" />
            <input type="date" name="date" required className={FIELD} />
            <input name="desc" placeholder="תיאור" className={FIELD} />
            <input type="number" name="amount" min={0} placeholder="סכום" required className={FIELD} />
            <button
              type="submit"
              className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              הוספה
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span>{"💰 הכנסות"}</span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{income.length}</span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {income.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">{"אין הכנסות עדיין"}</p>
            )}
            {income.slice(0, 20).map((i) => {
              const bound = deleteIncomeAction.bind(null, i.id);
              return (
                <div key={i.id} className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                  <div className="flex-1">
                    <div className="font-bold text-ink">{i.desc || "הכנסה"}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{i.date}</div>
                  </div>
                  <div className="min-w-[75px] text-left font-extrabold text-emerald-600">{i.amount.toLocaleString()} ₪</div>
                  {isOwner && (
                    <form action={bound}>
                      <DeleteEntryButton confirmText="למחוק את ההכנסה?" />
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span>{"💸 הוצאות"}</span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{expenses.length}</span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {expenses.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">{"אין הוצאות עדיין"}</p>
            )}
            {expenses.slice(0, 20).map((e) => {
              const bound = deleteExpenseAction.bind(null, e.id);
              return (
                <div key={e.id} className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                  <div className="flex-1">
                    <div className="font-bold text-ink">{e.desc || "הוצאה"}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{e.date}</div>
                  </div>
                  <div className="min-w-[75px] text-left font-extrabold text-red-600">{e.amount.toLocaleString()} ₪</div>
                  {isOwner && (
                    <form action={bound}>
                      <DeleteEntryButton confirmText="למחוק את ההוצאה?" />
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
