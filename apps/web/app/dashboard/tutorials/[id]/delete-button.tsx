"use client";

import type { MouseEvent } from "react";

export default function DeleteButton() {
  return (
    <button
      type="submit"
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        if (!confirm("למחוק את ההדרכה?")) {
          e.preventDefault();
        }
      }}
      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
    >
      {"מחיקה"}
    </button>
  );
}
