import type { Milestone } from "@ultranet/shared-types";
import { isPastDue } from "./date-utils";

/**
 * תקציר התקופה שמוצג בראש מסך החודש/השבוע (סעיף 7.3): נבחרו, הושלמו, בביצוע,
 * טרם התחילו, ממתינים ואיחורים. זהו רכיב שרת טהור - רק ספירה והצגה.
 */
export function PeriodSummary({ milestones, today, label }: { milestones: Milestone[]; today: string; label: string }) {
  const active = milestones.filter((m) => m.status !== "cancelled");
  const cells: { label: string; value: number; className: string }[] = [
    { label, value: active.length, className: "border-card-border bg-white text-ink" },
    {
      label: "הושלמו",
      value: active.filter((m) => m.status === "done").length,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      label: "בביצוע",
      value: active.filter((m) => m.status === "in_progress").length,
      className: "border-teal bg-teal-bg text-teal-dark",
    },
    {
      label: "טרם התחילו",
      value: active.filter((m) => m.status === "not_started").length,
      className: "border-card-border bg-[#f4f6f9] text-muted",
    },
    {
      label: "ממתינים",
      value: active.filter((m) => m.status === "waiting").length,
      className: "border-purple/30 bg-[#f4ecf8] text-purple",
    },
    {
      label: "איחורים",
      value: active.filter((m) => m.status !== "done" && isPastDue(m.dueDate, today)).length,
      className: "border-red-200 bg-red-50 text-red-700",
    },
  ];

  return (
    <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {cells.map((c) => (
        <div key={c.label} className={`rounded-[11px] border px-2.5 py-2 text-center ${c.className}`}>
          <div className="text-lg font-extrabold leading-none">{c.value}</div>
          <div className="mt-1 text-[11px] font-semibold">{c.label}</div>
        </div>
      ))}
    </div>
  );
}
