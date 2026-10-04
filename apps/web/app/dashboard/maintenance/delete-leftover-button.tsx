"use client";

import type { MouseEvent } from "react";
import { Trash2 } from "lucide-react";

/**
 * האישור חוזר על הערת הכסף בכוונה: חלק מהשורות כאן נספרות בהנה"ח הראשית, ומחיקה שלהן
 * משנה את השורה התחתונה של העסק. שאלה שמכילה את המספר היא ההבדל בין החלטה לבין קליק.
 */
export function DeleteLeftoverButton({ title, moneyNote }: { title: string; moneyNote?: string }) {
  const question = `למחוק לצמיתות את "${title}"?${moneyNote ? `\n\n${moneyNote}` : ""}\n\nהפעולה בלתי הפיכה.`;
  return (
    <button
      type="submit"
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (!confirm(question)) e.preventDefault();
      }}
      className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2.5 py-1 text-[11px] font-bold text-muted transition hover:border-red-300 hover:text-red-600"
    >
      <Trash2 className="h-3.5 w-3.5" />
      מחיקה לצמיתות
    </button>
  );
}
