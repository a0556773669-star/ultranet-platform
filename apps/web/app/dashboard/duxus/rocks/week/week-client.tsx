"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, Plus, Users, ChevronLeft, ChevronRight } from "lucide-react";
import type { Milestone, PeriodType, Quarter, RockReview } from "@ultranet/shared-types";
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
import { weekKeyIndex, weekLabel } from "../date-utils";

const WEEKLY_AGENDA = [
  "סקירת השבוע שחלף: מה הושלם, מה לא הושלם ומה חסום",
  "מה שלא הושלם - האם מתחייבים אליו שוב לשבוע הבא?",
  "בחירת משימות נוספות מתוך אבני הדרך הפתוחות של החודש",
  "האם צריך להוסיף אבן דרך חדשה?",
  "סיכום והפעלת השבוע החדש",
];

/**
 * מסך השבוע (סעיף 7.5) - מה עושים עכשיו.
 *
 * כל הפעולות זמינות מהשורה בלי לפתוח חלון: סטטוס, סימון בוצע, אחראי והערה.
 * בראש הרשימה מוצג "לא הושלם משבוע קודם", ומה שהושלם יורד לקבוצה מכווצת בתחתית.
 */
export function WeekClient({
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
  const [viewWeekKey, setViewWeekKey] = useState(board.activeWeekKey);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const isCurrentWeek = viewWeekKey === board.activeWeekKey;

  /** כל השבועות שיש להם התחייבות ברבעון, מהחדש לישן - לדפדוף בין שבועות. */
  const weekKeys = useMemo(() => {
    const keys = new Set(board.assignments.filter((a) => a.periodType === "week").map((a) => a.periodKey));
    if (board.activeWeekKey) keys.add(board.activeWeekKey);
    return Array.from(keys).sort((a, b) => weekKeyIndex(b) - weekKeyIndex(a));
  }, [board.assignments, board.activeWeekKey]);

  const viewIds = useMemo(() => board.inPeriod("week", viewWeekKey), [board, viewWeekKey]);
  const tasks = useMemo(() => board.milestones.filter((m) => viewIds.has(m.id)), [board.milestones, viewIds]);
  const openTasks = tasks.filter((m) => m.status !== "done");
  const doneTasks = tasks.filter((m) => m.status === "done");

  /**
   * "לא הושלם משבוע קודם" - המשימה נשארת מתועדת בשבוע הישן (התוצאה שלה שם ננעלה)
   * ומוצעת כאן להתחייבות מחודשת לשבוע הפתוח (סעיף 8, קריטריון קבלה 3).
   */
  const carryCandidates = useMemo(() => {
    if (!isCurrentWeek) return [];
    const earlier = board.assignments.filter(
      (a) => a.periodType === "week" && a.periodKey !== board.activeWeekKey && weekKeyIndex(a.periodKey) < weekKeyIndex(board.activeWeekKey)
    );
    const ids = new Set(earlier.map((a) => a.milestoneId));
    return board.milestones.filter((m) => ids.has(m.id) && isOpenMilestone(m) && !viewIds.has(m.id));
  }, [board.assignments, board.milestones, board.activeWeekKey, isCurrentWeek, viewIds]);

  /** מועמדות לשבוע: אבני הדרך הפתוחות של החודש הפתוח שעדיין לא נבחרו לשבוע. */
  const weekCandidates = useMemo(
    () => board.milestones.filter((m) => board.monthIds.has(m.id) && isOpenMilestone(m)),
    [board.milestones, board.monthIds]
  );

  const groups = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    openTasks.forEach((m) => map.set(m.rockId, [...(map.get(m.rockId) ?? []), m]));
    return Array.from(map.entries()).map(([rockId, list]) => ({ rockId, label: board.breadcrumb(rockId), list }));
  }, [openTasks, board]);

  const readOnly = board.readOnly || !isCurrentWeek;

  function row(m: Milestone) {
    return (
      <MilestoneRow
        key={m.id}
        milestone={m}
        toneContext={board.toneContext(m)}
        selectable={false}
        onOpen={(x) => board.setOpenMilestoneId(x.id)}
        onStatus={readOnly ? undefined : board.setStatus}
        onComplete={readOnly ? undefined : board.complete}
        onReopen={board.reopen}
        readOnly={readOnly}
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
              aria-label="שבוע קודם"
              onClick={() => {
                const i = weekKeys.indexOf(viewWeekKey);
                const prev = i >= 0 ? weekKeys[i + 1] : undefined;
                if (prev) setViewWeekKey(prev);
              }}
              className="rounded-lg border border-card-border p-1 text-muted hover:bg-[#f4f6f9]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <h2 className="text-base font-extrabold text-ink">{viewWeekKey ? weekLabel(viewWeekKey) : "עוד לא נפתח שבוע"}</h2>
            <button
              type="button"
              aria-label="שבוע הבא"
              onClick={() => {
                const i = weekKeys.indexOf(viewWeekKey);
                const next = i > 0 ? weekKeys[i - 1] : undefined;
                if (next) setViewWeekKey(next);
              }}
              className="rounded-lg border border-card-border p-1 text-muted hover:bg-[#f4f6f9]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {!isCurrentWeek && (
              <button type="button" onClick={() => setViewWeekKey(board.activeWeekKey)} className="text-xs font-semibold text-teal hover:underline">
                חזרה לשבוע הפתוח
              </button>
            )}
          </div>

          {!board.readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setMeetingOpen(true)}
                disabled={!board.activeWeekKey}
                className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#f4f6f9] disabled:opacity-50"
              >
                <Users className="h-3.5 w-3.5" />
                ישיבה שבועית
              </button>
              <button
                type="button"
                onClick={board.openNextWeek}
                className="flex items-center gap-1 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                {board.activeWeekKey ? "פתיחת שבוע חדש" : "פתיחת השבוע הראשון"}
              </button>
            </div>
          )}
        </div>

        {!viewWeekKey ? (
          <div className="rounded-lg border border-dashed border-card-border p-4 text-sm text-muted">
            עוד לא נפתח שבוע ברבעון הזה. פתיחת השבוע הראשון תאפשר לבחור אליו אבני דרך מתוך החודש.
          </div>
        ) : (
          <>
            <PeriodSummary milestones={tasks} today={today} label="נבחרו לשבוע" />

            {carryCandidates.length > 0 && (
              <div className="mb-3 rounded-[11px] border border-amber-300 bg-amber-50/60 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-amber-800">לא הושלם משבוע קודם ({carryCandidates.length})</span>
                  <button
                    type="button"
                    onClick={() => board.assign(carryCandidates.map((m) => m.id), "week", board.activeWeekKey)}
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
                          onClick={() => board.assign([m.id], "week", board.activeWeekKey)}
                          className="rounded-full border border-amber-400 bg-white px-2 py-0.5 text-[11px] font-bold text-amber-700 hover:bg-amber-50"
                        >
                          לשבוע הזה
                        </button>
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {groups.length === 0 && doneTasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-card-border p-4 text-sm text-muted">
                עוד לא נבחרו משימות לשבוע. פתחו את הישיבה השבועית ובחרו מתוך אבני הדרך של החודש.
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
                <summary className="cursor-pointer text-xs font-bold text-emerald-700">הושלמו השבוע ({doneTasks.length})</summary>
                <div className="mt-2 flex flex-col gap-1.5">{doneTasks.map(row)}</div>
              </details>
            )}

            {!readOnly && (
              <div className="mt-3">
                {addOpen ? (
                  <AddMilestoneForm
                    placeholder="משימה שוטפת לשבוע"
                    requireOwner
                    onSubmit={(input) => {
                      setAddOpen(false);
                      board.createMilestone({
                        rockId: "",
                        source: "adhoc",
                        origin: "week",
                        ...input,
                        // משימה שנוספה במהלך השבוע נכנסת גם לחודש הפתוח, כדי שתיספר בתקציר החודשי.
                        assignTo: (
                          [
                            { periodType: "month", periodKey: board.activeMonthKey },
                            { periodType: "week", periodKey: board.activeWeekKey },
                          ] as { periodType: PeriodType; periodKey: string }[]
                        ).filter((a) => a.periodKey),
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
                    הוספת משימה שוטפת לשבוע
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {board.activeWeekKey && (
        <ReviewPanel
          period="weekly"
          periodKey={board.activeWeekKey}
          title="סיכום ישיבה שבועית"
          agenda={WEEKLY_AGENDA}
          initialNotes={reviewNotes}
          previousReviews={previousReviews}
          readOnly={board.readOnly}
        />
      )}

      {meetingOpen && (
        <MeetingPicker
          title="ישיבה שבועית - בחירת ההתחייבות לשבוע"
          subtitle={`${weekLabel(board.activeWeekKey)} · בחירה מרובה, אישור אחד, בלי לפתוח אף משימה`}
          candidates={[...carryCandidates, ...weekCandidates.filter((m) => !carryCandidates.some((c) => c.id === m.id))]}
          rocks={board.rocks}
          alreadyAssigned={board.weekIds}
          toneContext={{ today, weekWarningActive: weekWarning }}
          confirmLabel="הוספה לשבוע"
          isPending={board.isPending}
          onConfirm={(ids) => {
            board.assign(ids, "week", board.activeWeekKey);
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
