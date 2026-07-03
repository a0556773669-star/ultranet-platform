import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingIncome, AccountingExpense } from "@ultranet/shared-types";
import { createIncomeAction, createExpenseAction } from "./actions";

const BUSINESS_LABELS: Record<string, string> = {
  computers: "מחשבים",
  rentals: "השכרות",
  coworking: "קוורקינג",
  general: "כללי",
  other: "אחר",
};

export default async function AccountingPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "owner") {
    redirect("/dashboard");
  }

  const db = getAdminFirestore();
  const [incomeSnap, expenseSnap] = await Promise.all([
    db.collection("n_ah_income").get(),
    db.collection("n_ah_expenses").get(),
  ]);
  const income = incomeSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingIncome, "id">) }) as AccountingIncome)
    .sort((a, b) => b.date.localeCompare(a.date));
  const expenses = expenseSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AccountingExpense, "id">) }) as AccountingExpense)
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">הנהלת חשבונות</h1>
        <Link
          href="/dashboard/accounting/routes"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          מסלולי גביה
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">סה"כ הכנסות</p>
          <p className="text-2xl font-bold text-teal-dark">{totalIncome.toLocaleString()} ₪</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">סה"כ הוצאות</p>
          <p className="text-2xl font-bold text-gray-800">{totalExpenses.toLocaleString()} ₪</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">מאזן</p>
          <p className={`text-2xl font-bold ${totalIncome - totalExpenses >= 0 ? "text-teal-dark" : "text-red-600"}`}>
            {(totalIncome - totalExpenses).toLocaleString()} ₪
          </p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form action={createIncomeAction} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-700">הוספת הכנסה</h2>
          <input type="date" name="date" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal focus:outline-none" />
          <input name="desc" placeholder="תיאור" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal focus:outline-none" />
          <input type="number" name="amount" min={0} placeholder="סכום" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal focus:outline-none" />
          <select name="business" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal focus:outline-none">
            <option value="general">כללי</option>
            <option value="computers">מחשבים</option>
            <option value="rentals">השכרות</option>
            <option value="coworking">קוורקינג</option>
            <option value="other">אחר</option>
          </select>
          <select name="type" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal focus:outline-none">
            <option value="fixed">קבוע</option>
            <option value="variable">משתנה</option>
            <option value="cash">מזומן</option>
          </select>
          <button type="submit" className="self-start rounded-lg bg-teal px-5 py-2 text-sm font-medium text-white transition hover:bg-teal-dark">
            הוספה
          </button>
        </form>

        <form action={createExpenseAction} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="font-semibold text-gray-700">הוספת הוצאה</h2>
          <input type="date" name="date" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal focus:outline-none" />
          <input name="desc" placeholder="תיאור" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal focus:outline-none" />
          <input type="number" name="amount" min={0} placeholder="סכום" required className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal focus:outline-none" />
          <select name="business" className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-teal focus:outline-none">
            <option value="general">כללי</option>
            <option value="computers">מחשבים</option>
            <option value="rentals">השכרות</option>
            <option value="coworking">קוורקינג</option>
          </select>
          <button type="submit" className="self-start rounded-lg bg-gray-700 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-800">
            הוספה
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-700">הכנסות אחרונות</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-right text-sm">
              <tbody className="divide-y divide-gray-100">
                {income.slice(0, 15).map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-2 text-gray-600">{i.date}</td>
                    <td className="px-4 py-2 text-gray-600">{i.desc || BUSINESS_LABELS[i.business]}</td>
                    <td className="px-4 py-2 font-medium text-teal-dark">{i.amount.toLocaleString()} ₪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold text-gray-700">הוצאות אחרונות</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-right text-sm">
              <tbody className="divide-y divide-gray-100">
                {expenses.slice(0, 15).map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 text-gray-600">{e.date}</td>
                    <td className="px-4 py-2 text-gray-600">{e.desc || BUSINESS_LABELS[e.business]}</td>
                    <td className="px-4 py-2 font-medium text-gray-800">{e.amount.toLocaleString()} ₪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
