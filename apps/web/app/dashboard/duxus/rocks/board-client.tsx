"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mountain, Plus, Trash2 } from "lucide-react";
import type { Quarter, Rock, RockStatus, Milestone, RockReview } from "@ultranet/shared-types";
import {
  createRockAction,
  createMilestoneAction,
  updateRockStatusAction,
  deleteRockAction,
  deleteMilestoneAction,
  promoteMilestonesToMonthAction,
  promoteMilestonesToWeekAction,
  carryOverMilestoneToMonthAction,
  carryOverMilestoneToWeekAction,
  toggleMilestoneDoneAction,
  openNextMonthAction,
  openNextWeekAction,
} from "./actions";
import { monthLabel, weekLabel, latestMonthKey, latestWeekKey, weekKeyIndex } from "./date-utils";
import { useToast } from "@/lib/toast";
import { ReviewPanel } from "./review-panel";
import { QuarterBar } from "./quarter-bar";
import { PeriodPanel } from "./period-panel";
import { AdhocPanel } from "./adhoc-panel";
import { buildRocksById } from "./rock-lookup";
import { RockMilestoneTree, groupRocksByParent, groupMilestonesByRock, splitRockAndAdhoc, toggleInSet } from "./rock-tree";
import { AddRockForm, AddMilestoneForm } from "./add-forms";

const QUARTERLY_AGENDA = [
  "מה נשמע? מה חדש?",
  "בדיקת כל הסלעים שנלקחו ברבעון - האם עמדנו בהם, בחלקם, או בכלל",
  "האם הגענו ליעדים?",
  "אם לא הגענו - למה לא, ומה הלקחים?",
  "מה שלא הצלחנו להשלים - להעביר לרבעון הבא?",
  "בחירת הסלעים לרבעון הבא",
  "פירוק כל סלע לכמה שיותר אבני דרך עם הטלת אחריות ברורה",
  "בחירת אבני דרך לחודש הראשון",
  "בחירת אבני דרך לשבוע הראשון",
];

const STATUS_LABEL: Record<RockStatus, string> = { active: "פעיל", done: "הושלם", dropped: "בוטל" };
const STATUS_CLASS: Record<RockStatus, string> = {
  active: "border-teal bg-teal-bg text-teal-dark",
  done: "border-emerald-300 bg-emerald-50 text-emerald-700",
  dropped: "border-card-border bg-[#f4f6f9] text-muted",
};

function nextStatus(s: RockStatus): RockStatus {
  if (s === "active") return "done";
  if (s === "done") return "dropped";
  return "active";
}

function tempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * לוח העבודה של הרבעון - מסך אחד, שלוש קומות זו מעל זו:
 *
 *   1. **שבוע** (למעלה) - מה עושים עכשיו, תמיד ראשון על המסך
 *   2. **חודש** - אבני הדרך של החודש, כולל אלו שכבר נמשכו לשבוע (מסומנות "בשבוע")
 *   3. **רבעון** - עץ הסלעים המלא עם ההתקדמות
 *
 * הזרימה היא מלמטה למעלה: פותחים רבעון ➔ "פתיחת החודש הראשון" ➔ "פתיחת השבוע
 * הראשון". פתיחת שבוע/חודש חדש דוחפת את הקודם ל"תקופות קודמות" באותה קומה,
 * ואבן דרך שלא הושלמה נשארת גלויה ומסומנת ברמת החודש והרבעון כל עוד הרבעון פעיל.
 */
