import Link from "next/link";
import { BarChart3, Laptop, CreditCard, Banknote, Split } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CollectionRoute } from "@ultranet/shared-types";
import { isPendingAttribution } from "@/lib/accounting-entries";
import { loadMovements } from "@/lib/accounting-entries-data";
import { createIncomeAction } from "../actions";
import CollectModal from "../collect-modal";
import { loadOwnerFixedExpenseBurden } from "@/lib/owner-expense-burden";
import { loadComputerRoomSetupCostTotal } from "@/lib/computer-room-accounting";
import { AccountingTabs } from "../accounting-tabs";
import { AddExpenseForm } from "./add-expense-form";
import { EntryList } from "../entry-list";

const FIELD = "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export default async function AccountingPage() {
  await requireModuleAccess("accounting");

  const db = getAdminFirestore();
  const [{ entries, liveBranches }, routesSnap] = await Promise.all([
    loadMovements(),
    db.collection("n_collection_routes").get(),
  ]);

  const routes = routesSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<CollectionRoute, "id">), id: d.id }) as CollectionRoute,
  );

  const incomeRows = entries.filter((e) => e.kind === "income");
  const expenseRows = entries.filter((e) => e.kind === "expense");
  const pendingCount = entries.filter(isPendingAttribution).length;

  const laptopBranches = liveBranches
    .filter((b) => b.branchType === "rentals")
    .map((b) => ({ id: b.id, name: b.name }));
  const cashRegisterBranches = liveBranches
    .filter((b) => b.branchType === "computers")
    .map((b) => ({ id: b.id, name: b.name }));
  const coworkingBranches = liveBranches
    .filter((b) => b.branchType === "coworking")
    .map((b) => ({ id: b.id, name: b.name }));
  const branchGroups = {
    rooms: cashRegisterBranches,
    rentals: laptopBranches,
    coworking: coworkingBranches,
  };
  const creditDefaultDate = `${new Date().toISOString().slice(0, 7)}-10`;

  const fixedExpenseBurden = await loadOwnerFixedExpenseBurden();
  const computerRoomSetupCostTotal = await loadComputerRoomSetupCostTotal();

  // The headline cards are the owner's own book ("שלי") - only ledger rows, exactly as before.
  // A row filed to a branch has left this book on purpose and is counted in the branch's one.
  const ledgerIncome = incomeRows.filter((e) => e.book === "ledger");
  const ledgerExpenses = expenseRows.filter((e) => e.book === "ledger");
  const totalIncome = ledgerIncome.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses =
    ledgerExpenses.reduce((sum, e) => sum + e.amount, 0) +
    fixedExpenseBurden.toDate +
    computerRoomSetupCostTotal;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><BarChart3 className="h-5 w-5" />הנהלת חשבונות</h1>
          <p className="mt-1 text-[13px] text-muted">
            כל תנועה שנרשמת — הכנסה או הוצאה — נוחתת כאן ראשית, וממתינה לשיוך לסניף. משויכת לסניף
            היא עוברת לספר של אותו סניף ויוצאת מהרשימה הזו. ראה גם{" "}
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
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">סה&quot;כ הכנסות (הנה&quot;ח אישית)</p>
          <p className="mt-1 text-2xl font-black text-emerald-600">{totalIncome.toLocaleString()} ₪</p>
        </div>
        <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
          <span className="absolute right-0 top-0 h-full w-1 bg-red-500" />
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">סה&quot;כ הוצאות (הנה&quot;ח אישית)</p>
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

      {pendingCount > 0 && (
        <Link
          href="/dashboard/accounting/attribute"
          className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-card border border-[#e6a23c] bg-[#fff9ef] px-4 py-3 shadow-card transition hover:bg-[#fff4e0]"
        >
          <span className="flex items-center gap-1.5 text-[13px] font-extrabold text-[#8a5a00]">
            <Split className="h-4 w-4" />
            {pendingCount} תנועות ממתינות לשיוך לסניפים
          </span>
          <span className="text-[12.5px] font-bold text-[#8a5a00] underline">למסך השיוך ←</span>
        </Link>
      )}

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
        <AddExpenseForm
          rooms={cashRegisterBranches}
          rentals={laptopBranches}
          coworking={coworkingBranches}
        />

        <CollectModal routes={routes} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <EntryList kind="income" entries={incomeRows} branches={branchGroups} />
        <EntryList kind="expense" entries={expenseRows} branches={branchGroups} />
      </div>
    </div>
  );
}
