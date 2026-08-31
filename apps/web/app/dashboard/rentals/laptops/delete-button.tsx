"use client";

export function DeleteLaptopButton({ action }: { action: () => void }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("למחוק את המחשב? הפעולה אינה הפיכה.")) e.preventDefault();
      }}
    >
      <button
        type="submit"
        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
      >
        מחיקה
      </button>
    </form>
  );
}
