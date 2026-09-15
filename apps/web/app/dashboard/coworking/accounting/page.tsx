import Link from "next/link";
import { BarChart3, Calendar, Receipt } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, CoworkingClient, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { buildCoworkingLedger } from "@/lib/coworking";
import { countsToMain } from "@/lib/counts-to-main";
import { loadRecurringVariableExpenses } from "@/lib/recurring-expenses";
import { RecurringExpensesCard } from "@/components/recurring-expenses/recurring-expenses-card";
import { CountsToMainBadge } from "@/components/counts-to-main-field";
import { CoworkingTabs } from "../coworking-tabs";
import { CoworkingExpenseForm } from "./expense-forms";
import { loadRecurringPurchaseTypes } from "@/lib/recurring-purchases";
import {
  deleteCoworkingFixedExpenseAction,
  deleteCoworkingVariableExpenseAction,
  endCoworkingFixedExpenseAction,
  resumeCoworkingFixedExpenseAction,
} from "../actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * שורת הוצאה במשרד השיתופי.
 *
 * `endAction` קיים בהוצאות הקבועות בלבד, וזו לא קוסמטיקה: הוצאה קבועה נצברת מחדש בכל
 * חודש שעובר, ועד שהייתה כאן רק "מחיקה" הדרך היחידה לעצור שכירות שהסתיימה הייתה למחוק
 * אותה - כלומר למחוק גם את כל החודשים שהיא באמת עלתה בהם. "סיום" עוצר את הצבירה ומשאיר
 * את ההיסטוריה.
 */
