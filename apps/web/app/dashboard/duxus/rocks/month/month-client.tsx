"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Milestone, Rock, RockReview } from "@ultranet/shared-types";
import { carryOverMilestoneToMonthAction, promoteMilestonesToWeekAction } from "../actions";
import { currentWeekKey, weekLabel } from "../date-utils";
import { buildRocksById, rockBreadcrumb } from "../rock-lookup";
import { useToast } from "@/lib/toast";
import { ReviewPanel } from "../review-panel";

const MONTHLY_AGENDA = [
  "מה נשמע?",
  "בדיקת המשימות של החודש - האם עמדנו",
  "אם לא הגענו - למה לא?",
  "האם צריך לשנות/לעדכן את הסלע?",
  "איך נצליח לעמוד גם בחודש הבא",
  "קביעת אבני דרך לחודש הבא עם הטלת אחריות ברורה",
  "בחירת אבני דרך מתוכן לשבוע הקרוב",
];

function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function MonthClient({
  monthKey,
  monthLabel,
  prevHref,
  nextHref,
  milestones,
  overdue,
  rocks,
  initialReviewNotes,
  previousReviews,
}: {
  monthKey: string;
  monthLabel: string;
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showPromoted, setShowPromoted] = useState(false);

  const rocksById = useMemo(() => buildRocksById(rocks), [rocks]);
  const pending = useMemo(() => milestones.filter((m) => m.stage === "month" && !m.done), [milestones]);
  const alreadyPromoted = useMemo(() => milestones.filter((m) => m.stage === "week" || m.done), [milestones]);

  function toggleSelected(id: string) {
    setSelected((prev) => toggleInSet(prev, id));
  }

  function handlePromote() {
    if (!selected.size) return;
    const weekKey = currentWeekKey();
    startTransition(async () => {
      const result = await promoteMilestonesToWeekAction(Array.from(selected), weekKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(`הועבר ל${weekLabel(weekKey)}`);
      setSelected(new Set());
    });
  }

  function handlePullToCurrentMonth(id: string) {
    startTransition(async () => {
      const result = await carryOverMilestoneToMonthAction(id, monthKey);
      if (!result.ok) showError(result.message);
    });
  }

  return (
    <div>
      {toastNode}
      <div className="mb-4 flex items-center justify-between">
        <Link href={prevHref} className="btn-outline text-xs">
          ‹ הקודם
        </Link>
        <h2 className="text-lg font-bold text-ink">{monthLabel}</h2>
        <Link href={nextHref} className="btn-outline text-xs">
          הבא ›
        </Link>
      </div>

      <ReviewPanel
        period="monthly"
        periodKey={monthKey}
        title="פגישה חודשית"
        agenda={MONTHLY_AGENDA}
        initialNotes={initialReviewNotes}
        previousReviews={previousReviews}
      />

      {overdue.length > 0 && (
        <div className="card mb-4 border-r-4 border-r-amber-400">
          <h3 className="mb-2 text-sm font-bold text-ink">לא הושלמו מחודשים קודמים</h3>
          <div className="flex flex-col gap-2">
            {overdue.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm">
                <div>
                  <div className="text-ink">{m.title}</div>
                  <div className="text-[11px] text-muted">
                    {rockBreadcrumb(m.rockId, rocksById)} · {m.monthKey}
                    {m.ownerName ? ` · ${m.ownerName}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handlePullToCurrentMonth(m.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg border border-teal bg-teal-bg px-3 py-1.5 text-xs font-bold text-teal-dark hover:opacity-90 disabled:opacity-60"
                >
                  העבר לחודש הנוכחי
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card mb-4">
        <h3 className="mb-2 text-sm font-bold text-ink">אבני דרך לחודש הנוכחי</h3>
        {pending.length === 0 ? (
          <div className="text-sm text-muted">
            עדיין לא נבחרו אבני דרך לחודש הזה - חוזרים לטאב &quot;רבעון&quot; ומעבירים משם.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pending.map((m) => (
              <label key={m.id} className="flex items-center gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm">
                <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelected(m.id)} className="h-4 w-4 accent-teal" />
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
      </div>

      {alreadyPromoted.length > 0 && (
        <div className="card mb-4">
          <button type="button" onClick={() => setShowPromoted((v) => !v)} className="flex w-full items-center justify-between text-right">
            <span className="text-sm font-bold text-ink">כבר בטיפול השבועי / הושלמו ({alreadyPromoted.length})</span>
            {showPromoted ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
          </button>
          {showPromoted && (
            <div className="mt-2 flex flex-col gap-2">
              {alreadyPromoted.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm">
                  <span className={m.done ? "text-muted line-through" : "text-ink"}>{m.title}</span>
                  {m.done ? (
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      בוצע
                    </span>
                  ) : (
                    <span className="rounded-full border border-purple bg-[#f4ecf8] px-2 py-0.5 text-[11px] font-bold text-purple">בשבועי</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-[11px] border border-teal bg-white px-4 py-3 shadow-lg">
          <span className="text-sm font-bold text-ink">{selected.size} אבני דרך נבחרו</span>
          <button
            type="button"
            onClick={handlePromote}
            disabled={isPending}
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
          >
            העברה ל{weekLabel(currentWeekKey())}
          </button>
        </div>
      )}
    </div>
  );
}
