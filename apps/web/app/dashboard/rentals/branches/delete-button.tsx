"use client";

import type { MouseEvent } from "react";

export function DeleteRentalBranchButton() {
  return (
    <button
      type="submit"
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (!confirm("למחוק את הסניף? הוא יוסתר מהרשימות הפעילות, אבל ההיסטוריה הכספית שלו תישאר זמינה בהנה\"ח.")) {
          e.preventDefault();
        }
      }}
      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
    >
      {"מחיקה"}
    </button>
  );
}
