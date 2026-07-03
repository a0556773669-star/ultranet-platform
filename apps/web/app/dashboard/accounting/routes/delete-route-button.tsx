"use client";

export function DeleteRouteButton() {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm("למחוק את מסלול הגביה?")) {
          e.preventDefault();
        }
      }}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
    >
      מחיקה
    </button>
  );
}
