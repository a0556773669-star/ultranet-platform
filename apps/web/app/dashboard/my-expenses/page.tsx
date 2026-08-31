import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOwnerName } from "@/lib/owner-name";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { loadTransactionModel } from "@/lib/tx-data";
import { chargesInMonth, currentMonthOf } from "@/lib/tx";
import { EXPENSE_POLICY_KEYS, EXPENSE_POLICY_LABEL, resolvedPolicy } from "@/lib/expense-policy";
import type { Branch } from "@ultranet/shared-types";
import { BranchExpenseForm } from "./expense-form";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] text-[12.5px]";

export default async function MyBranchExpensesPage() {
  // A branch manager needs no module permission for his own expense screen: the branch on his
  // session IS the authorisation, and it is the only branch he can ever write to.
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const branchId = session.user?.branchId;

  // The owner has no "my branch" - he sees every branch from the accounting module instead.
  if (!branchId || branchId === "all") redirect("/dashboard/accounting/overview");

  const db = getAdminFirestore();
  const [branchSnap, model, ownerName] = await Promise.all([
    db.collection("n_branches").doc(branchId).get(),
    loadTransactionModel(),
    getOwnerName(),
  ]);
  if (!branchSnap.exists) redirect("/dashboard");
  const branch = { ...(branchSnap.data() as Omit<Branch, "id">), id: branchSnap.id } as Branch;

  const partnerLabel = branch.partnerName?.trim() || "הסניף";
  const month = currentMonthOf();
  const policy = resolvedPolicy(branch);

  // This branch's own expense rows, this month - what he entered plus whatever recurs.
  const rows = model.transactions
    .filter(
      (t) =>
        t.node.branchId === branchId &&
        t.direction === "out" &&
        t.nature === "operating" &&
        chargesInMonth(t, month),
    )
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const total = rows.reduce((sum, t) => sum + t.amount, 0);

  const recurringRows = model.transactions.filter(
    (t) => t.node.branchId === branchId && t.direction === "out" && !!t.recurring?.from && !t.recurring?.to,
  );

  return (
    <div>
      <div className="mb-3">
        <h2 className="flex items-center gap-1.5 text-[18px] font-extrabold text-ink">
          <Receipt className="h-5 w-5" />
          ההוצאות של {branch.name}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-muted">
          מה שהוצאת בפועל על הסניף — נכנס להתחשבנות מיד, בלי לחכות לאישור
        </p>
      </div>

      <div className={`${CARD} mb-3.5 px-4 py-3 text-[12.5px] leading-relaxed text-muted`}>
        <b className="text-ink">מה שאתה מזין:</b> על מה, כמה, מתי, והקבלה. אלה עובדות, ואתה היחיד
        שיודע אותן. <b className="text-ink">מה שלא תתבקש להזין:</b> מי נושא בעלות — זה נגזר מההסכם של
        הסניף, ולכן אי אפשר לטעות בו.
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <BranchExpenseForm branch={branch} ownerName={ownerName} partnerLabel={partnerLabel} />

        <div className="flex flex-col gap-3.5">
          <section className={`${CARD} overflow-hidden`}>
            <div className="border-b border-card-border px-4 py-3">
              <h2 className="text-[15px] font-extrabold text-ink">ההסכם של הסניף</h2>
              <p className="mt-0.5 text-[12px] text-muted">מי משלם מה — נקבע מול {ownerName}, לקריאה בלבד</p>
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {EXPENSE_POLICY_KEYS.map((key) => (
                  <tr key={key}>
                    <td className={TD}>{EXPENSE_POLICY_LABEL[key]}</td>
                    <td className={`${TD} text-left font-bold`}>
                      {policy[key] === "partner" ? (
                        <span className="text-[#1d4fb8]">{partnerLabel}</span>
                      ) : (
                        <span className="text-teal-dark">{ownerName}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {recurringRows.length > 0 && (
            <section className={`${CARD} overflow-hidden`}>
              <div className="border-b border-card-border px-4 py-3">
                <h2 className="text-[15px] font-extrabold text-ink">הוצאות שרצות לבד כל חודש</h2>
                <p className="mt-0.5 text-[12px] text-muted">הוזנו פעם אחת. אף אחד לא מזין אותן שוב.</p>
              </div>
              <table className="w-full border-collapse">
                <tbody>
                  {recurringRows.map((t) => (
                    <tr key={t.id}>
                      <td className={TD}>
                        <span className="font-bold text-ink">{t.desc}</span>
                        <span className="mr-1.5 text-[11px] text-muted">מ-{t.recurring?.from}</span>
                      </td>
                      <td className={`${TD} text-left font-bold tabular-nums text-ink`}>{money(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      </div>

      <section className={`${CARD} mt-3.5 overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border px-4 py-3">
          <h2 className="text-[15px] font-extrabold text-ink">הוצאות החודש ({month})</h2>
          <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-[12px] font-bold text-ink">
            {rows.length} שורות · {money(total)}
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">עדיין לא נרשמו הוצאות לחודש הזה.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>תאריך</th>
                <th className={TH}>תיאור</th>
                <th className={TH}>קטגוריה</th>
                <th className={TH}>סכום</th>
                <th className={TH}>קבלה</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={`${t.source}:${t.id}`}>
                  <td className={`${TD} whitespace-nowrap tabular-nums text-muted`}>
                    {t.recurring?.from ? "חוזרת" : t.date}
                  </td>
                  <td className={`${TD} font-bold text-ink`}>{t.desc}</td>
                  <td className={`${TD} text-muted`}>{t.category ?? "—"}</td>
                  <td className={`${TD} tabular-nums`}>{money(t.amount)}</td>
                  <td className={`${TD} text-muted`}>{t.doc ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="border-t border-card-border px-4 py-2.5 text-[11.5px] leading-relaxed text-muted">
          כל שורה כאן כבר מקזזת את ההעברה החודשית מולך — היא נספרת מהרגע שנשמרה. הדוח החודשי שיישלח
          אליך ב-1 לחודש מפרט את כולן, כולל מי שילם ועל חשבון מי.
        </p>
      </section>
    </div>
  );
}
