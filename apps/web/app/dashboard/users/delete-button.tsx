"use client";

import type { MouseEvent } from "react";

export function DeleteButton() {
  return (
    <button
      type="submit"
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (!confirm("למחוק את המשתמש?")) {
          e.preventDefault();
        }
      }}
      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
    >
      מחיקה
    </button>
  );
}