export function BoardClient({
  quarter,
  quarters,
  rocks,
  milestones,
  quarterReviewNotes,
  monthReviewNotes,
  weekReviewNotes,
  quarterlyReviews,
  monthlyReviews,
  weeklyReviews,
}: {
  quarter: Quarter;
  quarters: Quarter[];
  rocks: Rock[];
  milestones: Milestone[];
  quarterReviewNotes: string;
  monthReviewNotes: string;
  weekReviewNotes: string;
  quarterlyReviews: RockReview[];
  monthlyReviews: RockReview[];
  weeklyReviews: RockReview[];
}) {
  const quarterKey = quarter.id;
  const readOnly = quarter.status === "archived";

  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [openNewRock, setOpenNewRock] = useState(false);
  const [openSubForm, setOpenSubForm] = useState<Set<string>>(new Set());
  const [openMilestoneForm, setOpenMilestoneForm] = useState<Set<string>>(new Set());

  const [localRocks, setLocalRocks] = useState(rocks);
  const [localMilestones, setLocalMilestones] = useState(milestones);
  useEffect(() => setLocalRocks(rocks), [rocks]);
  useEffect(() => setLocalMilestones(milestones), [milestones]);

  // רבעונים שנוצרו לפני שדות ה"תקופה הפתוחה" - נגזרים מהמפתח המאוחר ביותר שקיים בדאטה.
  const activeMonthKey = quarter.activeMonthKey || latestMonthKey(localMilestones.map((m) => m.monthKey ?? ""));
  const activeWeekKey = quarter.activeWeekKey || latestWeekKey(localMilestones.map((m) => m.weekKey ?? ""));

  const rocksById = useMemo(() => buildRocksById(localRocks), [localRocks]);
  const { topRocks, subRocksByParent } = useMemo(() => groupRocksByParent(localRocks), [localRocks]);
  const milestonesByRock = useMemo(() => groupMilestonesByRock(localMilestones), [localMilestones]);

  // --- חלוקה לקומות ---

  const weekTasks = useMemo(
    () => localMilestones.filter((m) => m.stage === "week" && m.weekKey === activeWeekKey),
    [localMilestones, activeWeekKey]
  );
  const weekOverdue = useMemo(
    () => localMilestones.filter((m) => m.stage === "week" && m.weekKey && m.weekKey !== activeWeekKey && !m.done),
    [localMilestones, activeWeekKey]
  );
  const weekPullCandidates = useMemo(
    () => localMilestones.filter((m) => m.stage === "month" && m.monthKey === activeMonthKey && !m.done),
    [localMilestones, activeMonthKey]
  );

  // בקומת החודש מוצגות גם אבני דרך שכבר נמשכו לשבוע - `monthKey` נשאר עליהן,
  // ולכן הן ממשיכות להיראות (ומסומנות "בשבוע") בדיוק כמו שביקשנו.
  const monthTasks = useMemo(
    () => localMilestones.filter((m) => m.stage !== "backlog" && m.monthKey === activeMonthKey),
    [localMilestones, activeMonthKey]
  );
  const monthOverdue = useMemo(
    () => localMilestones.filter((m) => m.stage !== "backlog" && m.monthKey && m.monthKey !== activeMonthKey && !m.done),
    [localMilestones, activeMonthKey]
  );
  const monthPullCandidates = useMemo(
    () => localMilestones.filter((m) => m.stage === "backlog" && !m.done),
    [localMilestones]
  );

  const previousWeeks = useMemo(() => {
    const groups = new Map<string, Milestone[]>();
    localMilestones.forEach((m) => {
      if (m.stage !== "week" || !m.weekKey || m.weekKey === activeWeekKey) return;
      groups.set(m.weekKey, [...(groups.get(m.weekKey) ?? []), m]);
    });
    return Array.from(groups.entries())
      .sort((a, b) => weekKeyIndex(b[0]) - weekKeyIndex(a[0]))
      .map(([key, tasks]) => ({ key, label: weekLabel(key), tasks }));
  }, [localMilestones, activeWeekKey]);

  const previousMonths = useMemo(() => {
    const groups = new Map<string, Milestone[]>();
    localMilestones.forEach((m) => {
      if (m.stage === "backlog" || !m.monthKey || m.monthKey === activeMonthKey) return;
      groups.set(m.monthKey, [...(groups.get(m.monthKey) ?? []), m]);
    });
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, tasks]) => ({ key, label: monthLabel(key), tasks }));
  }, [localMilestones, activeMonthKey]);

  const { adhocTasks: quarterAdhoc } = useMemo(() => splitRockAndAdhoc(localMilestones), [localMilestones]);
  const backlogAdhoc = useMemo(() => quarterAdhoc.filter((m) => m.stage === "backlog"), [quarterAdhoc]);

  // --- פעולות משותפות ---

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

  function handleDeleteMilestone(id: string) {
    const removed = localMilestones.find((m) => m.id === id);
    setLocalMilestones((prev) => prev.filter((m) => m.id !== id));
    startTransition(async () => {
      const result = await deleteMilestoneAction(id);
      if (!result.ok) {
        showError(result.message);
        if (removed) setLocalMilestones((prev) => [...prev, removed]);
      }
    });
  }

  function handlePullToWeek(ids: string[]) {
    setLocalMilestones((prev) =>
      prev.map((m) => (ids.includes(m.id) ? { ...m, stage: "week" as const, weekKey: activeWeekKey } : m))
    );
    startTransition(async () => {
      const result = await promoteMilestonesToWeekAction(ids, activeWeekKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(`נוספו ${ids.length} משימות לשבוע`);
    });
  }

  function handlePullToMonth(ids: string[]) {
    setLocalMilestones((prev) =>
      prev.map((m) => (ids.includes(m.id) ? { ...m, stage: "month" as const, monthKey: activeMonthKey } : m))
    );
    startTransition(async () => {
      const result = await promoteMilestonesToMonthAction(ids, activeMonthKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(`נוספו ${ids.length} אבני דרך לחודש`);
    });
  }

  function handleCarryToWeek(m: Milestone) {
    startTransition(async () => {
      const result = await carryOverMilestoneToWeekAction(m.id, activeWeekKey);
      if (!result.ok) showError(result.message);
    });
  }

  function handleCarryToMonth(m: Milestone) {
    startTransition(async () => {
      const result = await carryOverMilestoneToMonthAction(m.id, activeMonthKey);
      if (!result.ok) showError(result.message);
    });
  }

  function addAdhocTask(title: string, ownerName: string, level: "week" | "month") {
    const stage = level === "week" ? ("week" as const) : ("month" as const);
    setLocalMilestones((prev) => [
      ...prev,
      {
        id: tempId(),
        rockId: "",
        quarterKey,
        title,
        ownerUserId: "",
        ownerName,
        stage,
        monthKey: activeMonthKey,
        weekKey: level === "week" ? activeWeekKey : undefined,
        done: false,
        carryOverCount: 0,
        source: "adhoc",
        order: Date.now(),
        createdAt: Date.now(),
      },
    ]);
    startTransition(async () => {
      const result = await createMilestoneAction({
        rockId: "",
        quarterKey,
        title,
        ownerName,
        stage,
        monthKey: activeMonthKey,
        weekKey: level === "week" ? activeWeekKey : undefined,
        source: "adhoc",
      });
      if (!result.ok) showError(result.message);
    });
  }

  function handleOpenNextWeek() {
    if (activeWeekKey && !confirm("לפתוח שבוע חדש? השבוע הנוכחי ירד ל\"שבועות קודמים\", ומה שלא הושלם יוצע להעברה קדימה.")) return;
    startTransition(async () => {
      const result = await openNextWeekAction(quarterKey, activeWeekKey, activeMonthKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(`נפתח ${weekLabel(result.periodKey)}`);
      router.refresh();
    });
  }

  function handleOpenNextMonth() {
    if (activeMonthKey && !confirm("לפתוח חודש חדש? החודש הנוכחי ירד ל\"חודשים קודמים\".")) return;
    startTransition(async () => {
      const result = await openNextMonthAction(quarterKey, activeMonthKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(`נפתח ${monthLabel(result.periodKey)}`);
      router.refresh();
    });
  }

  // --- קומת הרבעון (עץ הסלעים) ---

  function addRockOptimistic(rock: { title: string; description: string; parentRockId: string | null; ownerName: string }) {
    setLocalRocks((prev) => [
      ...prev,
      {
        id: tempId(),
        title: rock.title,
        description: rock.description,
        quarterKey,
        parentRockId: rock.parentRockId,
        ownerUserId: "",
        ownerName: rock.ownerName,
        status: "active",
        order: Date.now(),
        createdAt: Date.now(),
      },
    ]);
  }

  function renderQuarterMilestone(m: Milestone) {
    const pending = m.id.startsWith("temp-");
    return (
      <div
        key={m.id}
        className={`flex items-center justify-between gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm ${pending ? "opacity-60" : ""}`}
      >
        <span className={`flex-1 ${m.done ? "text-muted line-through" : "text-ink"}`}>{m.title}</span>
        {m.carryOverCount ? (
          <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
            גולגל {m.carryOverCount}
          </span>
        ) : null}
        {m.ownerName ? <span className="shrink-0 text-[11px] text-muted">{m.ownerName}</span> : null}
        {m.done ? (
          <span className="shrink-0 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            בוצע
          </span>
        ) : m.stage === "week" ? (
          <span className="shrink-0 rounded-full border border-purple bg-[#f4ecf8] px-2 py-0.5 text-[11px] font-bold text-purple">
            {m.weekKey === activeWeekKey ? "בשבוע הנוכחי" : "בשבוע קודם"}
          </span>
        ) : m.stage === "month" ? (
          <span className="shrink-0 rounded-full border border-teal bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">
            {m.monthKey === activeMonthKey ? "בחודש הנוכחי" : "בחודש קודם"}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[11px] font-bold text-muted">
            ממתין
          </span>
        )}
        {!readOnly && (
          <button type="button" onClick={() => handleDeleteMilestone(m.id)} className="shrink-0 text-muted hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  function renderRockExtra(rock: Rock) {
    if (readOnly) {
      return (
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[rock.status]}`}>
          {STATUS_LABEL[rock.status]}
        </span>
      );
    }
    return (
      <>
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              const result = await updateRockStatusAction(rock.id, nextStatus(rock.status));
              if (!result.ok) showError(result.message);
            })
          }
          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[rock.status]}`}
          title="לחיצה למעבר סטטוס"
        >
          {STATUS_LABEL[rock.status]}
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm(`למחוק את "${rock.title}" וכל תתי הסלעים/אבני הדרך שבתוכו?`)) return;
            startTransition(async () => {
              const result = await deleteRockAction(rock.id);
              if (!result.ok) showError(result.message);
            });
          }}
          className="text-muted hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </>
    );
  }

  function renderRockFooter(rock: Rock, level: 0 | 1) {
    if (readOnly) return null;
    return (
      <>
        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={() => setOpenMilestoneForm((prev) => toggleInSet(prev, rock.id))}
            className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            אבן דרך
          </button>
          {level === 0 && (
            <button
              type="button"
              onClick={() => setOpenSubForm((prev) => toggleInSet(prev, rock.id))}
              className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              תת-סלע
            </button>
          )}
        </div>

        {openMilestoneForm.has(rock.id) && (
          <AddMilestoneForm
            onSubmit={(title, ownerName) => {
              setLocalMilestones((prev) => [
                ...prev,
                {
                  id: tempId(),
                  rockId: rock.id,
                  quarterKey,
                  title,
                  ownerUserId: "",
                  ownerName,
                  stage: "backlog",
                  done: false,
                  carryOverCount: 0,
                  source: "rock",
                  order: Date.now(),
                  createdAt: Date.now(),
                },
              ]);
              setOpenMilestoneForm((prev) => toggleInSet(prev, rock.id));
              startTransition(async () => {
                const result = await createMilestoneAction({ rockId: rock.id, quarterKey, title, ownerName });
                if (!result.ok) showError(result.message);
              });
            }}
            onCancel={() => setOpenMilestoneForm((prev) => toggleInSet(prev, rock.id))}
          />
        )}

        {level === 0 && openSubForm.has(rock.id) && (
          <AddRockForm
            placeholder="שם תת-הסלע"
            onSubmit={(title, description, ownerName) => {
              addRockOptimistic({ title, description, parentRockId: rock.id, ownerName });
              setOpenSubForm((prev) => toggleInSet(prev, rock.id));
              startTransition(async () => {
                const result = await createRockAction({ title, description, quarterKey, parentRockId: rock.id, ownerName });
                if (!result.ok) showError(result.message);
              });
            }}
            onCancel={() => setOpenSubForm((prev) => toggleInSet(prev, rock.id))}
          />
        )}
      </>
    );
  }

  return (
    <div>
      {toastNode}

      <QuarterBar quarter={quarter} quarters={quarters} />

      {/* קומה 1 - השבוע, תמיד בראש המסך */}
      <PeriodPanel
        level="week"
        periodKey={activeWeekKey}
        periodLabel={activeWeekKey ? weekLabel(activeWeekKey) : ""}
        rocksById={rocksById}
        readOnly={readOnly}
        tasks={weekTasks}
        pullCandidates={weekPullCandidates}
        overdue={weekOverdue}
        previousPeriods={previousWeeks}
        reviewNotes={weekReviewNotes}
        previousReviews={weeklyReviews.filter((r) => r.periodKey !== activeWeekKey)}
        isPending={isPending}
        onOpenNext={handleOpenNextWeek}
        onToggleDone={handleToggleDone}
        onDelete={handleDeleteMilestone}
        onCarryOver={handleCarryToWeek}
        onPull={handlePullToWeek}
        onAddTask={(title, ownerName) => addAdhocTask(title, ownerName, "week")}
      />

      {/* קומה 2 - החודש */}
      <PeriodPanel
        level="month"
        periodKey={activeMonthKey}
        periodLabel={activeMonthKey ? monthLabel(activeMonthKey) : ""}
        rocksById={rocksById}
        readOnly={readOnly}
        tasks={monthTasks}
        pullCandidates={monthPullCandidates}
        overdue={monthOverdue}
        previousPeriods={previousMonths}
        reviewNotes={monthReviewNotes}
        previousReviews={monthlyReviews.filter((r) => r.periodKey !== activeMonthKey)}
        isPending={isPending}
        onOpenNext={handleOpenNextMonth}
        onToggleDone={handleToggleDone}
        onDelete={handleDeleteMilestone}
        onCarryOver={handleCarryToMonth}
        onPull={handlePullToMonth}
        onAddTask={(title, ownerName) => addAdhocTask(title, ownerName, "month")}
        badgeFor={(m) => (m.stage === "week" && m.weekKey === activeWeekKey ? "בשבוע" : null)}
      />

      {/* קומה 3 - הרבעון */}
      <section className="card border-r-4 border-r-purple">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
            <Mountain className="h-4.5 w-4.5" />
            הסלעים של הרבעון
          </h2>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setOpenNewRock((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              סלע חדש
            </button>
          )}
        </div>

        <ReviewPanel
          period="quarterly"
          periodKey={quarterKey}
          title="פגישת רבעון"
          agenda={QUARTERLY_AGENDA}
          initialNotes={quarterReviewNotes}
          previousReviews={quarterlyReviews.filter((r) => r.periodKey !== quarterKey)}
          readOnly={readOnly}
        />

        {openNewRock && !readOnly && (
          <div className="mb-3">
            <AddRockForm
              placeholder="שם הסלע"
              onSubmit={(title, description, ownerName) => {
                addRockOptimistic({ title, description, parentRockId: null, ownerName });
                setOpenNewRock(false);
                startTransition(async () => {
                  const result = await createRockAction({ title, description, quarterKey, ownerName });
                  if (!result.ok) showError(result.message);
                });
              }}
              onCancel={() => setOpenNewRock(false)}
            />
          </div>
        )}

        <RockMilestoneTree
          topRocks={topRocks}
          subRocksByParent={subRocksByParent}
          milestonesByRock={milestonesByRock}
          renderMilestone={renderQuarterMilestone}
          renderRockExtra={renderRockExtra}
          renderRockFooter={renderRockFooter}
          emptyMessage={
            readOnly ? "לא נרשמו סלעים ברבעון הזה." : "עדיין אין סלעים לרבעון הזה. מתחילים מסלע אחד ומפרקים אותו לתתי-סלעים ואבני דרך."
          }
        />

        <div className="mt-4">
          <AdhocPanel
            tasks={backlogAdhoc}
            quarterKey={quarterKey}
            stage="backlog"
            readOnly={readOnly}
            title="משימות שוטפות שממתינות"
            addLabel="הוסף משימה שוטפת"
            emptyMessage="אין משימות שוטפות שממתינות. משימות שוטפות נוספות בדרך כלל ישירות לשבוע."
          />
        </div>
      </section>
    </div>
  );
}
