import { redirect } from "next/navigation";
import { BarChart3, TrendingDown, TrendingUp, Scale } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingExpense, AccountingFixedExpense, Branch } from "@ultranet/shared-types";
import { loadMainLedger, currentMonth, incomeTypeLabel } from "@/lib/main-ledger";
import { countsToMain } from "@/lib/counts-to-main";
import { loadRecurringPurchaseIndex } from "@/lib/recurring-purchases";
import {
  isMainFixedExpenseActive,
  loadMainFixedExpenses,
  mainFixedExpenseAccrued,
  mainFixedExpenseMonths,
} from "@/lib/main-fixed-expenses";
import { RecurringHistoryPanel } from "@/components/recurring-expenses/recurring-history-panel";
import { isSharedExpenseBranch } from "@/lib/expense-shared-scope";
import {
  RECURRING_FREQUENCY_LABELS,
  amountForMonth,
  dueMonths,
  frequencyOf,
  lastClosedMonth,
  loadRecurringVariableExpenses,
  missingMonths,
  totalToDate,
} from "@/lib/recurring-expenses";
import { AccountingTabs } from "./accounting-tabs";
import { type BranchOption } from "./add-income-button";
import { LedgerWorkspace } from "./ledger-workspace";
import { type LedgerTableRow } from "./ledger-table";
import { type PurchaseRow } from "./purchases-table";
import { type RecurringPurchaseRow } from "./recurring-purchases-table";
import { type RecurringUpdateRow } from "./recurring-update-table";
import { type FixedExpenseRow } from "./fixed-expenses-table";
import { deleteExtraExpenseAction, deleteIncomeAction } from "./actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const BUSINESS_LABELS: Record<string, string> = {
  general: "כללי",
  computers: "חדרי מחשבים",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
};

const SCOPE_LABELS: Record<string, string> = {
  main: 'הנה"ח ראשית',
  computers: "חדרי מחשבים",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
};

/** חלון החודשים שבורר החודש מציע: שנה אחורה, מהחדש לישן. */
function monthWindow(upto: string, count = 12): string[] {
  const [y, m] = upto.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const total = (y ?? 2000) * 12 + (m ?? 1) - 1 - i;
    out.push(`${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`);
  }
  return out;
}

/**
 * הספר הראשי — שלושה מספרים, שני כפתורים, וטבלה אחת שנפתחת לפי בחירה.
 *
 * "כמה הוצאנו עד היום, כמה הכנסנו עד היום, מה המאזן" הן השאלות שהמסך הזה קיים בשבילן,
 * ולכן הן בראשו. מתחתיהן שני כפתורי ההזנה - הכנסה והוצאה - ומתחתם סרגל הטבלאות, שסגור
 * כברירת מחדל: שש הטבלאות של ההנה"ח לא נקראות יחד אף פעם, ומי שנכנס בוחר לאיזו שאלה
 * הוא נכנס. ראה `ledger-workspace.tsx`.
 *
 * המסך אוסף כאן את כל מה ששש הטבלאות צריכות, כולל כל מה שהיה עד היום במסך "הוצאות
 * נוספות" שנמחק: הרכישות החד-פעמיות, הסיכום של הרכישות החוזרות, ההוצאות הקבועות של
 * העסק, וההוצאות הקבועות המשתנות של **כל** המודולים. השורות נשטחות לאובייקטים פשוטים
 * כי הטבלאות הן קומפוננטות לקוח, וכל החישוב נשאר כאן בשרת.
 */
