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

/**
 * בוחר החודש של טבלת ההעברות.
 *
 * במסך הזה יש שני צירי זמן — חלון 12 החודשים של המעקב (`end`) וחודש ההעברות (`month`) —
 * ולכן הניווט בונה מחדש את ה-query הקיים ומחליף בו פרמטר אחד בלבד. קישור שכותב רק את
 * `month` היה מאפס בשקט את החלון שנבחר בצד השני של המסך.
 */
export function TransfersMonthPicker({ month, months }: { month: string; months: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function go(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", next);
    startTransition(() => router.push(`/dashboard/accounting/mobile?${params.toString()}`));
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
        onChange={(e) => go(e.target.value)}
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