function ExpenseList({
  rows,
  emptyText,
  deleteAction,
  endAction,
  resumeAction,
  today,
}: {
  rows: { id: string; title: string; subtitle: string; amount: number; on: boolean; endDate?: string }[];
  emptyText: string;
  deleteAction: (id: string) => Promise<void>;
  endAction?: (id: string, formData: FormData) => Promise<void>;
  resumeAction?: (id: string) => Promise<void>;
  today?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && <p className="text-sm text-muted">{emptyText}</p>}
      {rows.map((r) => {
        const bound = deleteAction.bind(null, r.id);
        const end = endAction?.bind(null, r.id);
        const resume = resumeAction?.bind(null, r.id);
        return (
          <div
            key={r.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-card-border p-3 ${
              r.endDate ? "bg-[#f4f6f9] opacity-75" : "bg-[#f9fafb]"
            }`}
          >
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                {r.title} — {money(r.amount)}
                <CountsToMainBadge on={r.on} />
              </p>
              <p className="text-xs text-muted">{r.subtitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {end && !r.endDate && (
                <form action={end} className="flex items-center gap-1">
                  <input
                    name="endDate"
                    type="date"
                    defaultValue={today}
                    className="rounded-lg border border-card-border bg-white px-2 py-1 text-[11px]"
                  />
                  <button
                    type="submit"
                    title="ההיסטוריה נשמרת — רק מפסיקים לצבור מהתאריך הזה"
                    className="rounded-lg border border-card-border bg-white px-2 py-1 text-[11px] font-bold text-ink transition hover:bg-[#f4f6f9]"
                  >
                    סיום
                  </button>
                </form>
              )}
              {resume && r.endDate && (
                <form action={resume}>
                  <button
                    type="submit"
                    className="rounded-lg border border-card-border bg-white px-2 py-1 text-[11px] font-bold text-ink transition hover:bg-[#f4f6f9]"
                  >
                    חידוש
                  </button>
                </form>
              )}
              <form action={bound}>
                <button
                  type="submit"
                  title="מחיקה מוציאה את ההוצאה מכל החודשים למפרע — לסיום השתמש ב'סיום'"
                  className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50"
                >
                  מחיקה
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * הנה"ח משרד שיתופי — המאזן וגם ניהול ההוצאות.
 *
 * לשונית "הוצאות" הנפרדת בוטלה: היא החזיקה את אותם שני סוגים שהמסך הזה כבר סיכם,
 * ולהחזיק את הסיכום במקום אחד ואת ההזנה במקום אחר רק חייב לקפוץ בין שני מסכים כדי
 * להבין מספר. **הקמה כבר לא נרשמת כאן** אלא בטופס הסניף (`/branches`), ששם היא באמת
 * תכונה של הסניף ולא אירוע חודשי.
 */
export default async function CoworkingAccountingPage() {
  const session = await requireModuleAccess("coworking");
  const isOwner = session.user?.role === "owner";
  const myBranchId = session.user?.branchId;

  const db = getAdminFirestore();
  const [branchesSnap, clientsSnap, fixedSnap, variableSnap] = await Promise.all([
    db.collection("n_branches").where("branchType", "==", "coworking").get(),
    db.collection("n_cw_clients").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .filter((b) => isOwner || b.id === myBranchId);
  const branchIds = new Set(branches.map((b) => b.id));

  const allClients = clientsSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<CoworkingClient, "id">), id: d.id }) as CoworkingClient,
  );
  const clients = allClients.filter((c) => branchIds.has(c.branchId));

  // השכרות שאינן משויכות לאף סניף משרד שיתופי חי. התשלומים שלהן כבר נספרים בהנה"ח הראשית
  // (`loadMainLedger` קורא את `n_cw_clients` בלי סינון סניף), ולכן השמטתם כאן הייתה גורמת
  // ל"קיבלתי" של המודול להיות נמוך מהכסף שנרשם בפועל. נספרים רק אצל הבעלים, שרואה ממילא
  // את כל הסניפים — אצל עובד סניף `branchIds` הוא סניף אחד וכל השאר היה נראה יתום.
  const orphanClients = isOwner ? allClients.filter((c) => !branchIds.has(c.branchId)) : [];
  const orphanReceived = orphanClients
    .flatMap((c) => c.payments ?? [])
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const fixed = fixedSnap.docs
    .map((d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense)
    .filter((e) => branchIds.has(e.branchId))
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  const variable = variableSnap.docs
    .map((d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense)
    .filter((e) => branchIds.has(e.branchId))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const ledger = buildCoworkingLedger({ fixed, variable, clients: [...clients, ...orphanClients], branches });

  // הסניף שההזנה נרשמת עליו. כרגע יש סניף אחד, ולכן אין בורר: הראשון הוא הסניף.
  const branch = branches[0];
  const [recurring, expenseTypes] = await Promise.all([
    branch ? loadRecurringVariableExpenses({ scope: "coworking", branchId: branch.id }) : Promise.resolve([]),
    loadRecurringPurchaseTypes({ module: "coworking" }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const fixedRows = fixed.map((e) => ({
    id: e.id,
    title: `${e.name} (${money(e.amount || 0)}/חודש)`,
    subtitle: `${e.category || "ללא קטגוריה"} · מ-${e.startDate}${e.endDate ? ` · הופסק ${e.endDate}` : ""}`,
    amount: e.amount || 0,
    on: countsToMain(e),
    endDate: e.endDate,
  }));
  const variableRows = variable.map((e) => ({
    id: e.id,
    title: e.desc,
    subtitle: `${e.category || "ללא קטגוריה"} · ${e.date}`,
    amount: e.amount || 0,
    on: countsToMain(e),
  }));

  return (
    <div>
      <CoworkingTabs active="/dashboard/coworking/accounting" />

      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <BarChart3 className="h-5 w-5" />
        {'הנה"ח משרד שיתופי'}
      </h1>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <article className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">שילמתי עד היום</p>
          <p className="mt-1 text-[26px] font-black text-red-600">{money(ledger.paidToDate)}</p>
        </article>
        <article className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">קיבלתי עד היום</p>
          <p className="mt-1 text-[26px] font-black text-emerald-600">{money(ledger.receivedToDate)}</p>
          {orphanReceived > 0 && (
            <p className="mt-1 text-[11px] font-bold text-amber-700">
              כולל {money(orphanReceived)} מ{orphanClients.length === 1 ? "השכרה שאינה משויכת" : "השכרות שאינן משויכות"}{" "}
              לסניף —{" "}
              <Link href="/dashboard/coworking" className="underline">
                לטיפול במסך העמדות
              </Link>
            </p>
          )}
        </article>
        <article className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">מאזן</p>
          <p className={`mt-1 text-[26px] font-black ${ledger.balance >= 0 ? "text-teal-dark" : "text-red-600"}`}>
            {money(ledger.balance)}
          </p>
        </article>
      </div>

      <div className="mt-3 rounded-card border border-card-border bg-white p-4 text-[12.5px] shadow-card">
        <p className="mb-1.5 font-bold text-ink">ממה מורכבות ההוצאות</p>
        <ul className="space-y-0.5 text-muted">
          <li>
            הקמה: <b className="text-ink">{money(ledger.setupToDate)}</b>
            {ledger.setupFromBranches > 0 && ledger.setupFromExpenses > 0 && (
              <span className="text-[11.5px]">
                {" "}
                ({money(ledger.setupFromBranches)} מפירוט הסניפים · {money(ledger.setupFromExpenses)} משורות ישנות)
              </span>
            )}{" "}
            <Link href="/dashboard/coworking" className="font-bold text-teal hover:underline">
              נרשמת בטופס הסניף
            </Link>
          </li>
          <li>
            קבועות (נצבר מתחילת כל הוצאה עד היום): <b className="text-ink">{money(ledger.fixedToDate)}</b>
          </li>
          <li>
            משתנות: <b className="text-ink">{money(ledger.variableToDate)}</b>
          </li>
        </ul>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
          המספרים כאן הם של המשרד השיתופי בלבד. מה מתוכם נכנס גם לשורה התחתונה של העסק נקבע פר-שורה
          לפי הסימון &quot;לחשבן בהנה&quot;ח הראשית&quot;.
        </p>
      </div>

      {!branch ? (
        <div className="mt-4 rounded-card border border-dashed border-card-border bg-white py-12 text-center text-muted">
          <p>אין סניף משרד שיתופי — אי אפשר לרשום הוצאות.</p>
          {isOwner && (
            <Link
              href="/dashboard/coworking/branches/new"
              className="mt-3 inline-block rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              + סניף משרד שיתופי
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <RecurringExpensesCard scope="coworking" branchId={branch.id} expenses={recurring} canManage />

          <section className="rounded-card border border-card-border bg-white p-4 shadow-card">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
              <Calendar className="h-4 w-4" />
              הוצאות קבועות
            </h2>
            <CoworkingExpenseForm branchId={branch.id} kind="fixed" />
            <ExpenseList
              rows={fixedRows}
              emptyText="אין הוצאות קבועות"
              deleteAction={deleteCoworkingFixedExpenseAction}
              endAction={endCoworkingFixedExpenseAction}
              resumeAction={resumeCoworkingFixedExpenseAction}
              today={today}
            />
          </section>

          <section className="rounded-card border border-card-border bg-white p-4 shadow-card">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
              <Receipt className="h-4 w-4" />
              הוצאות משתנות
            </h2>
            <CoworkingExpenseForm branchId={branch.id} kind="variable" expenseTypes={expenseTypes} />
            <ExpenseList
              rows={variableRows}
              emptyText="אין הוצאות משתנות"
              deleteAction={deleteCoworkingVariableExpenseAction}
            />
          </section>
        </div>
      )}
    </div>
  );
}
