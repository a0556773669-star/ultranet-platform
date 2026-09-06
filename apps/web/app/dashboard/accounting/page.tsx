import { redirect } from "next/navigation";
import { BarChart3, TrendingDown, TrendingUp, Scale } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { loadMainLedger, currentMonth, incomeTypeLabel } from "@/lib/main-ledger";
import { AccountingTabs } from "./accounting-tabs";
import { AddIncomeForm, type BranchOption } from "./income-form";
import { IssueReceiptButton } from "./receipt-button";
import { DeleteEntryButton } from "./delete-entry-button";
import { deleteIncomeAction } from "./actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * הספר הראשי — שלושה מספרים ורשימה.
 *
 * "כמה הוצאנו עד היום, כמה הכנסנו עד היום, מה המאזן" הן השאלות שהמסך הזה קיים בשבילן,
 * ולכן הן בראשו ולא אחרי שלוש טבלאות. שתי הרשימות שמתחתיהן הן בדיוק מה שמרכיב את
 * המספרים - כל שורה שסומנה `countsToMain`, ורק היא - כך שאפשר תמיד ללחוץ ולראות מאיפה
 * הגיע כל שקל, בלי מסך "בדיקת שלמות" שמנסה להסביר בדיעבד למה שני מספרים לא הסתדרו.
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

      <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span>הכנסות ({ledger.income.length})</span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-emerald-700 normal-case">
              {money(ledger.totals.income)}
            </span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {ledger.income.length === 0 && <p className="py-6 text-center text-sm text-muted">אין עדיין הכנסות</p>}
            {ledger.income.map((entry) => {
              const raw = ledger.incomeRows.get(entry.id);
              const bound = raw && entry.source === "income" ? deleteIncomeAction.bind(null, entry.id) : null;
              return (
                <div
                  key={`${entry.source}|${entry.id}`}
                  className="flex items-start gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0"
                >
                  <div className="flex-1">
                    <div className="font-bold text-ink">{entry.desc}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                      <span>{entry.date}</span>
                      <span>·</span>
                      <span>{entry.category ?? incomeTypeLabel(undefined)}</span>
                      <span>·</span>
                      <span>{entry.origin}</span>
                      {raw?.soldTo && <span>· נמכר ל{raw.soldTo}</span>}
                    </div>
                    {raw?.type === "laptops" && (
                      <div className="mt-1">
                        <IssueReceiptButton
                          incomeId={entry.id}
                          amount={entry.amount}
                          receiptIssued={raw.receiptIssued === true}
                          receiptDocNumber={raw.receiptDocNumber}
                          defaultClientName={raw.receiptClientName ?? entry.origin}
                        />
                      </div>
                    )}
                  </div>
                  <div className="min-w-[80px] text-left font-extrabold text-emerald-600">{money(entry.amount)}</div>
                  {bound && (
                    <DeleteEntryButton
                      confirmText="למחוק את שורת ההכנסה?"
                      action={bound}
                      successText="ההכנסה נמחקה"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
            <span>הוצאות שמתחשבנות בראשי ({ledger.expenses.length})</span>
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-red-600 normal-case">
              {money(ledger.totals.expense)}
            </span>
          </div>
          <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
            {ledger.expenses.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">
                עדיין לא סומנה אף הוצאה כמתחשבנת בראשי. אפשר לסמן הוצאות קיימות במסך &quot;עדכון רטרואקטיבי&quot;.
              </p>
            )}
            {ledger.expenses.map((entry) => (
              <div
                key={`${entry.source}|${entry.id}`}
                className="flex items-start gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0"
              >
                <div className="flex-1">
                  <div className="font-bold text-ink">{entry.desc}</div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {entry.date} · {entry.origin}
                    {entry.category ? ` · ${entry.category}` : ""}
                  </div>
                </div>
                <div className="min-w-[80px] text-left font-extrabold text-red-600">{money(entry.amount)}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        חודש נוכחי: {month}. הספר סופר <b>רק</b> שורות שסומנו &quot;לחשבן בהנה&quot;ח הראשית&quot;. הוצאה
        שנרשמה בסניף ולא סומנה נשארת בספר של אותו סניף בלבד — וזה בכוונה: אותו שקל לא צריך להופיע בשני
        ספרים.
      </p>
    </div>
  );
}
