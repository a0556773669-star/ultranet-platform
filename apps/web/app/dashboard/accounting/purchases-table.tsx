"use client";

import { useMemo } from "react";
import { Layers, Repeat } from "lucide-react";
import { CountsToMainBadge } from "@/components/counts-to-main-field";
import { DataTable, money, type DataColumn } from "./data-table";
import { DeleteEntryButton } from "./delete-entry-button";

/**
 * רכישות והוצאות חד-פעמיות של העסק (`n_ah_expenses`) — עכשיו כטבלה ולא כרשימה.
 *
 * עד היום זו הייתה רשימת שורות במסך "הוצאות נוספות", בלי חיפוש ובלי סידור: כדי למצוא
 * "כמה שילמתי על התיקון ההוא בפברואר" היה צריך לגלול. הנתונים לא השתנו — אותו קולקשן,
 * אותה מחיקה — רק הדרך להסתכל בהם.
 */

export interface PurchaseRow {
  id: string;
  date: string;
  desc: string;
  amount: number;
  category: string;
  businessLabel: string;
  /** שמות הסניפים ששוייכו לרכישה (תיעוד בלבד) */
  branchesLabel: string;
  /** שם הסוג אם הרכישה סומנה כרכישה חוזרת */
  purchaseTypeName: string;
  countsToMain: boolean;
}

export function PurchasesTable({
  rows,
  totalToMain,
  deleteAction,
}: {
  rows: PurchaseRow[];
  /** כמה מתוך הסכום נכנס בפועל לספר הראשי */
  totalToMain: number;
  deleteAction: (id: string) => Promise<void>;
}) {
  const columns = useMemo<DataColumn<PurchaseRow>[]>(
    () => [
      {
        key: "date",
        label: "תאריך",
        className: "w-[98px] truncate",
        value: (r) => r.date,
        render: (r) => <span className="text-muted tabular-nums">{r.date}</span>,
      },
      {
        key: "desc",
        label: "תיאור",
        className: "truncate",
        value: (r) => r.desc,
        render: (r) => (
          <span className="flex items-center gap-1.5 truncate font-semibold text-ink" title={r.desc}>
            <span className="truncate">{r.desc}</span>
            <CountsToMainBadge on={r.countsToMain} />
          </span>
        ),
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
        key: "business",
        label: "תחום",
        className: "w-[112px] truncate",
        filterable: true,
        allLabel: "כל התחומים",
        value: (r) => r.businessLabel,
        render: (r) => <span className="text-muted">{r.businessLabel}</span>,
      },
      {
        key: "purchaseType",
        label: "רכישה חוזרת",
        className: "w-[136px] truncate",
        filterable: true,
        allLabel: "כל הרכישות",
        value: (r) => r.purchaseTypeName,
        render: (r) =>
          r.purchaseTypeName ? (
            <span
              className="inline-flex items-center gap-1 truncate rounded-full border border-teal/30 bg-teal-bg/50 px-2 py-0.5 text-[10.5px] font-bold text-teal-dark"
              title={r.purchaseTypeName}
            >
              <Repeat className="h-3 w-3 shrink-0" />
              {r.purchaseTypeName}
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        key: "branches",
        label: "שוייך לסניפים",
        className: "w-[150px] truncate",
        value: (r) => r.branchesLabel,
        render: (r) => (
          <span className="text-muted" title={r.branchesLabel || undefined}>
            {r.branchesLabel || "—"}
          </span>
        ),
      },
      {
        key: "amount",
        label: "סכום",
        align: "left",
        className: "w-[96px] truncate",
        value: (r) => r.amount,
        render: (r) => (
          <span className="font-extrabold tabular-nums text-red-600">{money(r.amount)}</span>
        ),
      },
      {
        key: "actions",
        label: "",
        className: "w-[56px]",
        align: "left",
        render: (r) => (
          <DeleteEntryButton
            compact
            confirmText="למחוק את ההוצאה?"
            action={() => deleteAction(r.id)}
            successText="ההוצאה נמחקה"
          />
        ),
      },
    ],
    [deleteAction],
  );

  return (
    <DataTable
      title={'רכישות והוצאות חד-פעמיות'}
      icon={Layers}
      rows={rows}
      columns={columns}
      getKey={(r) => r.id}
      searchText={(r) =>
        `${r.desc} ${r.category} ${r.businessLabel} ${r.purchaseTypeName} ${r.branchesLabel} ${Math.round(r.amount)}`
      }
      searchHint="חיפוש בתיאור, בקטגוריה, בתחום ובסכום..."
      dateOf={(r) => r.date}
      amountOf={(r) => r.amount}
      amountClass="text-red-600"
      defaultSortKey="date"
      emptyText="אין עדיין רכישות או הוצאות חד-פעמיות"
      minWidth={980}
      note={
        <>
          מתוך הסכום הזה <b className="text-red-600">{money(totalToMain)}</b> מסומן &quot;לחשבן
          בהנה&quot;ח הראשית&quot; ונספר בשורה התחתונה למעלה. שיוך לסניפים הוא תיעוד בלבד — הוא לא
          פותח התחשבנות מול הסניף ולא מזיז שקל.
        </>
      }
    />
  );
}
