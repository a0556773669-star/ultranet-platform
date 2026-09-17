"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Plus, Users, ChevronLeft, ChevronRight } from "lucide-react";
import type { Milestone, Quarter, RockReview } from "@ultranet/shared-types";
import type { QuarterBoard } from "../actions";
import { useBoard } from "../use-board";
import { MilestoneRow } from "../milestone-row";
import { MilestonePanel } from "../milestone-panel";
import { MeetingPicker } from "../meeting-picker";
import { AddMilestoneForm } from "../add-forms";
import { ReviewPanel } from "../review-panel";
import { QuarterBar } from "../quarter-bar";
import { PeriodSummary } from "../period-summary";
import { isOpenMilestone } from "../task-status";
import { monthLabel } from "../date-utils";

const MONTHLY_AGENDA = [
  "סקירת החודש שחלף: מה הושלם, מה לא ומה חסום",
  "מה שלא הושלם - האם מתחייבים אליו שוב החודש?",
  "בחירת אבני הדרך של החודש מתוך כל מה שפתוח ברבעון",
  "האם צריך להוסיף סלע, תת-סלע או אבן דרך חדשים?",
  "קביעת אחראי ותאריך יעד לכל אבן דרך שנבחרה",
];

/**
 * מסך החודש (סעיף 7.3). אבני הדרך מקובצות לפי סלע ותת-סלע, ואבן דרך שכבר נמשכה
 * לשבוע ממשיכה להופיע כאן עם התג "בשבוע" - כי היא **אותה רשומה**, לא עותק.
 */
