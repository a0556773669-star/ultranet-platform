"use client";

import { useMemo, useState } from "react";
import { Mountain, Plus, Trash2, Ban, RotateCcw, AlertTriangle } from "lucide-react";
import type { Milestone, Quarter, Rock, RockReview } from "@ultranet/shared-types";
import type { QuarterBoard } from "../actions";
import { useBoard } from "../use-board";
import { MilestoneRow } from "../milestone-row";
import { MilestonePanel } from "../milestone-panel";
import { AddMilestoneForm, AddRockForm } from "../add-forms";
import { ReviewPanel } from "../review-panel";
import { QuarterBar } from "../quarter-bar";
import { RockMilestoneTree, groupMilestonesByRock, groupRocksByParent, splitRockAndAdhoc, toggleInSet } from "../rock-tree";
import { monthLabel, weekLabel } from "../date-utils";

const QUARTERLY_AGENDA = [
  "מה נשמע? מה חדש?",
  "בדיקת כל הסלעים שנלקחו ברבעון - האם עמדנו בהם, בחלקם, או בכלל",
  "אם לא הגענו ליעד - למה, ומה הלקחים?",
  "מה שלא הצלחנו להשלים - להתחייב אליו שוב ברבעון הבא?",
  "בחירת הסלעים לרבעון הבא (עד שלושה)",
  "פירוק כל סלע לתתי-סלעים ולאבני דרך, עם אחראי ברור",
  "בחירת אבני הדרך לחודש הראשון",
  "בחירת אבני הדרך לשבוע הראשון",
];

/**
 * מסך הרבעון (סעיפים 7.1-7.2) - התכנון עצמו: עץ הסלעים המלא, הוספה ועריכה מהירה
 * בכל רמה, וההתקדמות שמחושבת אוטומטית מאבני הדרך.
 *
 * הסימון "בוצע" לא מוצג כאן: הוא נעשה במסכי השבוע והחודש, שם עובדים בפועל.
 */
