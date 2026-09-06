"use client";

import { useRouter } from "next/navigation";
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

export function TransfersMonthPicker({ month, months }: { month: string; months: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="flex items-center gap-1.5 font-bold text-muted">
        <CalendarDays className="h-4 w-4" />
        חודש
      </span>
      <select
        value={month}
        disabled={isPending}
        onChange={(e) =>
          startTransition(() => router.push(`/dashboard/accounting/transfers?month=${e.target.value}`))
        }
        className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm font-semibold text-ink focus:border-teal focus:outline-none"
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
