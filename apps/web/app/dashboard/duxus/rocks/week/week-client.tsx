"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Milestone, Rock, RockReview } from "@ultranet/shared-types";
import { carryOverMilestoneToWeekAction, promoteMilestonesToWeekAction, toggleMilestoneDoneAction } from "../actions";
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

function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function WeekClient({
  weekKey,
  weekLabel,
  prevHref,
  nextHref,
  milestones,
  overdue,
  monthPool,
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
  monthPool: Milestone[];
  rocks: Rock[];
  initialReviewNotes: string;
  previousReviews: RockReview[];
}) {
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [localMilestones, setLocalMilestones] = useState(milestones);
  const [localMonthPool, setLocalMonthPool] = useState(monthPool);
  const [selectedFromMonth, setSelectedFromMonth] = useState<Set<string>>(new Set());
  useEffect(() => setLocalMilestones(milestones), [milestones]);
  useEffect(() => setLocalMonthPool(monthPool), [monthPool]);

  const rocksById = useMemo(() => buildRocksById(rocks), [rocks]);

  function toggleSelectedFromMonth(id: string) {
    setSelectedFromMonth((prev) => toggleInSet(prev, id));
  }

  function handlePullFromMonth() {
    if (!selectedFromMonth.size) return;
    const ids = Array.from(selectedFromMonth);
    const pulled = localMonthPool.filter((m) => ids.includes(m.id));
    setLocalMonthPool((prev) => prev.filter((m) => !ids.includes(m.id)));
    setLocalMilestones((prev) => [...prev, ...pulled.map((m) => ({ ...m, stage: "week" as const, weekKey }))]);
    startTransition(async () => {
      const result = await promoteMilestonesToWeekAction(ids, weekKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(`נוספו ${ids.length} אבני דרך לשבוע`);
      setSelectedFromMonth(new Set());
    });
  }

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

      <div className="card mb-4">
        <h3 className="mb-2 text-sm font-bold text-ink">בחירה מתוך החודש</h3>
        {localMonthPool.length === 0 ? (
          <div className="text-sm text-muted">אין עוד אבני דרך פנויות בחודש (או שכולן כבר קודמו).</div>
        ) : (
          <div className="flex flex-col gap-2">
            {localMonthPool.map((m) => (
              <label key={m.id} className="flex items-center gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedFromMonth.has(m.id)}
                  onChange={() => toggleSelectedFromMonth(m.id)}
                  className="h-4 w-4 accent-teal"
                />
                <div className="flex-1">
                  <div className="text-ink">{m.title}</div>
                  <div className="text-[11px] text-muted">
                    {rockBreadcrumb(m.rockId, rocksById)}
                    {m.ownerName ? ` · ${m.ownerName}` : ""}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
        {selectedFromMonth.size > 0 && (
          <button
            type="button"
            onClick={handlePullFromMonth}
            disabled={isPending}
            className="mt-3 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
          >
            הוספת {selectedFromMonth.size} אבני דרך לשבוע הנוכחי
          </button>
        )}
      </div>

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
          <div className="text-sm text-muted">עדיין לא נבחרו אבני דרך לשבוע הזה - בחרו מהרשימה למעלה.</div>
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
