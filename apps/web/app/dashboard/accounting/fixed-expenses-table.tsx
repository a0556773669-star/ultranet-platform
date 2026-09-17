"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { CountsToMainBadge } from "@/components/counts-to-main-field";
import { DataTable, money, type DataColumn } from "./data-table";
import { DeleteEntryButton } from "./delete-entry-button";
import { EndMainFixedExpenseControl } from "./main-fixed-expense-controls";
import { deleteMainFixedExpenseAction } from "./actions";

/**
 * ההוצאות הקבועות של העסק עצמו (`n_ah_fixed_expenses`) — שכירות משרד, רואה חשבון, מנוי
 * תוכנה: אותו סכום כל חודש, שורה אחת.
 *
 * הצבירה מחושבת בשרת ולא מוקלדת, ולכן העמודה "נצבר עד היום" היא מספר ולא הערכה — היא
 * בדיוק מה שהספר הראשי סופר, שורה לכל חודש שההוצאה הייתה פעילה בו.
 *
 * **"הפסקה" ולא מחיקה**: `endDate` משאיר בספר את החודשים שההוצאה כן הייתה פעילה בהם,
 * ומחיקה מוציאה אותה למפרע מכולם — היא לטעות הקלדה בלבד, וזה כתוב על כפתור המחיקה.
 * שינוי סכום = להפסיק את הקיימת ולפתוח חדשה, בדיוק כמו בהוצאה קבועה של סניף.
 */

export interface FixedExpenseRow {
  id: string;
  name: string;
  /** הסכום ה**חודשי** */
  amount: number;
  category: string;
  businessLabel: string;
  startDate: string;
  /** ריק = פעילה */
  endDate: string;
  accrued: number;
  monthCount: number;
  countsToMain: boolean;
  active: boolean;
}

export function FixedExpensesTable({ rows }: { rows: FixedExpenseRow[] }) {
  const columns = useMemo<DataColumn<FixedExpenseRow>[]>(
    () => [
      {
        key: "name",
        label: "הוצאה",
        className: "min-w-0",
        value: (r) => r.name,
        render: (r) => (
          <div className="min-w-0" title={r.name}>
            <p className="flex items-center gap-1.5 truncate font-bold text-ink">
              <span className="truncate">{r.name}</span>
              <CountsToMainBadge on={r.countsToMain} />
            </p>
            <p className="truncate text-[10.5px] text-muted">{r.category || "ללא קטגוריה"}</p>
          </div>
        ),
      },
      {
        key: "amount",
        label: "לחודש",
        align: "center",
        className: "w-[108px]",
        value: (r) => r.amount,
        render: (r) => <span className="font-extrabold tabular-nums text-red-600">{money(r.amount)}</span>,
      },
      {
        key: "business",
        label: "תחום",
        className: "w-[112px] truncate",
        filterable: true,
        allLabel: "כל התחומים",
        value: (r) => r.businessLabel,
        render: (r) => <span className="text-muted">{r.businessLabel}</span>,
      },
      {
        key: "category",
        label: "קטגוריה",
        className: "w-[120px] truncate",
        filterable: true,
        allLabel: "כל הקטגוריות",
        value: (r) => r.category,
        render: (r) => (
          <span className="text-muted" title={r.category}>
            {r.category || "—"}
          </span>
        ),
      },
      {
        key: "status",
        label: "סטטוס",
        align: "center",
        className: "w-[136px] truncate",
        filterable: true,
        allLabel: "הכל",
        value: (r) => (r.active ? "פעילה" : "הופסקה"),
        render: (r) =>
          r.active ? (
            <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[10.5px] font-extrabold text-teal-dark">
              פעילה
            </span>
          ) : (
            <span
              className="rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10.5px] font-bold text-muted"
              title={`הופסקה ב-${r.endDate}`}
            >
              הופסקה {r.endDate}
            </span>
          ),
      },
      {
        key: "date",
        label: "מתחיל",
        align: "center",
        className: "w-[104px]",
        value: (r) => r.startDate,
        render: (r) => <span className="text-muted tabular-nums">{r.startDate}</span>,
      },
      {
        key: "accrued",
        label: 'נצבר עד היום',
        align: "center",
        className: "w-[130px]",
        value: (r) => r.accrued,
        render: (r) => (
          <span className="tabular-nums text-ink" title={`${r.monthCount} חודשים`}>
            {money(r.accrued)}
            <span className="block text-[10px] text-muted">{r.monthCount} חודשים</span>
          </span>
        ),
      },
      {
        key: "actions",
        label: "",
        align: "left",
        className: "w-[186px]",
        render: (r) => (
          <div className="flex items-center justify-end gap-1.5">
            {r.active && <EndMainFixedExpenseControl id={r.id} />}
            <DeleteEntryButton
              compact
              confirmText={
                r.active
                  ? "למחוק את ההוצאה הקבועה? היא תיעלם מכל החודשים למפרע — להוצאה שפשוט נגמרה השתמש ב'הפסקה'."
                  : "למחוק את ההוצאה הקבועה? היא תיעלם מהספר הראשי גם לחודשים שהיא כן הייתה פעילה בהם."
              }
              action={() => deleteMainFixedExpenseAction(r.id)}
              successText="ההוצאה נמחקה"
            />
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      title="הוצאות קבועות של העסק"
      icon={CalendarClock}
      rows={rows}
      columns={columns}
      getKey={(r) => r.id}
      searchText={(r) => `${r.name} ${r.category} ${r.businessLabel} ${Math.round(r.amount)}`}
      searchHint="חיפוש הוצאה, קטגוריה או תחום..."
      dateOf={(r) => r.startDate}
      amountOf={(r) => (r.active ? r.amount : 0)}
      amountClass="text-red-600"
      totalLabel="לחודש (פעילות)"
      defaultSortKey="status"
      defaultSortDir="asc"
      emptyText='אין עדיין הוצאות קבועות. מוסיפים דרך "הוספת הוצאה" למעלה.'
      minWidth={1040}
      note={
        <>
          הוצאה שחוזרת כל חודש ב<b>אותו</b> סכום. נרשמת פעם אחת ונצברת לבד מחודש ההתחלה והלאה —
          הספר הראשי מקבל שורה לכל חודש שהיא הייתה פעילה בו. הוצאה שהסכום שלה משתנה כל חודש
          שייכת ל&quot;עדכון קבוע משתנה&quot;. <b>הפסקה</b> שומרת את כל מה שכבר יצא מהכיס ורק עוצרת
          מכאן והלאה; <b>מחיקה</b> מוציאה אותה מכל החודשים למפרע, והיא לטעות הקלדה בלבד.
        </>
      }
    />
  );
}
