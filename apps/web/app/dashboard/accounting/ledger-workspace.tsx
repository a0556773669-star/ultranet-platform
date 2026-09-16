"use client";

import { useState, type ComponentType } from "react";
import { Gauge, Layers, Repeat, TrendingDown, TrendingUp, X } from "lucide-react";
import type { RecurringPurchaseType } from "@ultranet/shared-types";
import { AddIncomeButton, type BranchOption } from "./add-income-button";
import { AddExpenseButton } from "./add-expense-button";
import { LedgerTable, type LedgerTableRow } from "./ledger-table";
import { PurchasesTable, type PurchaseRow } from "./purchases-table";
import { RecurringPurchasesTable, type RecurringPurchaseRow } from "./recurring-purchases-table";
import { RecurringUpdateTable, type RecurringUpdateRow } from "./recurring-update-table";

/**
 * גוף המסך הראשי: שני כפתורי הזנה, סרגל טבלאות, וטבלה אחת בכל רגע.
 *
 * שתי החלטות עומדות מאחורי הפריסה הזו. הראשונה: **ההזנה היא כפתור, לא טופס פרוש**.
 * הספר הראשי הוא מסך שמסתכלים בו, וטופס שתופס את חציו העליון גזל את המקום ממה שבאמת
 * רוצים לראות. שני כפתורים — הכנסה והוצאה — ומאחורי כל אחד מהם בדיוק אותם שדות שהיו
 * בטופס הפרוש.
 *
 * השנייה: **ברירת המחדל היא מסך נקי**. חמש הטבלאות של ההנה"ח לא נקראות יחד אף פעם;
 * מי שנכנס רוצה לראות את שלושת המספרים למעלה, ואז לבחור לאיזו שאלה הוא נכנס. סרגל
 * שני, זהה לסרגל הניווט שמעליו, פותח אחת בכל פעם — ו"סגירה" מחזיר את המסך הנקי.
 *
 * זו גם הסיבה שהמסך הזה בלע את "הוצאות נוספות": הרכישות החד-פעמיות והרכישות החוזרות
 * היו מסך נפרד רק כי לא היה להן מקום כאן. עכשיו יש.
 */

type View = "income" | "expenses" | "purchases" | "recurring-purchases" | "recurring-update";

const VIEWS: { key: View; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "income", label: "הכנסות", icon: TrendingUp },
  { key: "expenses", label: "הוצאות", icon: TrendingDown },
  { key: "purchases", label: 'רכישות והוצאות ח"פ', icon: Layers },
  { key: "recurring-purchases", label: "רכישות חוזרות", icon: Repeat },
  { key: "recurring-update", label: "עדכון קבוע משתנה", icon: Gauge },
];

export function LedgerWorkspace({
  computerBranches,
  rentalsBranches,
  branches,
  expenseTypes,
  frequencies,
  defaultDate,
  currentMonth,
  lastClosedMonth,
  incomeRows,
  incomeTotal,
  expenseRows,
  expenseTotal,
  purchaseRows,
  purchasesTotalToMain,
  recurringPurchaseRows,
  year,
  recurringUpdateRows,
  months,
  deleteIncomeAction,
  deleteExtraExpenseAction,
}: {
  computerBranches: BranchOption[];
  rentalsBranches: BranchOption[];
  branches: BranchOption[];
  expenseTypes: RecurringPurchaseType[];
  frequencies: { value: string; label: string }[];
  defaultDate: string;
  currentMonth: string;
  lastClosedMonth: string;
  incomeRows: LedgerTableRow[];
  incomeTotal: number;
  expenseRows: LedgerTableRow[];
  expenseTotal: number;
  purchaseRows: PurchaseRow[];
  purchasesTotalToMain: number;
  recurringPurchaseRows: RecurringPurchaseRow[];
  year: string;
  recurringUpdateRows: RecurringUpdateRow[];
  months: string[];
  deleteIncomeAction: (id: string) => Promise<void>;
  deleteExtraExpenseAction: (id: string) => Promise<void>;
}) {
  const [view, setView] = useState<View | null>(null);

  const countOf: Record<View, number> = {
    income: incomeRows.length,
    expenses: expenseRows.length,
    purchases: purchaseRows.length,
    "recurring-purchases": recurringPurchaseRows.length,
    "recurring-update": recurringUpdateRows.length,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <AddIncomeButton
          computerBranches={computerBranches}
          rentalsBranches={rentalsBranches}
          defaultDate={defaultDate}
        />
        <AddExpenseButton
          branches={branches}
          expenseTypes={expenseTypes}
          frequencies={frequencies}
          defaultDate={defaultDate}
          currentMonth={currentMonth}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-xl border border-card-border bg-white p-1">
          {VIEWS.map((v) => {
            const on = v.key === view;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(on ? null : v.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold transition ${
                  on ? "bg-teal-bg text-teal-dark" : "text-muted hover:bg-gray-100"
                }`}
              >
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
                <span className="text-[11px] font-extrabold opacity-60 tabular-nums">{countOf[v.key]}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setView(null)}
          disabled={view === null}
          title="סגירת הטבלאות — חוזרים למסך נקי"
          className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-card-border bg-white px-3 py-1.5 text-[12px] font-bold text-muted transition hover:border-teal hover:text-teal disabled:cursor-not-allowed disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
          סגירה
        </button>
      </div>

      {view === null && (
        <p className="px-1 text-[11.5px] leading-relaxed text-muted">
          בחר טבלה מהסרגל כדי לפתוח אותה. בכל טבלה יש חיפוש, סינון וסידור לפי כל עמודה, והסכום
          שמוצג בשורת הסינון הוא של השורות שסוננו.
        </p>
      )}

      {view === "income" && (
        <LedgerTable
          kind="income"
          rows={incomeRows}
          total={incomeTotal}
          emptyText="אין עדיין הכנסות"
          deleteAction={deleteIncomeAction}
        />
      )}

      {view === "expenses" && (
        <LedgerTable
          kind="expense"
          rows={expenseRows}
          total={expenseTotal}
          emptyText="עדיין לא סומנה אף הוצאה כמתחשבנת בראשי. מסמנים הוצאה בטופס שבו היא נרשמה."
        />
      )}

      {view === "purchases" && (
        <PurchasesTable
          rows={purchaseRows}
          totalToMain={purchasesTotalToMain}
          deleteAction={deleteExtraExpenseAction}
        />
      )}

      {view === "recurring-purchases" && <RecurringPurchasesTable rows={recurringPurchaseRows} year={year} />}

      {view === "recurring-update" && (
        <RecurringUpdateTable
          rows={recurringUpdateRows}
          months={months}
          defaultMonth={lastClosedMonth}
          currentMonth={currentMonth}
          lastClosedMonth={lastClosedMonth}
        />
      )}
    </div>
  );
}
