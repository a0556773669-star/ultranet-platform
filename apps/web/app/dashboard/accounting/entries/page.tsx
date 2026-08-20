import Link from "next/link";
import { BarChart3, Download, Upload, Laptop, CreditCard, Banknote } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingIncome, AccountingExpense, CollectionRoute, Branch } from "@ultranet/shared-types";
import { createIncomeAction, createExpenseAction, deleteIncomeAction, deleteExpenseAction } from "../actions";
import CollectModal from "../collect-modal";
import { DeleteEntryButton } from "../delete-entry-button";
import { EditExpenseModal } from "../edit-expense-modal";
import { loadOwnerFixedExpenseBurden } from "@/lib/owner-expense-burden";
import { loadComputerRoomSetupCostTotal } from "@/lib/computer-room-accounting";
import { ACCOUNTING_EXPENSE_CATEGORIES } from "@/lib/accounting-categories";
import { AccountingTabs } from "../accounting-tabs";

const BUSINESS_LABELS: Record<string, string> = {
  computers: "מחשבים",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
  general: "כללי",
  other: "אחר",
};

const INCOME_TYPE_LABELS: Record<string, string> = {
  laptops: "ניידים",
  credit: "אשראי מהעסק",
  cash: "מזומן",
  fixed: "קבוע",
  variable: "משתנה",
};

const FIELD = "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

function branchNameOf(branches: Branch[], branchId?: string) {
  if (!branchId) return undefined;
  return branches.find((b) => b.id === branchId)?.name;
}

