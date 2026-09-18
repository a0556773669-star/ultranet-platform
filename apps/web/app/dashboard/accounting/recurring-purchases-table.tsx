"use client";

import { useMemo } from "react";
import { Repeat } from "lucide-react";
import { DataTable, money, type DataColumn } from "./data-table";

/**
 * "כמה באמת הולך על זה" — הסיכום של הרכישות החוזרות, כטבלה מסוננת.
 *
 * שלוש קניות נייר של 300 ₪ מפוזרות על השנה נראות כלום כל אחת לחוד; ביחד הן 900 ₪ וזה
 * מספר שצריך לראות. הסכומים כאן הם של **כל העסק** — אותה קנייה בחדר מחשבים, בהשכרות
 * או בהנה"ח הראשית נספרת באותו מקום — ושום דבר כאן לא מזיז שקל: הכסף נשאר בחודש שבו
 * הוא יצא, בשורה שבה הוא נרשם.
 */

export interface RecurringPurchaseRow {
  id: string;
  name: string;
  year: string;
  thisYearCount: number;
  thisYearTotal: number;
  /** הסה"כ השנתי חלקי 12 — מספר להשוואה מול הוצאה קבועה בלבד */
  perMonth: number;
  branchCount: number;
  lastDate: string;
  grandTotal: number;
  totalCount: number;
}

export function RecurringPurchasesTable({ rows, year }: { rows: RecurringPurchaseRow[]; year: string }) {
  const columns = useMemo<DataColumn<RecurringPurchaseRow>[]>(
    () => [
      {
        key: "name",
        label: "מוצר",
        className: "truncate",
        value: (r) => r.name,
        render: (r) => (
          <span className="flex items-center gap-1.5 truncate font-bold text-ink" title={r.name}>
            <Repeat className="h-3.5 w-3.5 shrink-0 text-teal" />
            <span className="truncate">{r.name}</span>
          </span>
        ),
      },
      {
        key: "count",
        label: `קניות ב-${year}`,
        align: "center",
        className: "w-[110px]",
        value: (r) => r.thisYearCount,
        render: (r) => <span className="text-muted tabular-nums">{r.thisYearCount}</span>,
      },
      {
        key: "total",
        label: `סה"כ ${year}`,
        align: "center",
        className: "w-[118px]",
        value: (r) => r.thisYearTotal,
        render: (r) => (
          <span className="font-extrabold tabular-nums text-red-600">{money(r.thisYearTotal)}</span>
        ),
      },
      {
        key: "perMonth",
        label: "בחודש ממוצע",
        align: "center",
        className: "w-[118px]",
        value: (r) => r.perMonth,
        render: (r) => <span className="text-muted tabular-nums">{money(r.perMonth)}</span>,
      },
      {
        key: "branches",
        label: "סניפים",
        align: "center",
        className: "w-[86px]",
        value: (r) => r.branchCount,
        render: (r) => <span className="text-muted tabular-nums">{r.branchCount || "—"}</span>,
      },
      {
        key: "date",
        label: "קנייה אחרונה",
        align: "center",
        className: "w-[122px]",
        value: (r) => r.lastDate,
        render: (r) => <span className="text-muted tabular-nums">{r.lastDate || "—"}</span>,
      },
      {
        key: "grand",
        label: "מאז ומתמיד",
        align: "left",
        className: "w-[130px]",
        value: (r) => r.grandTotal,
        render: (r) => (
          <span className="tabular-nums text-muted" title={`${r.totalCount} קניות`}>
            {money(r.grandTotal)}
          </span>
        ),
      },
    ],
    [year],
  );

  return (
    <DataTable
      title="רכישות חוזרות — כמה באמת הולך על זה"
      icon={Repeat}
      rows={rows}
      columns={columns}
      getKey={(r) => r.id}
      searchText={(r) => r.name}
      searchHint="חיפוש מוצר..."
      dateOf={(r) => r.lastDate}
      amountOf={(r) => r.thisYearTotal}
      amountClass="text-red-600"
      totalLabel={`ב-${year}`}
      defaultSortKey="total"
      emptyText="עדיין לא סומנה אף הוצאה כרכישה חוזרת. מסמנים בטופס שבו רושמים את הקנייה."
      minWidth={880}
      note={
        <>
          כל קנייה נשארה הוצאה חד-פעמית רגילה בחודש שבו יצא הכסף — כאן רק רואים אותן יחד.
          <b> בחודש ממוצע</b> הוא הסכום השנתי חלקי 12, מספר להשוואה מול הוצאה קבועה בלבד.
        </>
      }
    />
  );
}
