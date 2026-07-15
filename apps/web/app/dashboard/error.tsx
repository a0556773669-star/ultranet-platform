"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <h2 className="text-lg font-bold text-ink">משהו השתבש</h2>
      <p className="max-w-md text-sm text-muted">
        {error.message && error.message.length < 200
          ? error.message
          : "אירעה שגיאה בלתי צפויה. נסה שוב, ואם זה חוזר על עצמו שלח צילום מסך."}
      </p>
      {error.digest && (
        <p className="text-xs text-muted" dir="ltr">
          Digest: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          נסה שוב
        </button>
        <a
          href="/dashboard"
          className="rounded-[10px] border border-card-border bg-white px-5 py-2 text-sm font-bold text-ink transition hover:bg-[#f4f6f9]"
        >
          חזרה לדף הבית
        </a>
      </div>
    </div>
  );
}
