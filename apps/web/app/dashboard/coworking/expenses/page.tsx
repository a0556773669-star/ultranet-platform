import { Banknote, Hammer, Calendar, Receipt } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { SETUP_CATEGORY } from "@/lib/coworking";
import { countsToMain } from "@/lib/counts-to-main";
import { loadRecurringVariableExpenses } from "@/lib/recurring-expenses";
import { RecurringExpensesCard } from "@/components/recurring-expenses/recurring-expenses-card";
import { CountsToMainBadge } from "@/components/counts-to-main-field";
import { CoworkingTabs } from "../coworking-tabs";
import { BranchPicker } from "./branch-picker";
import { CoworkingExpenseForms } from "./expense-forms";
import {
  deleteCoworkingFixedExpenseAction,
  deleteCoworkingVariableExpenseAction,
} from "../actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function ExpenseList({
  rows,
  emptyText,
  deleteAction,
}: {
  rows: { id: string; title: string; subtitle: string; amount: number; on: boolean }[];
  emptyText: string;
  deleteAction: (id: string) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && <p className="text-sm text-muted">{emptyText}</p>}
      {rows.map((r) => {
        const bound = deleteAction.bind(null, r.id);
        return (
          <div
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-card-border bg-[#f9fafb] p-3"
          >
            <div>
              <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
                {r.title} — {money(r.amount)}
                <CountsToMainBadge on={r.on} />
              </p>
              <p className="text-xs text-muted">{r.subtitle}</p>
            </div>
            <form action={bound}>
              <button
                type="submit"
                className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50"
              >
                מחיקה
              </button>
            </form>
          </div>
        );
      })}
    </div>
  );
}

/**
 * הוצאות המשרד השיתופי — שלושה סוגים, שהם שלוש שאלות שונות.
 *
 * **הקמה** נשאלת פעם אחת ולא חוזרת (ריהוט, חשמלאי, שילוט), **קבועות** חוזרות באותו סכום
 * (שכירות), **שוטפות** הן אירוע בודד שיכול לקרות שוב (תיקון). מעליהן יושבות ההוצאות
 * הקבועות המשתנות, שהן קטגוריה רביעית: חוזרות, אבל בסכום אחר בכל חודש.
 */
export default async function CoworkingExpensesPage({
  searchParams,
}: {
  searchParams?: { branchId?: string };
}) {
  const session = await requireModuleAccess("coworking");
  const isOwner = session.user?.role === "owner";
  const myBranchId = session.user?.branchId;

  const db = getAdminFirestore();
  const branchesSnap = await db.collection("n_branches").where("branchType", "==", "coworking").get();
  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const allowed = isOwner ? branches : branches.filter((b) => b.id === myBranchId);
  const branchId = searchParams?.branchId && allowed.some((b) => b.id === searchParams.branchId)
    ? searchParams.branchId
    : allowed[0]?.id;

  if (!branchId) {
    return (
      <div>
        <CoworkingTabs active="/dashboard/coworking/expenses" />
        <div className="rounded-card border border-dashed border-card-border bg-white py-14 text-center text-muted">
          אין סניף משרד שיתופי. יש להקים סניף מסוג &quot;משרד שיתופי&quot; לפני רישום הוצאות.
        </div>
      </div>
    );
  }

  const [fixedSnap, variableSnap, recurring] = await Promise.all([
    db.collection("n_fixed_expenses").where("branchId", "==", branchId).get(),
    db.collection("n_var_expenses").where("branchId", "==", branchId).get(),
    loadRecurringVariableExpenses({ scope: "coworking", branchId }),
  ]);

  const fixed = fixedSnap.docs
    .map((d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense)
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
  const variable = variableSnap.docs
    .map((d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const setupRows = variable
    .filter((e) => e.category === SETUP_CATEGORY)
    .map((e) => ({ id: e.id, title: e.desc, subtitle: e.date, amount: e.amount || 0, on: countsToMain(e) }));
  const variableRows = variable
    .filter((e) => e.category !== SETUP_CATEGORY)
    .map((e) => ({
      id: e.id,
      title: e.desc,
      subtitle: `${e.category || "ללא קטגוריה"} · ${e.date}`,
      amount: e.amount || 0,
      on: countsToMain(e),
    }));
  const fixedRows = fixed.map((e) => ({
    id: e.id,
    title: `${e.name} (${money(e.amount || 0)}/חודש)`,
    subtitle: `${e.category || "ללא קטגוריה"} · מ-${e.startDate}${e.endDate ? ` עד ${e.endDate}` : ""}`,
    amount: e.amount || 0,
    on: countsToMain(e),
  }));

  return (
    <div>
      <CoworkingTabs active="/dashboard/coworking/expenses" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Banknote className="h-5 w-5" />
          הוצאות משרד שיתופי
        </h1>
        {allowed.length > 1 && <BranchPicker branches={allowed} branchId={branchId} />}
      </div>

      <div className="flex flex-col gap-4">
        <RecurringExpensesCard scope="coworking" branchId={branchId} expenses={recurring} canManage />

        <section className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
            <Hammer className="h-4 w-4" />
            הוצאות הקמה
          </h3>
          <CoworkingExpenseForms branchId={branchId} kind="setup" />
          <ExpenseList
            rows={setupRows}
            emptyText="אין הוצאות הקמה"
            deleteAction={deleteCoworkingVariableExpenseAction}
          />
        </section>

        <section className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
            <Calendar className="h-4 w-4" />
            הוצאות קבועות
          </h3>
          <CoworkingExpenseForms branchId={branchId} kind="fixed" />
          <ExpenseList rows={fixedRows} emptyText="אין הוצאות קבועות" deleteAction={deleteCoworkingFixedExpenseAction} />
        </section>

        <section className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink">
            <Receipt className="h-4 w-4" />
            הוצאות שוטפות
          </h3>
          <CoworkingExpenseForms branchId={branchId} kind="variable" />
          <ExpenseList
            rows={variableRows}
            emptyText="אין הוצאות שוטפות"
            deleteAction={deleteCoworkingVariableExpenseAction}
          />
        </section>
      </div>
    </div>
  );
}
