"use client";

import { PriceUpdateControl } from "@/components/expenses/price-update-control";
import { reviseCoworkingFixedExpenseAction } from "../actions";

/** "עדכון מחיר" של הוצאה קבועה במשרד השיתופי — ראו `PriceUpdateControl`. */
export function ReviseCoworkingFixedControl({ id, amount }: { id: string; amount: number }) {
  return (
    <PriceUpdateControl
      currentAmount={amount}
      submit={(fromMonth, newAmount) => reviseCoworkingFixedExpenseAction(id, fromMonth, newAmount)}
    />
  );
}
