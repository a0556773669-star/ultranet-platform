"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { CalendarDays } from "lucide-react";

const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function label(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return month;
  return `${HE_MONTHS[m - 1]} ${y}`;
}

/** Which month the הנה"ח table shows. Defaults to the current month; never offers a future one,
 *  since the ledger it reads is only built up to today. */
export function MonthPicker({ month, months }: { month: string; months: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("month", next);
    startTransition(() => router.push(`/dashboard/rentals/accounting?${params.toString()}`));
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="flex items-center gap-1.5 font-bold text-muted">
        <CalendarDays className="h-4 w-4" />
        חודש
      </span>
      <select
        value={month}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm font-semibold text-ink focus:border-teal focus:outline-none disabled:opacity-60"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {label(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
