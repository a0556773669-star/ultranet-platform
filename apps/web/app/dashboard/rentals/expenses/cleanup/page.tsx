/** ראה `./types.ts` — מסך זמני למחיקה המונית של הוצאות. */
import Link from "next/link";
import { ArrowLeft, Eraser } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { FixedExpense, MultiBranchExpense, VariableExpense } from "@ultranet/shared-types";
import { SHARED_RENTALS_BRANCH_ID } from "@/lib/expense-shared-scope";
import { MULTI_BRANCH_EXPENSES_COLLECTION, splitOf, multiBranchExpenseNote } from "@/lib/multi-branch-expense";
import { loadRecurringPurchaseTypes } from "@/lib/recurring-purchases";
import { countsToMain } from "@/lib/counts-to-main";
import { belongsToRentalsCleanup, loadRentalsExpenseScope } from "./scope";
import { ExpenseCleanupClient } from "./cleanup-client";
import type { CleanupGroup, CleanupRow } from "./types";

export default async function ExpensesCleanupPage() {
  await requireOwner();

  const db = getAdminFirestore();
  const [scope, fixedSnap, variableSnap, multiSnap, types] = await Promise.all([
    loadRentalsExpenseScope(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection(MULTI_BRANCH_EXPENSES_COLLECTION).get(),
    loadRecurringPurchaseTypes({ includeArchived: true }),
  ]);

  const typeNameById = new Map(types.map((t) => [t.id, t.name]));

  const fixed = fixedSnap.docs
    .map((d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense)
    .filter((e) => belongsToRentalsCleanup(scope, e.branchId));
  const variable = variableSnap.docs
    .map((d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense)
    .filter((e) => belongsToRentalsCleanup(scope, e.branchId));
  const multi = multiSnap.docs
    .map((d) => ({ ...(d.data() as Omit<MultiBranchExpense, "id">), id: d.id }) as MultiBranchExpense)
    .filter((e) => e.module === "rentals");

  const rowsForBranch = (branchId: string): CleanupRow[] => {
    const rows: CleanupRow[] = [
      ...fixed
        .filter((e) => e.branchId === branchId)
        .map((e) => ({
          id: e.id,
          kind: "fixed" as const,
          desc: e.name || "(ללא שם)",
          amount: e.amount || 0,
          date: e.startDate || "",
          endDate: e.endDate,
          category: e.category,
          typeName: undefined,
          paidBy: e.paidBy,
          owedBy: e.owedBy,
          countsToMain: countsToMain(e),
        })),
      ...variable
        .filter((e) => e.branchId === branchId)
        .map((e) => ({
          id: e.id,
          kind: "variable" as const,
          desc: e.desc || "(ללא תיאור)",
          amount: e.amount || 0,
          date: e.date || "",
          category: e.category,
          typeName: e.expenseTypeId ? (typeNameById.get(e.expenseTypeId) ?? "סוג שנמחק") : undefined,
          paidBy: e.paidBy,
          owedBy: e.owedBy,
          countsToMain: countsToMain(e),
        })),
    ];
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  };

  const groups: CleanupGroup[] = [];

  for (const branch of scope.branches) {
    const rows = rowsForBranch(branch.id);
    if (rows.length === 0) continue;
    groups.push({
      key: branch.id,
      title: branch.name,
      note: branch.deleted ? "סניף שנמחק — ההוצאות שלו עדיין קיימות בדאטהבייס" : undefined,
      rows,
    });
  }

  const sharedRows = rowsForBranch(SHARED_RENTALS_BRANCH_ID);
  if (sharedRows.length > 0) {
    groups.push({
      key: SHARED_RENTALS_BRANCH_ID,
      title: "הוצאות על כל סניפי ההשכרות יחד",
      note: "לא שייכות לסניף מסוים — מתחלקות בין כל הסניפים",
      rows: sharedRows,
    });
  }

  if (multi.length > 0) {
    groups.push({
      key: "multi",
      title: "הוצאות על כמה סניפים",
      note: "מחיקה מסירה את ההוצאה מכל הסניפים שהיא התחלקה ביניהם",
      rows: multi
        .map((e) => ({
          id: e.id,
          kind: "multi" as const,
          desc: e.desc || "(ללא תיאור)",
          amount: e.amount || 0,
          date: e.date || "",
          category: e.category,
          typeName: e.expenseTypeId ? (typeNameById.get(e.expenseTypeId) ?? "סוג שנמחק") : undefined,
          paidBy: e.paidBy,
          owedBy: "owner",
          countsToMain: countsToMain(e),
          scopeNote: `${multiBranchExpenseNote(splitOf(e))} · ${e.branchIds
            .map((id) => scope.branchNameById.get(id) ?? "סניף שנמחק")
            .join(" · ")}`,
        }))
        .sort((a, b) => b.date.localeCompare(a.date)),
    });
  }

  // שורות שה-branchId שלהן לא קיים יותר ב-n_branches: לא מוצגות באף מסך אחר.
  const orphanIds = [
    ...new Set(
      [...fixed, ...variable]
        .map((e) => e.branchId)
        .filter((id) => id !== SHARED_RENTALS_BRANCH_ID && !scope.knownBranchIds.has(id)),
    ),
  ];
  for (const orphanId of orphanIds) {
    groups.push({
      key: orphanId,
      title: "סניף לא מזוהה",
      note: `אין סניף עם המזהה ${orphanId} — שורות יתומות שלא מופיעות באף מסך`,
      rows: rowsForBranch(orphanId),
    });
  }

  const total = groups.reduce((sum, g) => sum + g.rows.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
          <Eraser className="h-5 w-5" />
          ניקוי הוצאות — כל הסניפים ({total.toLocaleString("he-IL")} שורות)
        </h1>
        <Link
          href="/dashboard/rentals/expenses"
          className="flex items-center gap-1.5 text-xs font-bold text-teal hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          חזרה למסך ההוצאות
        </Link>
      </div>

      <div className="rounded-card border border-amber-200 bg-amber-50 p-3 text-[12.5px] leading-relaxed text-amber-900">
        <b>מסך זמני.</b> הוא נפתח כדי למחוק הוצאות ישנות בכמות גדולה בבת אחת, ונועד להימחק
        כשהניקוי יסתיים. המחיקה כאן היא <b>סופית ולא ניתנת לשחזור</b> — בדיוק כמו מחיקת שורה
        בודדת במסך ההוצאות, רק על כל המסומנות יחד.
      </div>

      <ExpenseCleanupClient groups={groups} />
    </div>
  );
}
