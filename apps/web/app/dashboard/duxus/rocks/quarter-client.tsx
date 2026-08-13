"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import type { Rock, RockStatus, Milestone, RockReview } from "@ultranet/shared-types";
import {
  createRockAction,
  createMilestoneAction,
  updateRockStatusAction,
  deleteRockAction,
  deleteMilestoneAction,
  promoteMilestonesToMonthAction,
} from "./actions";
import { currentMonthKey, monthLabel } from "./date-utils";
import { useToast } from "@/lib/toast";
import { ReviewPanel } from "./review-panel";
import { RockMilestoneTree, groupRocksByParent, groupMilestonesByRock, toggleInSet } from "./rock-tree";
import { AddRockForm, AddMilestoneForm } from "./add-forms";

const QUARTERLY_AGENDA = [
  "מה נשמע? מה חדש?",
  "בדיקת כל הסלעים שנלקחו ברבעון - האם עמדנו בהם, בחלקם, או בכלל",
  "האם הגענו ליעדים?",
  "אם לא הגענו - למה לא, ומה הלקחים?",
  "מה שלא הצלחנו להשלים - להעביר לרבעון הבא?",
  "בחירת עד 3 סלעים לרבעון הבא",
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

function isTempId(id: string): boolean {
  return id.startsWith("temp-");
}

export function QuarterClient({
  quarterKey,
  quarterLabel,
  prevHref,
  nextHref,
  rocks,
  milestones,
  initialReviewNotes,
  previousReviews,
}: {
  quarterKey: string;
  quarterLabel: string;
  prevHref: string;
  nextHref: string;
  rocks: Rock[];
  milestones: Milestone[];
  initialReviewNotes: string;
  previousReviews: RockReview[];
}) {
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openNewRock, setOpenNewRock] = useState(false);
  const [openSubForm, setOpenSubForm] = useState<Set<string>>(new Set());
  const [openMilestoneForm, setOpenMilestoneForm] = useState<Set<string>>(new Set());

  // מצב מקומי + עדכון אופטימי: הפריט מופיע מיד עם הלחיצה, ומוחלף בנתון האמיתי
  // כשה-props מתעדכנים אחרי revalidatePath (בלי לחכות לסיבוב שרת מלא כדי לראות אותו).
  const [localRocks, setLocalRocks] = useState(rocks);
  const [localMilestones, setLocalMilestones] = useState(milestones);
  useEffect(() => setLocalRocks(rocks), [rocks]);
  useEffect(() => setLocalMilestones(milestones), [milestones]);

  const { topRocks, subRocksByParent } = useMemo(() => groupRocksByParent(localRocks), [localRocks]);
  const milestonesByRock = useMemo(() => groupMilestonesByRock(localMilestones), [localMilestones]);

  function toggleSelected(id: string) {
    setSelected((prev) => toggleInSet(prev, id));
  }

  function handleStatus(rock: Rock) {
    startTransition(async () => {
      const result = await updateRockStatusAction(rock.id, nextStatus(rock.status));
      if (!result.ok) showError(result.message);
    });
  }

  function handleDeleteRock(rock: Rock) {
    if (!confirm(`למחוק את "${rock.title}" וכל תתי הסלעים/אבני הדרך שבתוכו?`)) return;
    startTransition(async () => {
      const result = await deleteRockAction(rock.id);
      if (!result.ok) showError(result.message);
    });
  }

  function handleDeleteMilestone(id: string) {
    setLocalMilestones((prev) => prev.filter((m) => m.id !== id));
    startTransition(async () => {
      const result = await deleteMilestoneAction(id);
      if (!result.ok) showError(result.message);
    });
  }

  function handlePromote() {
    if (!selected.size) return;
    const monthKey = currentMonthKey();
    const ids = Array.from(selected);
    setLocalMilestones((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, stage: "month" as const, monthKey } : m)));
    startTransition(async () => {
      const result = await promoteMilestonesToMonthAction(ids, monthKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(`הועבר ל${monthLabel(monthKey)}`);
      setSelected(new Set());
    });
  }

  function addRockOptimistic(rock: { title: string; description: string; parentRockId: string | null; ownerName: string }) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setLocalRocks((prev) => [
      ...prev,
      {
        id: tempId,
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

  function addMilestoneOptimistic(m: { rockId: string; title: string; ownerName: string }) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setLocalMilestones((prev) => [
      ...prev,
      {
        id: tempId,
        rockId: m.rockId,
        quarterKey,
        title: m.title,
        ownerUserId: "",
        ownerName: m.ownerName,
        stage: "backlog",
        done: false,
        carryOverCount: 0,
        order: Date.now(),
        createdAt: Date.now(),
      },
    ]);
  }

  function renderMilestone(m: Milestone) {
    const selectable = m.stage === "backlog" && !m.done;
    const pending = isTempId(m.id);
    return (
      <div
        key={m.id}
        className={`flex items-center justify-between gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm ${pending ? "opacity-60" : ""}`}
      >
        <label className="flex flex-1 items-center gap-2">
          {selectable ? (
            <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelected(m.id)} className="h-4 w-4 accent-teal" />
          ) : (
            <span className="inline-block h-4 w-4" />
          )}
          <span className={m.done ? "text-muted line-through" : "text-ink"}>{m.title}</span>
        </label>
        {m.ownerName ? <span className="text-[11px] text-muted">{m.ownerName}</span> : null}
        {m.done ? (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">בוצע</span>
        ) : m.stage === "week" ? (
          <span className="rounded-full border border-purple bg-[#f4ecf8] px-2 py-0.5 text-[11px] font-bold text-purple">בשבועי</span>
        ) : m.stage === "month" ? (
          <span className="rounded-full border border-teal bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">בחודשי</span>
        ) : null}
        <button type="button" onClick={() => handleDeleteMilestone(m.id)} className="text-muted hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  function renderRockExtra(rock: Rock) {
    return (
      <>
        <button
          type="button"
          onClick={() => handleStatus(rock)}
          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[rock.status]}`}
          title="לחיצה למעבר סטטוס"
        >
          {STATUS_LABEL[rock.status]}
        </button>
        <button type="button" onClick={() => handleDeleteRock(rock)} className="text-muted hover:text-red-600">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </>
    );
  }

  function renderRockFooter(rock: Rock, level: 0 | 1) {
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
              addMilestoneOptimistic({ rockId: rock.id, title, ownerName });
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
      <div className="mb-4 flex items-center justify-between">
        <Link href={prevHref} className="btn-outline text-xs">
          ‹ הקודם
        </Link>
        <h2 className="text-lg font-bold text-ink">{quarterLabel}</h2>
        <Link href={nextHref} className="btn-outline text-xs">
          הבא ›
        </Link>
      </div>

      <ReviewPanel
        period="quarterly"
        periodKey={quarterKey}
        title="פגישת רבעון"
        agenda={QUARTERLY_AGENDA}
        initialNotes={initialReviewNotes}
        previousReviews={previousReviews}
      />

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">סלעים לרבעון</h3>
        <button
          type="button"
          onClick={() => setOpenNewRock((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
        >
          <Plus className="h-3.5 w-3.5" />
          סלע חדש
        </button>
      </div>

      {openNewRock && (
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
        renderMilestone={renderMilestone}
        renderRockExtra={renderRockExtra}
        renderRockFooter={renderRockFooter}
        emptyMessage="עדיין אין סלעים לרבעון הזה. מומלץ להתחיל עם עד 3 סלעים מרכזיים."
      />

      {selected.size > 0 && (
        <div className="sticky bottom-4 mt-4 flex items-center justify-between rounded-[11px] border border-teal bg-white px-4 py-3 shadow-lg">
          <span className="text-sm font-bold text-ink">{selected.size} אבני דרך נבחרו</span>
          <button
            type="button"
            onClick={handlePromote}
            disabled={isPending}
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
          >
            העברה ל{monthLabel(currentMonthKey())}
          </button>
        </div>
      )}
    </div>
  );
}