export function MonthClient({
  board: boardData,
  quarters,
  today,
  weekWarning,
  reviewNotes,
  previousReviews,
}: {
  board: QuarterBoard;
  quarters: Quarter[];
  today: string;
  weekWarning: boolean;
  reviewNotes: string;
  previousReviews: RockReview[];
}) {
  const board = useBoard(boardData, today, weekWarning);
  const [viewMonthKey, setViewMonthKey] = useState(board.activeMonthKey);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const isCurrentMonth = viewMonthKey === board.activeMonthKey;

  const monthKeys = useMemo(() => {
    const keys = new Set(board.assignments.filter((a) => a.periodType === "month").map((a) => a.periodKey));
    if (board.activeMonthKey) keys.add(board.activeMonthKey);
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [board.assignments, board.activeMonthKey]);

  const viewIds = useMemo(() => board.inPeriod("month", viewMonthKey), [board, viewMonthKey]);
  const tasks = useMemo(() => board.milestones.filter((m) => viewIds.has(m.id)), [board.milestones, viewIds]);
  const openTasks = tasks.filter((m) => m.status !== "done");
  const doneTasks = tasks.filter((m) => m.status === "done");

  /** מועמדות לחודש: כל אבני הדרך הפתוחות של הרבעון שעדיין לא נבחרו אליו. */
  const quarterCandidates = useMemo(
    () => board.milestones.filter((m) => isOpenMilestone(m)),
    [board.milestones]
  );

  const carryCandidates = useMemo(() => {
    if (!isCurrentMonth) return [];
    const earlier = board.assignments.filter(
      (a) => a.periodType === "month" && a.periodKey < board.activeMonthKey
    );
    const ids = new Set(earlier.map((a) => a.milestoneId));
    return board.milestones.filter((m) => ids.has(m.id) && isOpenMilestone(m) && !viewIds.has(m.id));
  }, [board.assignments, board.milestones, board.activeMonthKey, isCurrentMonth, viewIds]);

  const groups = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    openTasks.forEach((m) => map.set(m.rockId, [...(map.get(m.rockId) ?? []), m]));
    return Array.from(map.entries()).map(([rockId, list]) => ({ rockId, label: board.breadcrumb(rockId), list }));
  }, [openTasks, board]);

  const readOnly = board.readOnly || !isCurrentMonth;

  function row(m: Milestone) {
    return (
      <MilestoneRow
        key={m.id}
        milestone={m}
        toneContext={board.toneContext(m)}
        onOpen={(x) => board.setOpenMilestoneId(x.id)}
        onStatus={readOnly ? undefined : board.setStatus}
        onComplete={readOnly ? undefined : board.complete}
        onReopen={board.reopen}
        readOnly={readOnly}
        extraBadges={
          board.weekIds.has(m.id) ? (
            <span className="rounded-full border border-purple/40 bg-[#f4ecf8] px-2 py-0.5 text-[11px] font-bold text-purple">בשבוע</span>
          ) : null
        }
      />
    );
  }

  return (
    <div>
      {board.toastNode}
      {board.deleteDialogNode}
      <QuarterBar quarter={boardData.quarter} quarters={quarters} />

      <section className="card mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="חודש קודם"
              onClick={() => {
                const i = monthKeys.indexOf(viewMonthKey);
                const prev = i >= 0 ? monthKeys[i + 1] : undefined;
                if (prev) setViewMonthKey(prev);
              }}
              className="rounded-lg border border-card-border p-1 text-muted hover:bg-[#f4f6f9]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <h2 className="text-base font-extrabold text-ink">{viewMonthKey ? monthLabel(viewMonthKey) : "עוד לא נפתח חודש"}</h2>
            <button
              type="button"
              aria-label="חודש הבא"
              onClick={() => {
                const i = monthKeys.indexOf(viewMonthKey);
                const next = i > 0 ? monthKeys[i - 1] : undefined;
                if (next) setViewMonthKey(next);
              }}
              className="rounded-lg border border-card-border p-1 text-muted hover:bg-[#f4f6f9]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {!isCurrentMonth && (
              <button type="button" onClick={() => setViewMonthKey(board.activeMonthKey)} className="text-xs font-semibold text-teal hover:underline">
                חזרה לחודש הפתוח
              </button>
            )}
          </div>

          {!board.readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMeetingOpen(true)}
                disabled={!board.activeMonthKey}
                className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#f4f6f9] disabled:opacity-50"
              >
                <Users className="h-3.5 w-3.5" />
                ישיבה חודשית
              </button>
              <button
                type="button"
                onClick={board.openNextMonth}
                className="flex items-center gap-1 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                {board.activeMonthKey ? "פתיחת חודש חדש" : "פתיחת החודש הראשון"}
              </button>
            </div>
          )}
        </div>

        {!viewMonthKey ? (
          <div className="rounded-lg border border-dashed border-card-border p-4 text-sm text-muted">
            עוד לא נפתח חודש ברבעון הזה. פתיחת החודש הראשון תאפשר לבחור אליו אבני דרך מתוך הרבעון.
          </div>
        ) : (
          <>
            <PeriodSummary milestones={tasks} today={today} label="נבחרו לחודש" />

            {carryCandidates.length > 0 && (
              <div className="mb-3 rounded-[11px] border border-amber-300 bg-amber-50/60 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-800">לא הושלם מחודש קודם ({carryCandidates.length})</span>
                  <button
                    type="button"
                    onClick={() => board.assign(carryCandidates.map((m) => m.id), "month", board.activeMonthKey)}
                    className="text-xs font-semibold text-amber-800 hover:underline"
                  >
                    התחייבות מחודשת לכל מה שמוצג
                  </button>
                </div>
                <div className="flex flex-col gap-1.5">
                  {carryCandidates.map((m) => (
                    <MilestoneRow
                      key={m.id}
                      milestone={m}
                      toneContext={board.toneContext(m)}
                      breadcrumb={board.breadcrumb(m.rockId)}
                      onOpen={(x) => board.setOpenMilestoneId(x.id)}
                      readOnly
                      dense
                      extraBadges={
                        <button
                          type="button"
                          onClick={() => board.assign([m.id], "month", board.activeMonthKey)}
                          className="rounded-full border border-amber-400 bg-white px-2 py-0.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50"
                        >
                          לחודש הזה
                        </button>
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {groups.length === 0 && doneTasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-card-border p-4 text-sm text-muted">
                עוד לא נבחרו אבני דרך לחודש. פתחו את הישיבה החודשית ובחרו מתוך אבני הדרך הפתוחות של הרבעון.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((g) => (
                  <div key={g.rockId || "adhoc"}>
                    <div className="mb-1.5 text-[11px] font-bold text-muted">{g.label}</div>
                    <div className="flex flex-col gap-1.5">{g.list.map(row)}</div>
                  </div>
                ))}
              </div>
            )}

            {doneTasks.length > 0 && (
              <details className="mt-3 rounded-lg border border-card-border bg-[#f9fafb] p-3">
                <summary className="cursor-pointer text-xs font-bold text-emerald-700">הושלמו החודש ({doneTasks.length})</summary>
                <div className="mt-2 flex flex-col gap-1.5">{doneTasks.map(row)}</div>
              </details>
            )}

            {!readOnly && (
              <div className="mt-3">
                {addOpen ? (
                  <AddMilestoneForm
                    placeholder="משימה שוטפת לחודש"
                    onSubmit={(input) => {
                      setAddOpen(false);
                      board.createMilestone({
                        rockId: "",
                        source: "adhoc",
                        origin: "month",
                        ...input,
                        assignTo: [{ periodType: "month", periodKey: board.activeMonthKey }],
                      });
                    }}
                    onCancel={() => setAddOpen(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddOpen(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    הוספת משימה שוטפת לחודש
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {board.activeMonthKey && (
        <ReviewPanel
          period="monthly"
          periodKey={board.activeMonthKey}
          title="סיכום ישיבה חודשית"
          agenda={MONTHLY_AGENDA}
          initialNotes={reviewNotes}
          previousReviews={previousReviews}
          readOnly={board.readOnly}
        />
      )}

      {meetingOpen && (
        <MeetingPicker
          title="ישיבה חודשית - בחירת אבני הדרך של החודש"
          subtitle={`${monthLabel(board.activeMonthKey)} · כל אבני הדרך הפתוחות של הרבעון, בחירה מרובה ואישור אחד`}
          candidates={quarterCandidates}
          rocks={board.rocks}
          alreadyAssigned={board.monthIds}
          toneContext={{ today, weekWarningActive: weekWarning }}
          confirmLabel="הוספה לחודש"
          isPending={board.isPending}
          onConfirm={(ids) => {
            board.assign(ids, "month", board.activeMonthKey);
            setMeetingOpen(false);
          }}
          onClose={() => setMeetingOpen(false)}
        />
      )}

      {board.openMilestone && (
        <MilestonePanel
          milestone={board.openMilestone}
          rocks={board.rocks}
          assignments={board.assignments}
          toneContext={board.toneContext(board.openMilestone)}
          readOnly={board.readOnly}
          onClose={() => board.setOpenMilestoneId(null)}
          onSave={board.saveMilestone}
          onStatus={board.setStatus}
          onReopen={board.reopen}
          onDelete={board.removeMilestone}
        />
      )}
    </div>
  );
}