export default async function AccountingHomePage() {
  const session = await requireModuleAccess("accounting");
  if (session.user?.role !== "owner") redirect("/dashboard");

  const db = getAdminFirestore();
  const [ledger, branchesSnap, extraSnap, purchaseIndex, recurring, mainFixed] = await Promise.all([
    loadMainLedger(),
    db.collection("n_branches").get(),
    db.collection("n_ah_expenses").get(),
    loadRecurringPurchaseIndex(),
    loadRecurringVariableExpenses(),
    loadMainFixedExpenses(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted);

  const opt = (b: Branch): BranchOption => ({ id: b.id, name: b.name });
  const computerBranches = branches.filter((b) => b.branchType === "computers").map(opt);
  const rentalsBranches = branches.filter((b) => b.branchType === "rentals").map(opt);
  const allBranchOptions = [...branches].sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true })).map(opt);
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  const month = currentMonth();
  const today = new Date().toISOString().slice(0, 10);

  const cells = [
    {
      label: "הוצאנו עד היום",
      value: money(ledger.totals.expense),
      color: "#dc2626",
      icon: TrendingDown,
      sub: `החודש ${money(ledger.thisMonth.expense)}`,
    },
    {
      label: "הכנסנו עד היום",
      value: money(ledger.totals.income),
      color: "#059669",
      icon: TrendingUp,
      sub: `החודש ${money(ledger.thisMonth.income)}`,
    },
    {
      label: "מאזן",
      value: money(ledger.totals.balance),
      color: ledger.totals.balance >= 0 ? "#0f6e56" : "#dc2626",
      icon: Scale,
      sub: `החודש ${money(ledger.thisMonth.balance)}`,
    },
  ];

  // השורות עוברות לטבלה כאובייקטים שטוחים: `MainLedger` מחזיק את השורה הגולמית ב-Map,
  // וקומפוננטת לקוח לא יכולה לקבל Map. מה שהטבלה צריכה מהגולמית — מצב הקבלה ו"למי נמכר" —
  // נשטח לכאן, והשאר נשאר בשרת.
  const incomeRows: LedgerTableRow[] = ledger.income.map((entry) => {
    const raw = entry.source === "income" ? ledger.incomeRows.get(entry.id) : undefined;
    return {
      key: `${entry.source}|${entry.id}`,
      id: entry.id,
      date: entry.date,
      desc: entry.desc,
      amount: entry.amount,
      origin: entry.origin,
      category: entry.category ?? incomeTypeLabel(undefined),
      soldTo: raw?.soldTo,
      receipt:
        raw && (raw.type === "laptops" || raw.type === "cash")
          ? {
              issued: raw.receiptIssued === true,
              docNumber: raw.receiptDocNumber,
              clientName: raw.receiptClientName ?? entry.origin,
            }
          : undefined,
      deletable: Boolean(raw),
    };
  });

  const expenseRows: LedgerTableRow[] = ledger.expenses.map((entry) => ({
    key: `${entry.source}|${entry.id}`,
    id: entry.id,
    date: entry.date,
    desc: entry.desc,
    amount: entry.amount,
    origin: entry.origin,
    category: entry.category ?? "",
  }));

  // רכישות והוצאות חד-פעמיות של העסק עצמו. הן חלק מהוצאות הספר רק כשסומנו, ולכן הן
  // טבלה נפרדת ולא חלק מטבלת ההוצאות: כאן רואים גם את מה שלא נספר בשורה התחתונה.
  const extraExpenses = extraSnap.docs
    .map((d) => ({ ...(d.data() as Omit<AccountingExpense, "id">), id: d.id }) as AccountingExpense)
    .filter((e) => e.date);

  const purchaseRows: PurchaseRow[] = extraExpenses.map((e) => ({
    id: e.id,
    date: e.date,
    desc: e.desc,
    amount: e.amount || 0,
    category: e.category ?? "",
    businessLabel: BUSINESS_LABELS[e.business] ?? BUSINESS_LABELS.general!,
    branchesLabel: (e.linkedBranchIds ?? []).map((id) => branchNameById.get(id) ?? id).join(" · "),
    purchaseTypeName: (e.expenseTypeId && purchaseIndex.byType.get(e.expenseTypeId)?.type.name) || "",
    countsToMain: countsToMain(e),
  }));
  const purchasesTotalToMain = extraExpenses
    .filter((e) => countsToMain(e))
    .reduce((s, e) => s + (e.amount || 0), 0);

  const summaries = [...purchaseIndex.byType.values()].filter((s) => s.purchases.length > 0);
  const year = summaries[0]?.year ?? new Date().toISOString().slice(0, 4);
  const recurringPurchaseRows: RecurringPurchaseRow[] = summaries.map((s) => ({
    id: s.type.id,
    name: s.type.name,
    year: s.year,
    thisYearCount: s.thisYearCount,
    thisYearTotal: s.thisYearTotal,
    perMonth: s.perMonth,
    branchCount: s.branches.length,
    lastDate: s.lastPurchase?.date ?? "",
    grandTotal: s.grandTotal,
    totalCount: s.purchases.length,
  }));

  // ההוצאות הקבועות המשתנות של כל המודולים יחד — זו הפעולה החוזרת היחידה שההנה"ח
  // דורשת, וכל עוד היא הייתה מפוזרת על ארבעה מסכים היא נעשתה חלקית.
  // ההוצאות הקבועות של העסק עצמו. הצבירה מחושבת כאן ולא מוקלדת — היא בדיוק מה שהספר
  // הראשי סופר, שורה לכל חודש שההוצאה הייתה פעילה בו.
  const fixedExpenseRows: FixedExpenseRow[] = mainFixed
    .map((e: AccountingFixedExpense) => ({
      id: e.id,
      name: e.name,
      amount: e.amount || 0,
      category: e.category ?? "",
      businessLabel: BUSINESS_LABELS[e.business] ?? BUSINESS_LABELS.general!,
      startDate: e.startDate,
      endDate: e.endDate ?? "",
      accrued: mainFixedExpenseAccrued(e, month),
      monthCount: mainFixedExpenseMonths(e, month).length,
      countsToMain: countsToMain(e),
      active: isMainFixedExpenseActive(e, month),
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "he"));

  const closed = lastClosedMonth(month);
  const months = monthWindow(month);
  const monthsSet = new Set(months);
  const recurringUpdateRows: RecurringUpdateRow[] = recurring.map((e) => {
    const values: Record<string, number> = {};
    for (const m of months) {
      const v = amountForMonth(e, m);
      if (v !== null) values[m] = v;
    }
    const branchLabel = !e.branchId
      ? ""
      : isSharedExpenseBranch(e.branchId)
        ? "כל הסניפים"
        : (branchNameById.get(e.branchId) ?? "סניף שנמחק");
    const scope = SCOPE_LABELS[e.scope] ?? e.scope;
    const latest = [...(e.amounts ?? [])].sort((a, b) => b.month.localeCompare(a.month))[0];
    return {
      id: e.id,
      name: e.name,
      scopeLabel: branchLabel ? `${scope} — ${branchLabel}` : scope,
      category: e.category ?? "",
      frequencyLabel: RECURRING_FREQUENCY_LABELS[frequencyOf(e, month)],
      values,
      due: dueMonths(e, month).filter((m) => monthsSet.has(m)),
      suggested: latest?.amount ?? e.defaultAmount ?? 0,
      missingCount: missingMonths(e, closed).length,
      totalToDate: totalToDate(e, month),
      countsToMain: countsToMain(e),
      endDate: e.endDate ?? "",
    };
  });

  // פאנלי ההיסטוריה המלאה נבנים כאן ולא בטבלה: הם Server Components עם Server Actions
  // בתוכם, והטבלה היא קומפוננטת לקוח. הם נמסרים לה כתוכן מוכן ויושבים מתחתיה, מקופלים.
  const recurringHistoryPanels = recurring.map((e) => (
    <RecurringHistoryPanel key={e.id} expense={e} upto={month} />
  ));

  const frequencies = Object.entries(RECURRING_FREQUENCY_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <BarChart3 className="h-5 w-5" />
            הנהלת חשבונות
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">הספר של העסק — רק מה שסומן כמתחשבן בראשי</p>
        </div>
        <AccountingTabs active="/dashboard/accounting" />
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {cells.map((c) => (
          <article
            key={c.label}
            className="relative overflow-hidden rounded-card border border-card-border bg-white py-3 pl-3.5 pr-3 shadow-card"
          >
            <span className="absolute right-0 top-0 h-full w-[3px]" style={{ background: c.color }} />
            <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-muted">
              <c.icon className="h-3.5 w-3.5" />
              {c.label}
            </p>
            <p className="mt-px text-[26px] font-black leading-tight tabular-nums" style={{ color: c.color }}>
              {c.value}
            </p>
            <p className="text-[11px] text-muted">{c.sub}</p>
          </article>
        ))}
      </div>

      <LedgerWorkspace
        computerBranches={computerBranches}
        rentalsBranches={rentalsBranches}
        branches={allBranchOptions}
        expenseTypes={purchaseIndex.types}
        frequencies={frequencies}
        defaultDate={today}
        currentMonth={month}
        lastClosedMonth={closed}
        incomeRows={incomeRows}
        incomeTotal={ledger.totals.income}
        expenseRows={expenseRows}
        expenseTotal={ledger.totals.expense}
        purchaseRows={purchaseRows}
        purchasesTotalToMain={purchasesTotalToMain}
        recurringPurchaseRows={recurringPurchaseRows}
        year={year}
        fixedExpenseRows={fixedExpenseRows}
        recurringUpdateRows={recurringUpdateRows}
        recurringHistoryPanels={recurringHistoryPanels}
        months={months}
        deleteIncomeAction={deleteIncomeAction}
        deleteExtraExpenseAction={deleteExtraExpenseAction}
      />

      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        חודש נוכחי: {month}. הספר סופר <b>רק</b> שורות שסומנו &quot;לחשבן בהנה&quot;ח הראשית&quot;. הוצאה
        שנרשמה בסניף ולא סומנה נשארת בספר של אותו סניף בלבד — וזה בכוונה: אותו שקל לא צריך להופיע בשני
        ספרים.
      </p>
    </div>
  );
}
