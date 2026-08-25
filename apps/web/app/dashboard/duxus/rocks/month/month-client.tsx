"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { Milestone, Rock, RockReview } from "@ultranet/shared-types";
import {
  carryOverMilestoneToMonthAction,
  createMilestoneAction,
  promoteMilestonesToMonthAction,
  promoteMilestonesToWeekAction,
} from "../actions";
import { currentWeekKey, weekLabel } from "../date-utils";
import { buildRocksById, rockBreadcrumb } from "../rock-lookup";
import { useToast } from "@/lib/toast";
import { ReviewPanel } from "../review-panel";
import { RockMilestoneTree, groupRocksByParent, groupMilestonesByRock, splitRockAndAdhoc, toggleInSet } from "../rock-tree";
import { AddMilestoneForm } from "../add-forms";
import { AdhocPanel } from "../adhoc-panel";

const MONTHLY_AGENDA = [
  "מה נשמע?",
  "בדיקת המשימות של החודש - האם עמדנו",
  "אם לא הגענו - למה לא?",
  "האם צריך לשנות/לעדכן את הסלע?",
  "איך נצליח לעמוד גם בחודש הבא",
  "קביעת אבני דרך לחודש הבא עם הטלת אחריות ברורה",
  "בחירת אבני דרך מתוכן לשבוע הקרוב",
];

