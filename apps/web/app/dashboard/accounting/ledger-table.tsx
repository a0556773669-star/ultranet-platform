"use client";

import { useMemo } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { DataTable, money, type DataColumn } from "./data-table";
import { IssueReceiptButton } from "./receipt-button";
import { DeleteEntryButton } from "./delete-entry-button";

/**
 * טבלת הספר הראשי — הכנסות או הוצאות, אותה טבלה בדיוק.
 *
 * כאן נשארה רק הגדרת העמודות; הסינון, הסידור והעימוד חיים ב-`data-table.tsx` ומשותפים
 * לכל טבלאות המסך. רוחבי העמודות מפורשים (`table-fixed`) כדי שכל שורה תצא בגובה אחד
 * ושתי הטבלאות ייראו כמו טבלה אחת שנחתכה לשניים — ההבדל היחיד הוא עמודת הפעולות שיש
 * רק בהכנסות. "מקור" רחב מהשאר כי שמות סניפים מלאים ("חדר מחשבים אשדוד") יושבים בו.
 */

export interface LedgerTableRow {
  /** מזהה ייחודי לשורה בטבלה (source|id) */
  key: string;
  /** מזהה המסמך עצמו — נדרש למחיקה ולהפקת קבלה */
  id: string;
  date: string;
  desc: string;
  amount: number;
  origin: string;
  category: string;
  /** הכנסות בלבד: למי נמכר, ומצב המסמך. `receipt` קיים רק כשמותר להפיק מסמך על השורה. */
  soldTo?: string;
  receipt?: { issued: boolean; docNumber?: string; clientName?: string };
  deletable?: boolean;
}

const COL = { date: "w-[98px]", category: "w-[126px]", origin: "w-[150px]", amount: "w-[96px]" };

export function LedgerTable({
  kind,
  rows,
  total,
  emptyText,
  deleteAction,
}: {
  kind: "income" | "expense";
  rows: LedgerTableRow[];
  /** הסכום הכולל של הספר, לפני סינון — הכותרת מציגה אותו גם כשמסננים */
  total: number;
  emptyText: string;
  /** נמסר רק להכנסות, ורק הוא מפעיל את עמודת המחיקה */
  deleteAction?: (id: string) => Promise<void>;
}) {
  const isIncome = kind === "income";
  const amountClass = isIncome ? "text-emerald-600" : "text-red-600";

  const columns = useMemo<DataColumn<LedgerTableRow>[]>(() => {
    const base: DataColumn<LedgerTableRow>[] = [
      {
        key: "date",
        label: "תאריך",
        className: `${COL.date} truncate`,
        value: (r) => r.date,
        render: (r) => <span className="text-muted tabular-nums">{r.date}</span>,
      },
      {
        key: "desc",
        label: "תיאור",
        className: "truncate",
        value: (r) => r.desc,
        render: (r) => (
          <span className="font-semibold text-ink" title={r.soldTo ? `${r.desc} · נמכר ל${r.soldTo}` : r.desc}>
            {r.desc}
            {r.soldTo && <span className="mr-1.5 text-[11px] font-normal text-muted">· נמכר ל{r.soldTo}</span>}
          </span>
        ),
      },
      {
        key: "category",
        label: isIncome ? "סוג" : "קטגוריה",
        className: `${COL.category} truncate`,
        filterable: true,
        allLabel: isIncome ? "כל הסוגים" : "כל הקטגוריות",
        value: (r) => r.category,
        render: (r) => (
          <span className="text-muted" title={r.category}>
            {r.category || "—"}
          </span>
        ),
      },
      {
        key: "origin",
        label: "מקור",
        className: `${COL.origin} truncate`,
        filterable: true,
        allLabel: "כל המקורות",
        value: (r) => r.origin,
        render: (r) => (
          <span className="text-muted" title={r.origin}>
            {r.origin}
          </span>
        ),
      },
      {
        key: "amount",
        label: "סכום",
        align: "left",
        className: `${COL.amount} truncate`,
        value: (r) => r.amount,
        render: (r) => (
          <span className={`font-extrabold tabular-nums ${amountClass}`} title={money(r.amount)}>
            {money(r.amount)}
          </span>
        ),
      },
    ];

    if (!isIncome) return base;

    return [
      ...base,
      {
        key: "actions",
        label: "",
        className: "w-[84px]",
        render: (r) => (
          <div className="flex items-center justify-end gap-1 overflow-hidden">
            {/* מסמך מופק רק על כסף שלא נסלק: העברה מסניף ניידים, ומזומן שנמשך מקופה.
                שורת אשראי לא מקבלת כפתור בכלל - נדרים פלוס כבר הפיק עליה חשבונית מס
                קבלה, ומסמך שני היה כפילות. הכלל נאכף גם בשרת (`receipt-actions.ts`),
                כי כפתור מוסתר הוא לא אכיפה. */}
            {r.receipt && (
              <IssueReceiptButton
                compact
                incomeId={r.id}
                amount={r.amount}
                receiptIssued={r.receipt.issued}
                receiptDocNumber={r.receipt.docNumber}
                defaultClientName={r.receipt.clientName}
              />
            )}
            {r.deletable && deleteAction && (
              <DeleteEntryButton
                compact
                confirmText="למחוק את שורת ההכנסה?"
                action={() => deleteAction(r.id)}
                successText="ההכנסה נמחקה"
              />
            )}
          </div>
        ),
      },
    ];
  }, [isIncome, amountClass, deleteAction]);

  return (
    <DataTable
      title={isIncome ? "הכנסות" : "הוצאות שמתחשבנות בראשי"}
      icon={isIncome ? TrendingUp : TrendingDown}
      rows={rows}
      columns={columns}
      getKey={(r) => r.key}
      searchText={(r) => `${r.desc} ${r.origin} ${r.category} ${r.soldTo ?? ""} ${Math.round(r.amount)}`}
      searchHint='חיפוש בתיאור, במקור, בקטגוריה ובסכום'
      dateOf={(r) => r.date}
      amountOf={(r) => r.amount}
      amountClass={amountClass}
      total={total}
      defaultSortKey="date"
      emptyText={emptyText}
      minWidth={isIncome ? 666 : 582}
    />
  );
}
