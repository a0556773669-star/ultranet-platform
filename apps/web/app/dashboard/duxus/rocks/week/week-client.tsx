"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Milestone, Rock, RockReview } from "@ultranet/shared-types";
import { carryOverMilestoneToWeekAction, toggleMilestoneDoneAction } from "../actions";
import { shiftWeekKey, weekLabel as weekLabelOf } from "../date-utils";
import { buildRocksById, rockBreadcrumb } from "../rock-lookup";
import { useToast } from "@/lib/toast";
import { ReviewPanel } from "../review-panel";

const WEEKLY_AGENDA = [
  "מה נשמע?",
  "אבני הדרך של השבוע - הצלחנו?",
  "הפקת לקחים",
  "קביעת אבני דרך לשבוע הבא עם הטלת אחריות ברורה",
];

export function WeekClient({
  weekKey,
  weekLabel,
  prevHref,
  nextHref,
  milestones,
  overdue,
  rocks,
  initialReviewNotes,
  previousReviews,
}: {
  weekKey: string;
  weekLabel: string;
  prevHref: string;
  nextHref: string;
  milestones: Milestone[];
  overdue: Milestone[];
  rocks: Rock[];
  initialReviewNotes: string;
  previousReviews: RockReview[];
}) {
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [localMilestones, setLocalMilestones] = useState(milestones);

  const rocksById = useMemo(() => buildRocksById(rocks), [rocks]);

  function handleToggleDone(id: string) {
    setLocalMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, done: !m.done } : m)));
    startTransition(async () => {
      const result = await toggleMilestoneDoneAction(id);
      if (!result.ok) {
        showError(result.message);
        setLocalMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, done: !m.done } : m)));
      }
    });
  }

  function handleCarryOver(m: Milestone) {
    const nextWeek = shiftWeekKey(m.weekKey ?? weekKey, 1);
    startTransition(async () => {
      const result = await carryOverMilestoneToWeekAction(m.id, nextWeek);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(`הועבר ל${weekLabelOf(nextWeek)}`);
    });
  }

  const doneCount = localMilestones.filter((m) => m.done).length;

  return (
    <div>
      {toastNode}
      <div className="mb-4 flex items-center justify-between">
        <Link href={prevHref} className="btn-outline text-xs">
          ‹ הקודם
        </Link>
        <h2 className="text-lg font-bold text-ink">{weekLabel}</h2>
        <Link href={nextHref} className="btn-outline text-xs">
          הבא ›
        </Link>
      </div>

      <ReviewPanel
        period="weekly"
        periodKey={weekKey}
        title="פגישה שבועית"
        agenda={WEEKLY_AGENDA}
        initialNotes={initialReviewNotes}
        previousReviews={previousReviews}
      />

      {overdue.length > 0 && (
        <div className="card mb-4 border-r-4 border-r-amber-400">
          <h3 className="mb-2 text-sm font-bold text-ink">לא הושלמו משבוע שעבר</h3>
          <div className="flex flex-col gap-2">
            {overdue.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm">
                <div>
                  <div className="text-ink">{m.title}</div>
                  <div className="text-[11px] text-muted">
                    {rockBreadcrumb(m.rockId, rocksById)}
                    {m.ownerName ? ` · ${m.ownerName}` : ""}
                    {m.carryOverCount ? ` · הועבר ${m.carryOverCount} פעמים` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCarryOver(m)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg border border-teal bg-teal-bg px-3 py-1.5 text-xs font-bold text-teal-dark hover:opacity-90 disabled:opacity-60"
                >
                  העבר לשבוע הבא
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">אבני דרך לשבוע הנוכחי</h3>
          {localMilestones.length > 0 && (
            <span className="text-[11px] text-muted">
              {doneCount}/{localMilestones.length} בוצעו
            </span>
          )}
        </div>
        {localMilestones.length === 0 ? (
          <div className="text-sm text-muted">עדיין לא נבחרו אבני דרך לשבוע הזה - חוזרים לטאב &quot;חודשי&quot; ומעבירים משם.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {localMilestones.map((m) => (
              <label
                key={m.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  m.done ? "border-emerald-200 bg-emerald-50" : "border-card-border bg-white"
                }`}
              >
                <input type="checkbox" checked={m.done} onChange={() => handleToggleDone(m.id)} className="h-4 w-4 accent-emerald-600" />
                <div className="flex-1">
                  <div className={m.done ? "text-emerald-800 line-through" : "text-ink"}>{m.title}</div>
                  <div className="text-[11px] text-muted">
                    {rockBreadcrumb(m.rockId, rocksById)}
                    {m.ownerName ? ` · ${m.ownerName}` : ""}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
