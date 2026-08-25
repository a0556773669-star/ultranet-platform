"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { Milestone, Rock, RockReview } from "@ultranet/shared-types";
import { carryOverMilestoneToWeekAction, createMilestoneAction, promoteMilestonesToWeekAction, toggleMilestoneDoneAction } from "../actions";
import { shiftWeekKey, weekLabel as weekLabelOf } from "../date-utils";
import { buildRocksById, rockBreadcrumb } from "../rock-lookup";
import { useToast } from "@/lib/toast";
import { ReviewPanel } from "../review-panel";
import { RockMilestoneTree, groupRocksByParent, groupMilestonesByRock, splitRockAndAdhoc, toggleInSet } from "../rock-tree";
import { AddMilestoneForm } from "../add-forms";
import { AdhocPanel } from "../adhoc-panel";

const WEEKLY_AGENDA = [
  "מה נשמע?",
  "אבני הדרך של השבוע - הצלחנו?",
  "הפקת לקחים",
  "קביעת אבני דרך לשבוע הבא עם הטלת אחריות ברורה",
];

export function WeekClient({
  weekKey,
  monthKey,
  quarterKey,
  quarterTitle,
  weekLabel,
  prevHref,
  nextHref,
  quarterMilestones,
  overdue,
  rocks,
  initialReviewNotes,
  previousReviews,
  readOnly = false,
}: {
  weekKey: string;
  monthKey: string;
  quarterKey: string;
  /** שם הרבעון שממנו נשלפים הסלעים - מוצג כדי שברור על איזה רבעון עובדים */
  quarterTitle: string;
  weekLabel: string;
  prevHref: string;
  nextHref: string;
  quarterMilestones: Milestone[];
  overdue: Milestone[];
  rocks: Rock[];
  initialReviewNotes: string;
  previousReviews: RockReview[];
  /** הרבעון שאליו שייך השבוע נמצא בארכיון - תצוגה בלבד */
  readOnly?: boolean;
}) {
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedFromMonth, setSelectedFromMonth] = useState<Set<string>>(new Set());
  const [openMilestoneForm, setOpenMilestoneForm] = useState<Set<string>>(new Set());

  const [localMilestones, setLocalMilestones] = useState(quarterMilestones);
  useEffect(() => setLocalMilestones(quarterMilestones), [quarterMilestones]);

  const rocksById = useMemo(() => buildRocksById(rocks), [rocks]);
  const quarterRocks = useMemo(() => rocks.filter((r) => r.quarterKey === quarterKey), [rocks, quarterKey]);
  const { topRocks, subRocksByParent } = useMemo(() => groupRocksByParent(quarterRocks), [quarterRocks]);
  const milestonesByRock = useMemo(() => groupMilestonesByRock(localMilestones), [localMilestones]);
  // משימות שוטפות של השבוע הנוכחי - לא שייכות לאף סלע ולכן מוצגות בקטע נפרד.
  const weekAdhocTasks = useMemo(
    () => splitRockAndAdhoc(localMilestones).adhocTasks.filter((m) => m.stage === "week" && m.weekKey === weekKey),
    [localMilestones, weekKey]
  );

  function toggleFromMonth(id: string) {
    setSelectedFromMonth((prev) => toggleInSet(prev, id));
  }

  function handlePullFromMonth() {
    if (!selectedFromMonth.size) return;
    const ids = Array.from(selectedFromMonth);
    setLocalMilestones((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, stage: "week" as const, weekKey } : m)));
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

  function renderMilestone(m: Milestone) {
    if (m.stage === "month" && m.monthKey === monthKey && !m.done && !readOnly) {
      return (
        <label key={m.id} className="flex items-center gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={selectedFromMonth.has(m.id)}
            onChange={() => toggleFromMonth(m.id)}
            className="h-4 w-4 accent-teal"
          />
          <span className="flex-1 text-ink">{m.title}</span>
          {m.ownerName ? <span className="text-[11px] text-muted">{m.ownerName}</span> : null}
          <span className="rounded-full border border-teal bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">בחודשי</span>
        </label>
      );
    }
    if (m.stage === "week" && m.weekKey === weekKey) {
      return (
        <label
          key={m.id}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            m.done ? "border-emerald-200 bg-emerald-50" : "border-card-border bg-white"
          }`}
        >
          <input
            type="checkbox"
            checked={m.done}
            disabled={readOnly}
            onChange={() => handleToggleDone(m.id)}
            className="h-4 w-4 accent-emerald-600"
          />
          <span className={`flex-1 ${m.done ? "text-emerald-800 line-through" : "text-ink"}`}>{m.title}</span>
          {m.ownerName ? <span className="text-[11px] text-muted">{m.ownerName}</span> : null}
        </label>
      );
    }
    return (
      <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm">
        <span className={m.done ? "text-muted line-through" : "text-ink"}>{m.title}</span>
        {m.ownerName ? <span className="text-[11px] text-muted">{m.ownerName}</span> : null}
        {m.done ? (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">בוצע</span>
        ) : m.stage === "week" ? (
          <span className="rounded-full border border-purple bg-[#f4ecf8] px-2 py-0.5 text-[11px] font-bold text-purple">בשבוע אחר</span>
        ) : m.stage === "month" ? (
          <span className="rounded-full border border-teal bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">בחודש אחר</span>
        ) : (
          <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[11px] font-bold text-muted">ברבעון</span>
        )}
      </div>
    );
  }

  function renderRockFooter(rock: Rock) {
    if (readOnly) return null;
    return (
      <>
        <button
          type="button"
          onClick={() => setOpenMilestoneForm((prev) => toggleInSet(prev, rock.id))}
          className="flex w-fit items-center gap-1 pt-1 text-xs font-semibold text-teal hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          אבן דרך לשבוע הזה
        </button>
        {openMilestoneForm.has(rock.id) && (
          <AddMilestoneForm
            onSubmit={(title, ownerName) => {
              const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
              setLocalMilestones((prev) => [
                ...prev,
                {
                  id: tempId,
                  rockId: rock.id,
                  quarterKey,
                  title,
                  ownerUserId: "",
                  ownerName,
                  stage: "week",
                  monthKey,
                  weekKey,
                  done: false,
                  carryOverCount: 0,
                  order: Date.now(),
                  createdAt: Date.now(),
                },
              ]);
              setOpenMilestoneForm((prev) => toggleInSet(prev, rock.id));
              startTransition(async () => {
                const result = await createMilestoneAction({
                  rockId: rock.id,
                  quarterKey,
                  title,
                  ownerName,
                  stage: "week",
                  monthKey,
                  weekKey,
                });
                if (!result.ok) showError(result.message);
              });
            }}
            onCancel={() => setOpenMilestoneForm((prev) => toggleInSet(prev, rock.id))}
          />
        )}
      </>
    );
  }

  return (
    <div>
      {toastNode}
      <div className="mb-4 flex items-center justify-between">
        <Link href={prevHref} className="btn-outline text-xs">
          ‹ הקודם
        </Link>
        <div className="text-center">
          <h2 className="text-lg font-bold text-ink">{weekLabel}</h2>
          <div className="text-[11px] text-muted">{quarterTitle}</div>
        </div>
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
        readOnly={readOnly}
      />

      <AdhocPanel
        tasks={weekAdhocTasks}
        quarterKey={quarterKey}
        monthKey={monthKey}
        weekKey={weekKey}
        stage="week"
        readOnly={readOnly}
        title="משימות שבועיות ושוטפות"
        addLabel="הוסף משימה שבועית/שוטפת"
        emptyMessage="אין משימות שוטפות לשבוע הזה. אלה משימות שלא נגזרות מסלע - מה שעלה בפגישה או פשוט צריך להיעשות."
      />

      {overdue.length > 0 && !readOnly && (
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

      <RockMilestoneTree
        topRocks={topRocks}
        subRocksByParent={subRocksByParent}
        milestonesByRock={milestonesByRock}
        renderMilestone={renderMilestone}
        renderRockFooter={renderRockFooter}
        emptyMessage={'עדיין אין סלעים לרבעון הזה - חוזרים לטאב "רבעון" ומתחילים שם.'}
      />

      {selectedFromMonth.size > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-[11px] border border-teal bg-white px-4 py-3 shadow-lg">
          <span className="text-sm font-bold text-ink">{selectedFromMonth.size} נבחרו מהחודש</span>
          <button
            type="button"
            onClick={handlePullFromMonth}
            disabled={isPending}
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
          >
            הוספה לשבוע הנוכחי
          </button>
        </div>
      )}
    </div>
  );
}