export function MonthClient({
  monthKey,
  quarterKey,
  quarterTitle,
  monthLabel,
  prevHref,
  nextHref,
  quarterMilestones,
  overdue,
  rocks,
  initialReviewNotes,
  previousReviews,
  readOnly = false,
}: {
  monthKey: string;
  quarterKey: string;
  /** שם הרבעון שממנו נשלפים הסלעים - מוצג כדי שברור על איזה רבעון עובדים */
  quarterTitle: string;
  monthLabel: string;
  prevHref: string;
  nextHref: string;
  quarterMilestones: Milestone[];
  overdue: Milestone[];
  rocks: Rock[];
  initialReviewNotes: string;
  previousReviews: RockReview[];
  /** הרבעון שאליו שייך החודש נמצא בארכיון - תצוגה בלבד */
  readOnly?: boolean;
}) {
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selectedFromQuarter, setSelectedFromQuarter] = useState<Set<string>>(new Set());
  const [selectedForWeek, setSelectedForWeek] = useState<Set<string>>(new Set());
  const [openMilestoneForm, setOpenMilestoneForm] = useState<Set<string>>(new Set());

  const [localMilestones, setLocalMilestones] = useState(quarterMilestones);
  useEffect(() => setLocalMilestones(quarterMilestones), [quarterMilestones]);

  const rocksById = useMemo(() => buildRocksById(rocks), [rocks]);
  const quarterRocks = useMemo(() => rocks.filter((r) => r.quarterKey === quarterKey), [rocks, quarterKey]);
  const { topRocks, subRocksByParent } = useMemo(() => groupRocksByParent(quarterRocks), [quarterRocks]);
  const milestonesByRock = useMemo(() => groupMilestonesByRock(localMilestones), [localMilestones]);
  // משימות שוטפות של החודש הנוכחי - לא שייכות לאף סלע ולכן מוצגות בקטע נפרד.
  const monthAdhocTasks = useMemo(
    () => splitRockAndAdhoc(localMilestones).adhocTasks.filter((m) => m.stage === "month" && m.monthKey === monthKey),
    [localMilestones, monthKey]
  );

  function toggleFromQuarter(id: string) {
    setSelectedFromQuarter((prev) => toggleInSet(prev, id));
  }

  function toggleForWeek(id: string) {
    setSelectedForWeek((prev) => toggleInSet(prev, id));
  }

  function handlePullFromQuarter() {
    if (!selectedFromQuarter.size) return;
    const ids = Array.from(selectedFromQuarter);
    setLocalMilestones((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, stage: "month" as const, monthKey } : m)));
    startTransition(async () => {
      const result = await promoteMilestonesToMonthAction(ids, monthKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(`נוספו ${ids.length} אבני דרך לחודש`);
      setSelectedFromQuarter(new Set());
    });
  }

  function handlePromoteToWeek() {
    if (!selectedForWeek.size) return;
    const weekKey = currentWeekKey();
    const ids = Array.from(selectedForWeek);
    setLocalMilestones((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, stage: "week" as const, weekKey } : m)));
    startTransition(async () => {
      const result = await promoteMilestonesToWeekAction(ids, weekKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(`הועבר ל${weekLabel(weekKey)}`);
      setSelectedForWeek(new Set());
    });
  }

  function handlePullToCurrentMonth(id: string) {
    startTransition(async () => {
      const result = await carryOverMilestoneToMonthAction(id, monthKey);
      if (!result.ok) showError(result.message);
    });
  }

  function renderMilestone(m: Milestone) {
    if (m.stage === "backlog" && !readOnly) {
      return (
        <label key={m.id} className="flex items-center gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={selectedFromQuarter.has(m.id)}
            onChange={() => toggleFromQuarter(m.id)}
            className="h-4 w-4 accent-teal"
          />
          <span className="flex-1 text-ink">{m.title}</span>
          {m.ownerName ? <span className="text-[11px] text-muted">{m.ownerName}</span> : null}
          <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[11px] font-bold text-muted">ברבעון</span>
        </label>
      );
    }
    if (m.stage === "month" && m.monthKey === monthKey && !m.done && !readOnly) {
      return (
        <label key={m.id} className="flex items-center gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm">
          <input type="checkbox" checked={selectedForWeek.has(m.id)} onChange={() => toggleForWeek(m.id)} className="h-4 w-4 accent-teal" />
          <span className="flex-1 text-ink">{m.title}</span>
          {m.ownerName ? <span className="text-[11px] text-muted">{m.ownerName}</span> : null}
          <span className="rounded-full border border-teal bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">בחודש הנוכחי</span>
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
          <span className="rounded-full border border-purple bg-[#f4ecf8] px-2 py-0.5 text-[11px] font-bold text-purple">בשבועי</span>
        ) : (
          <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[11px] font-bold text-muted">{m.monthKey}</span>
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
          אבן דרך לחודש הזה
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
                  stage: "month",
                  monthKey,
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
                  stage: "month",
                  monthKey,
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
          <h2 className="text-lg font-bold text-ink">{monthLabel}</h2>
          <div className="text-[11px] text-muted">{quarterTitle}</div>
        </div>
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
        readOnly={readOnly}
      />

      <AdhocPanel
        tasks={monthAdhocTasks}
        quarterKey={quarterKey}
        monthKey={monthKey}
        stage="month"
        readOnly={readOnly}
        title="משימות שוטפות של החודש"
        addLabel="הוסף משימה שוטפת"
        emptyMessage="אין משימות שוטפות לחודש הזה."
      />

      {overdue.length > 0 && !readOnly && (
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

      <RockMilestoneTree
        topRocks={topRocks}
        subRocksByParent={subRocksByParent}
        milestonesByRock={milestonesByRock}
        renderMilestone={renderMilestone}
        renderRockFooter={renderRockFooter}
        emptyMessage={'עדיין אין סלעים לרבעון הזה - חוזרים לטאב "רבעון" ומתחילים שם.'}
      />

      {(selectedFromQuarter.size > 0 || selectedForWeek.size > 0) && (
        <div className="sticky bottom-4 mt-4 flex flex-col gap-2">
          {selectedFromQuarter.size > 0 && (
            <div className="flex items-center justify-between rounded-[11px] border border-teal bg-white px-4 py-3 shadow-lg">
              <span className="text-sm font-bold text-ink">{selectedFromQuarter.size} נבחרו מהרבעון</span>
              <button
                type="button"
                onClick={handlePullFromQuarter}
                disabled={isPending}
                className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
              >
                הוספה לחודש הנוכחי
              </button>
            </div>
          )}
          {selectedForWeek.size > 0 && (
            <div className="flex items-center justify-between rounded-[11px] border border-teal bg-white px-4 py-3 shadow-lg">
              <span className="text-sm font-bold text-ink">{selectedForWeek.size} אבני דרך נבחרו</span>
              <button
                type="button"
                onClick={handlePromoteToWeek}
                disabled={isPending}
                className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
              >
                העברה ל{weekLabel(currentWeekKey())}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