export function QuarterClient({
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
  const [openNewRock, setOpenNewRock] = useState(false);
  const [openSubForm, setOpenSubForm] = useState<Set<string>>(new Set());
  const [openMilestoneForm, setOpenMilestoneForm] = useState<Set<string>>(new Set());

  const { topRocks, subRocksByParent } = useMemo(() => groupRocksByParent(board.rocks), [board.rocks]);
  const milestonesByRock = useMemo(() => groupMilestonesByRock(board.milestones), [board.milestones]);
  const { adhocTasks } = useMemo(() => splitRockAndAdhoc(board.milestones), [board.milestones]);

  /** סלעים שהגיעו עם אבן דרך שהתחייבנו אליה מחדש - אינם שייכים לרבעון הזה. */
  const foreignRockIds = useMemo(
    () => new Set(board.rocks.filter((r) => r.quarterKey !== board.quarterKey).map((r) => r.id)),
    [board.rocks, board.quarterKey]
  );

  const activeTopRocks = topRocks.filter((r) => r.status !== "dropped" && !foreignRockIds.has(r.id));
  const overLimit = activeTopRocks.length >= board.settings.recommendedRocksPerQuarter;

  /** אזהרת חריגה מהמלצת השיטה (סעיף 7.1) - אזהרה בלבד, לא חסימה. */
  function handleNewRock() {
    if (
      overLimit &&
      !confirm(
        `השיטה ממליצה על עד ${board.settings.recommendedRocksPerQuarter} סלעים לרבעון, וכרגע יש ${activeTopRocks.length}. להוסיף סלע נוסף בכל זאת?`
      )
    )
      return;
    setOpenNewRock(true);
  }

  function renderMilestone(m: Milestone) {
    const inWeek = board.weekIds.has(m.id);
    const inMonth = board.monthIds.has(m.id);
    return (
      <MilestoneRow
        key={m.id}
        milestone={m}
        toneContext={board.toneContext(m)}
        onOpen={(x) => board.setOpenMilestoneId(x.id)}
        onStatus={board.readOnly ? undefined : board.setStatus}
        onReopen={board.reopen}
        readOnly={board.readOnly}
        extraBadges={
          inWeek ? (
            <span className="rounded-full border border-purple/40 bg-[#f4ecf8] px-2 py-0.5 text-[11px] font-bold text-purple">
              {weekLabel(board.activeWeekKey).replace("שבוע ", "שבוע ")}
            </span>
          ) : inMonth ? (
            <span className="rounded-full border border-teal bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">
              {monthLabel(board.activeMonthKey)}
            </span>
          ) : (
            <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[11px] font-bold text-muted">
              לא שובצה
            </span>
          )
        }
      />
    );
  }

  function renderRockExtra(rock: Rock) {
    if (board.readOnly) {
      return rock.status === "dropped" ? (
        <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[11px] font-bold text-muted">בוטל</span>
      ) : null;
    }
    return (
      <>
        <button
          type="button"
          onClick={() => board.dropRock(rock)}
          title={rock.status === "dropped" ? "החזרה לפעיל" : "ביטול הסלע"}
          className="text-muted hover:text-ink"
        >
          {rock.status === "dropped" ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
        </button>
        <button type="button" onClick={() => board.removeRock(rock)} title="מחיקה" className="text-muted hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </>
    );
  }

  function renderRockFooter(rock: Rock, level: 0 | 1) {
    if (board.readOnly) return null;
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
            onSubmit={(input) => {
              setOpenMilestoneForm((prev) => toggleInSet(prev, rock.id));
              board.createMilestone({ rockId: rock.id, origin: "quarter", ...input });
            }}
            onCancel={() => setOpenMilestoneForm((prev) => toggleInSet(prev, rock.id))}
          />
        )}

        {level === 0 && openSubForm.has(rock.id) && (
          <AddRockForm
            placeholder="שם תת-הסלע"
            onSubmit={(input) => {
              setOpenSubForm((prev) => toggleInSet(prev, rock.id));
              board.createRock({ ...input, parentRockId: rock.id });
            }}
            onCancel={() => setOpenSubForm((prev) => toggleInSet(prev, rock.id))}
          />
        )}
      </>
    );
  }

  return (
    <div>
      {board.toastNode}
      {board.deleteDialogNode}
      <QuarterBar quarter={boardData.quarter} quarters={quarters} />

      <ReviewPanel
        period="quarterly"
        periodKey={board.quarterKey}
        title="סיכום ישיבה רבעונית"
        agenda={QUARTERLY_AGENDA}
        initialNotes={reviewNotes}
        previousReviews={previousReviews}
        readOnly={board.readOnly}
      />

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
            <Mountain className="h-4.5 w-4.5" />
            הסלעים של הרבעון
            <span className="text-xs font-semibold text-muted">
              {activeTopRocks.length} מתוך {board.settings.recommendedRocksPerQuarter} מומלצים
            </span>
          </h2>
          {!board.readOnly && (
            <button
              type="button"
              onClick={handleNewRock}
              className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              סלע חדש
            </button>
          )}
        </div>

        {overLimit && !board.readOnly && (
          <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            הגעתם למספר הסלעים שהשיטה ממליצה עליו לרבעון. אפשר להוסיף עוד, אבל כדאי לשקול לפני.
          </div>
        )}

        {openNewRock && !board.readOnly && (
          <div className="mb-3">
            <AddRockForm
              placeholder="שם הסלע"
              onSubmit={(input) => {
                setOpenNewRock(false);
                board.createRock({ ...input, parentRockId: null });
              }}
              onCancel={() => setOpenNewRock(false)}
            />
          </div>
        )}

        <RockMilestoneTree
          topRocks={topRocks}
          subRocksByParent={subRocksByParent}
          milestonesByRock={milestonesByRock}
          renderMilestone={renderMilestone}
          renderRockExtra={renderRockExtra}
          renderRockFooter={renderRockFooter}
          warningContext={{ today, weekWarningActive: weekWarning, selectedIds: board.weekIds }}
          foreignRockIds={foreignRockIds}
          emptyMessage={
            board.readOnly
              ? "לא נרשמו סלעים ברבעון הזה."
              : "עדיין אין סלעים ברבעון הזה. מתחילים מסלע אחד, מפרקים אותו לתתי-סלעים ולאבני דרך, ואז בוחרים מה נכנס לחודש ולשבוע."
          }
        />

        {adhocTasks.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 text-xs font-bold text-muted">משימות שוטפות ({adhocTasks.length})</div>
            <div className="flex flex-col gap-1.5">{adhocTasks.map(renderMilestone)}</div>
          </div>
        )}
      </section>

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