export default async function AccountingPage() {
  await requireModuleAccess("accounting");

  const db = getAdminFirestore();
  const [incomeSnap, expenseSnap, routesSnap, branchesSnap] = await Promise.all([
    db.collection("n_ah_income").get(),
    db.collection("n_ah_expenses").get(),
    db.collection("n_collection_routes").get(),
    db.collection("n_branches").get(),
  ]);
  const income = incomeSnap.docs
    .map((d) => ({ ...(d.data() as Omit<AccountingIncome, "id">), id: d.id }) as AccountingIncome)
    .sort((a, b) => b.date.localeCompare(a.date));
  const expenses = expenseSnap.docs
    .map((d) => ({ ...(d.data() as Omit<AccountingExpense, "id">), id: d.id }) as AccountingExpense)
    .sort((a, b) => b.date.localeCompare(a.date));

  const routes = routesSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<CollectionRoute, "id">), id: d.id }) as CollectionRoute,
  );

  // Kept unfiltered (including deleted) so past entries tied to a since-deleted branch still
  // resolve a name via branchNameOf() instead of showing blank - only the pickers below (for
  // filing NEW entries) exclude deleted branches.
  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const laptopBranches = branches
    .filter((b) => b.branchType === "rentals" && !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  const cashRegisterBranches = branches
    .filter((b) => b.branchType === "computers" && !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  const creditDefaultDate = `${new Date().toISOString().slice(0, 7)}-10`;

  const fixedExpenseBurden = await loadOwnerFixedExpenseBurden();
  const computerRoomSetupCostTotal = await loadComputerRoomSetupCostTotal();

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses =
    expenses.reduce((sum, e) => sum + e.amount, 0) + fixedExpenseBurden.toDate + computerRoomSetupCostTotal;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><BarChart3 className="h-5 w-5" />הנהלת חשבונות</h1>
          <p className="mt-1 text-[13px] text-muted">
            הכנסות והוצאות אישיות — אלו השורות שמרכיבות את ספר &quot;שלי&quot; בדף{" "}
            <Link href="/dashboard/accounting/overview" className="font-bold text-teal hover:underline">
              הסקירה
            </Link>
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/entries" />
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
          <p className="mt-1 text-[11px] text-muted">
            כולל ₪{Math.round(fixedExpenseBurden.toDate).toLocaleString()} חלק הבעלים בהוצאות
            קבועות (ניידים + חדרי מחשבים), וכולל ₪{Math.round(computerRoomSetupCostTotal).toLocaleString()}
            {" "}עלות הקמת סניפי חדרי מחשבים
          </p>
        </div>
        <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
          <span className="absolute right-0 top-0 h-full w-1 bg-teal" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">מאזן</p>
          <p className={`mt-1 text-2xl font-black ${totalIncome - totalExpenses >= 0 ? "text-teal-dark" : "text-red-600"}`}>
            {(totalIncome - totalExpenses).toLocaleString()} ₪
          </p>
        </div>
      </div>

      <p className="mb-2 text-xs text-muted">
        אלו 3 סוגי ההכנסה היחידים שמתחשבנים בהנה&quot;ח הראשית ובדף הבית. הכנסות ניידים/חדרי מחשבים
        הפנימיות (מעקב השקעה מול רווח) מנוהלות במודולים שלהן ואינן משפיעות על המספרים כאן.
      </p>
      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <form action={createIncomeAction} className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><Laptop className="h-4 w-4" />הכנסה — ניידים</h2>
          <input type="hidden" name="type" value="laptops" />
          <input type="date" name="date" required className={FIELD} />
          <select name="branchId" required defaultValue="" className={FIELD}>
            <option value="" disabled>בחר סניף ניידים</option>
            {laptopBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <input type="number" name="amount" min={0} placeholder="סכום" required className={FIELD} />
          <button type="submit" className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90">
            הוספה
          </button>
        </form>

        <form action={createIncomeAction} className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><CreditCard className="h-4 w-4" />הכנסה — אשראי מהעסק</h2>
          <input type="hidden" name="type" value="credit" />
          <input type="date" name="date" required defaultValue={creditDefaultDate} className={FIELD} />
          <input type="number" name="amount" min={0} placeholder="סכום" required className={FIELD} />
          <p className="text-[11px] text-muted">בדרך כלל מסומן ב-10 לחודש</p>
          <button type="submit" className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90">
            הוספה
          </button>
        </form>

        <form action={createIncomeAction} className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><Banknote className="h-4 w-4" />הכנסה — מזומן</h2>
          <input type="hidden" name="type" value="cash" />
          <input type="date" name="date" required className={FIELD} />
          <select name="branchId" required defaultValue="" className={FIELD}>
            <option value="" disabled>בחר קופה (סניף חדר מחשבים)</option>
            {cashRegisterBranches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <input type="number" name="amount" min={0} placeholder="סכום" required className={FIELD} />
          <button type="submit" className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90">
            הוספה
          </button>
        </form>
      </div>

      <p className="mb-2 text-xs text-muted">
        הוצאות מהוצאות/הנה&quot;ח ניידים וחדרי מחשבים (`/dashboard/rentals/expenses`,
        `/dashboard/expenses`) מתחשבנות כאן אוטומטית - אבל רק אם שילמתי אותן בפועל (&quot;מי
        שילם בפועל&quot; = אני), ואז רק את החלק שבאמת נשאר עליי (לפי &quot;על מי החוב&quot;): הוצאה
        שכל החוב עליה על השותף לא נספרת בכלל, הוצאה משותפת נספרת לפי חצי, והוצאה שכולה עליי
        נספרת במלואה. הוצאה שהשותף שילם בפועל לא נספרת כאן כלל, גם אם חלק/כל החוב עליי - היא
        מתקזזת מול ההעברה החודשית שלו אליי במקום (ולא נגבית בפועל בנפרד). עלות הקמת סניפי חדרי
        מחשבים (&quot;עלות הקמה&quot; בטופס הסניף) נספרת כאן במלואה כהוצאת בעלים, כי אני זה שמממן
        אותה.
      </p>
      <div className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <form action={createExpenseAction} className="flex flex-col gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card">
          <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><Upload className="h-4 w-4" />הוספת הוצאה</h2>
          <input type="date" name="date" required className={FIELD} />
          <select name="category" defaultValue="" className={FIELD}>
            <option value="">קטגוריה (לא חובה)</option>
            {ACCOUNTING_EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input name="desc" placeholder="תיאור" className={FIELD} />
          <input type="number" name="amount" min={0} placeholder="סכום" required className={FIELD} />
          <select name="business" className={FIELD}>
            <option value="general">כללי</option>
            <option value="computers">מחשבים</option>
            <option value="rentals">השכרות</option>
            <option value="coworking">משרד שיתופי</option>
          </select>
          <button type="submit" className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90">
            הוספה
          </button>
        </form>

        <CollectModal routes={routes} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span className="flex items-center gap-1.5"><Download className="h-4 w-4" />הכנסות אחרונות</span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{income.length}</span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {income.slice(0, 15).map((i) => {
            const bound = deleteIncomeAction.bind(null, i.id);
            const branchName = branchNameOf(branches, i.branchId);
            return (
              <div key={i.id} className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                <div className="flex-1">
                  <div className="font-bold text-ink">{i.desc || BUSINESS_LABELS[i.business]}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                    <span>{i.date}</span>
                    {INCOME_TYPE_LABELS[i.type] && (
                      <span className="rounded-full bg-[#f4f6f9] px-2 py-0.5 text-ink">{INCOME_TYPE_LABELS[i.type]}</span>
                    )}
                    {branchName && <span>· {branchName}</span>}
                  </div>
                </div>
                <div className="min-w-[75px] text-left font-extrabold text-emerald-600">{i.amount.toLocaleString()} ₪</div>
                <DeleteEntryButton confirmText={"למחק את ההכנסה?"} action={bound} successText="ההכנסה נמחקה בהצלחה" />
              </div>
            );
          })}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span className="flex items-center gap-1.5"><Upload className="h-4 w-4" />הוצאות אחרונות</span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{expenses.length}</span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {expenses.slice(0, 15).map((e) => {
            const bound = deleteExpenseAction.bind(null, e.id);
            return (
              <div key={e.id} className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                <div className="flex-1">
                  <div className="font-bold text-ink">{e.desc || BUSINESS_LABELS[e.business]}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{e.date}</div>
                </div>
                <div className="min-w-[75px] text-left font-extrabold text-red-600">{e.amount.toLocaleString()} ₪</div>
                <EditExpenseModal expense={e} />
                <DeleteEntryButton confirmText={"למחק את ההוצאה?"} action={bound} successText="ההוצאה נמחקה בהצלחה" />
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}
