"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import type { RecurringPurchaseType } from "@ultranet/shared-types";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none";

export const NEW_EXPENSE_TYPE_VALUE = "__new__";

/**
 * "האם הרכישה הזו חוזרת על עצמה, ואם כן — של מה?"
 *
 * השאלה נשאלת בתוך טופס ההוצאה החד-פעמית ולא במסך נפרד, כי זה הרגע היחיד שבו באמת
 * יודעים את התשובה: בזמן שרושמים את הקנייה. מסך נפרד היה אומר "תיכנס אחר כך ותסמן",
 * ואחר כך לא קורה.
 *
 * הבחירה היא בסוג קיים, ולכן הקנייה הבאה של אותו מוצר מזוהה מעצמה — זו כל הנקודה.
 * "+ סוג חדש" קיים כדי שהפעם הראשונה לא תדרוש לעזוב את הטופס ולחזור אליו.
 */
export function ExpenseTypeField({
  types,
  defaultValue = "",
  idPrefix = "expense-type",
  label = "רכישה חוזרת (לא חובה)",
}: {
  types: RecurringPurchaseType[];
  defaultValue?: string;
  idPrefix?: string;
  label?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const isNew = value === NEW_EXPENSE_TYPE_VALUE;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${idPrefix}-select`} className="flex items-center gap-1 text-xs font-semibold text-muted">
        <Repeat className="h-3.5 w-3.5" />
        {label}
      </label>
      <select
        id={`${idPrefix}-select`}
        name="expenseTypeId"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={FIELD}
      >
        <option value="">רכישה חד-פעמית רגילה</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
        <option value={NEW_EXPENSE_TYPE_VALUE}>+ סוג רכישה חוזרת חדש…</option>
      </select>
      {isNew && (
        <input
          name="expenseTypeName"
          placeholder="שם המוצר, למשל: נייר למדפסת"
          required
          className={FIELD}
          autoFocus
        />
      )}
      <p className="text-[10.5px] leading-snug text-muted">
        סימון לא משנה איך ההוצאה נספרת — הכסף נשאר בחודש שבו יצא. הוא רק מחבר את כל הקניות של
        אותו מוצר, כדי שבסוף השנה יהיה אפשר לראות כמה באמת הלך עליו.
      </p>
    </div>
  );
}
