import { redirect } from "next/navigation";
import { BarChart3, TrendingDown, TrendingUp, Scale } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { loadMainLedger, currentMonth, incomeTypeLabel } from "@/lib/main-ledger";
import { AccountingTabs } from "./accounting-tabs";
import { AddIncomeForm, type BranchOption } from "./income-form";
import { LedgerTable, type LedgerTableRow } from "./ledger-table";
import { deleteIncomeAction } from "./actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * הספר הראשי — שלושה מספרים ורשימה.
 *
 * "כמה הוצאנו עד היום, כמה הכנסנו עד היום, מה המאזן" הן השאלות שהמסך הזה קיים בשבילן,
 * ולכן הן בראשו ולא אחרי שלוש טבלאות. שתי הטבלאות שמתחתיהן הן בדיוק מה שמרכיב את
 * המספרים - כל שורה שסומנה `countsToMain`, ורק היא - כך שאפשר תמיד ללחוץ ולראות מאיפה
 * הגיע כל שקל, בלי מסך "בדיקת שלמות" שמנסה להסביר בדיעבד למה שני מספרים לא הסתדרו.
 *
 * הטבלאות (`ledger-table.tsx`) פרושות אחת מתחת לשנייה ולא זו לצד זו: ספר עם אלפי שורות
 * צריך רוחב מלא לסינון, לסידור ולעימוד, ושתי עמודות צרות לא נתנו את זה.
 */
export default async function AccountingHomePage() {
  const session = await requireModuleAccess("accounting");
  if (session.user?.role !== "owner") redirect("/dashboard");

  const db = getAdminFirestore();
  const [ledger, branchesSnap] = await Promise.all([loadMainLedger(), db.collection("n_branches").get()]);
  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted);

  const opt = (b: Branch): BranchOption => ({ id: b.id, name: b.name });
  const computerBranches = branches.filter((b) => b.branchType === "computers").map(opt);
  const rentalsBranches = branches.filter((b) => b.branchType === "rentals").map(opt);

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

      <AddIncomeForm computerBranches={computerBranches} rentalsBranches={rentalsBranches} defaultDate={today} />

      <div className="flex flex-col gap-3.5">
        <LedgerTable
          kind="income"
          rows={incomeRows}
          total={ledger.totals.income}
          emptyText="אין עדיין הכנסות"
          deleteAction={deleteIncomeAction}
        />
        <LedgerTable
          kind="expense"
          rows={expenseRows}
          total={ledger.totals.expense}
          emptyText={'עדיין לא סומנה אף הוצאה כמתחשבנת בראשי. אפשר לסמן הוצאות קיימות במסך "עדכון רטרואקטיבי".'}
        />
      </div>

      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        חודש נוכחי: {month}. הספר סופר <b>רק</b> שורות שסומנו &quot;לחשבן בהנה&quot;ח הראשית&quot;. הוצאה
        שנרשמה בסניף ולא סומנה נשארת בספר של אותו סניף בלבד — וזה בכוונה: אותו שקל לא צריך להופיע בשני
        ספרים.
      </p>
    </div>
  );
}
