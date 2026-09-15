"use client";

import type { MouseEvent } from "react";
import { Trash2 } from "lucide-react";

/**
 * האישור מונה את התשלומים בכוונה: מחיקת השכרה מוחקת איתה כל תשלום שנרשם עליה, והתשלומים
 * האלה נספרו כהכנסה בהנה"ח הראשית - כלומר המחיקה גורעת משם כסף. מספר קונקרטי בשאלה הוא
 * ההבדל בין "כן" אוטומטי לבין החלטה.
 */
export function DeleteRentalButton({ name, paymentCount }: { name: string; paymentCount: number }) {
  const question =
    paymentCount > 0
      ? `למחוק את ההשכרה של ${name}? יימחקו איתה ${paymentCount} תשלומים שנרשמו, והסכום שלהם ירד מההנה"ח הראשית. הפעולה בלתי הפיכה.`
      : `למחוק את ההשכרה של ${name}? הפעולה בלתי הפיכה.`;

  return (
    <button
      type="submit"
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (!confirm(question)) e.preventDefault();
      }}
      className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2 py-0.5 text-[11px] font-bold text-muted transition hover:border-red-200 hover:text-red-600"
    >
      <Trash2 className="h-3 w-3" />
      מחיקת ההשכרה
    </button>
  );
}
