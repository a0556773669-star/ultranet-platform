"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import type { Rock, RockStatus, Milestone, RockReview } from "@ultranet/shared-types";
import {
  createRockAction,
  createMilestoneAction,
  updateRockStatusAction,
  deleteRockAction,
  deleteMilestoneAction,
  promoteMilestonesToMonthAction,
} from "./actions";
import type { AssignableUser } from "./actions";
import { currentMonthKey, monthLabel } from "./date-utils";
import { useToast } from "@/lib/toast";
import { ReviewPanel } from "./review-panel";

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

function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
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
  users,
  initialReviewNotes,
  previousReviews,
}: {
  quarterKey: string;
  quarterLabel: string;
  prevHref: string;
  nextHref: string;
  rocks: Rock[];
  milestones: Milestone[];
  users: AssignableUser[];
  initialReviewNotes: string;
  previousReviews: RockReview[];
}) {
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openNewRock, setOpenNewRock] = useState(false);
  const [openSubForm, setOpenSubForm] = useState<Set<string>>(new Set());
  const [openMilestoneForm, setOpenMilestoneForm] = useState<Set<string>>(new Set());
  const [collapsedRocks, setCollapsedRocks] = useState<Set<string>>(new Set());

  // מצב מקומי + עדכון אופטימי: הפריט מופיע מיד עם הלחיצה, ומוחלף בנתון האמיתי
  // כשה-props מתעדכנים אחרי revalidatePath (בלי לחכות לסיבוב שרת מלא כדי לראות אותו).
  const [localRocks, setLocalRocks] = useState(rocks);
  const [localMilestones, setLocalMilestones] = useState(milestones);
  useEffect(() => setLocalRocks(rocks), [rocks]);
  useEffect(() => setLocalMilestones(milestones), [milestones]);

  const topRocks = useMemo(
    () => localRocks.filter((r) => !r.parentRockId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [localRocks]
  );
  const subRocksByParent = useMemo(() => {
    const map = new Map<string, Rock[]>();
    localRocks
      .filter((r) => r.parentRockId)
      .forEach((r) => {
        const key = r.parentRockId as string;
        const list = map.get(key) ?? [];
        list.push(r);
        map.set(key, list);
      });
    return map;
  }, [localRocks]);
  const milestonesByRock = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    localMilestones.forEach((m) => {
      const list = map.get(m.rockId) ?? [];
      list.push(m);
      map.set(m.rockId, list);
    });
    return map;
  }, [localMilestones]);

  // כל אבני הדרך של סלע, כולל אלה שבתתי-הסלעים שלו - לצביעת "סלע הושלם" גם כשהמשימות בפועל יושבות על תתי-הסלעים.
  function collectDescendantMilestones(rockId: string): Milestone[] {
    const own = milestonesByRock.get(rockId) ?? [];
    const subs = subRocksByParent.get(rockId) ?? [];
    return [...own, ...subs.flatMap((sr) => collectDescendantMilestones(sr.id))];
  }

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
    setLocalMilestones((prev) => prev.map((m) => (ids.includes(m.id) ? { ...m, stage: "month", monthKey } : m)));
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

  function addRockOptimistic(rock: {
    title: string;
    description: string;
    parentRockId: string | null;
    ownerUserId: string;
    ownerName: string;
  }) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setLocalRocks((prev) => [
      ...prev,
      {
        id: tempId,
        title: rock.title,
        description: rock.description,
        quarterKey,
        parentRockId: rock.parentRockId,
        ownerUserId: rock.ownerUserId,
        ownerName: rock.ownerName,
        status: "active",
        order: Date.now(),
        createdAt: Date.now(),
      },
    ]);
    return tempId;
  }

  function addMilestoneOptimistic(m: { rockId: string; title: string; ownerUserId: string; ownerName: string }) {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setLocalMilestones((prev) => [
      ...prev,
      {
        id: tempId,
        rockId: m.rockId,
        quarterKey,
        title: m.title,
        ownerUserId: m.ownerUserId,
        ownerName: m.ownerName,
        stage: "backlog",
        done: false,
        carryOverCount: 0,
        order: Date.now(),
        createdAt: Date.now(),
      },
    ]);
    return tempId;
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

  function renderRockCard(rock: Rock, level: 0 | 1) {
    const subRocks = subRocksByParent.get(rock.id) ?? [];
    const rockMilestones = milestonesByRock.get(rock.id) ?? [];
    const collapsed = collapsedRocks.has(rock.id);
    const doneCount = rockMilestones.filter((m) => m.done).length;
    const allDescendantMilestones = collectDescendantMilestones(rock.id);
    const allDone = allDescendantMilestones.length > 0 && allDescendantMilestones.every((m) => m.done);
    const pending = isTempId(rock.id);

    const cardClass =
      level === 0
        ? `card ${allDone ? "!border-emerald-300 !bg-emerald-50" : ""}`
        : `rounded-[11px] border p-3 ${allDone ? "border-emerald-300 bg-emerald-50" : "border-card-border bg-[#f9fafb]"}`;

    return (
      <div key={rock.id} className={`${cardClass} ${pending ? "opacity-60" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => setCollapsedRocks((prev) => toggleInSet(prev, rock.id))}
            className="flex flex-1 items-start gap-2 text-right"
          >
            {collapsed ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            ) : (
              <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            )}
            <span>
              <span className="font-bold text-ink">{rock.title}</span>
              {allDone && (
                <span className="mr-2 rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  ✓ הושלם במלואו
                </span>
              )}
              {rock.description ? <span className="mr-2 text-xs text-muted">{rock.description}</span> : null}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            {rockMilestones.length > 0 && (
              <span className="text-[11px] text-muted">
                {doneCount}/{rockMilestones.length}
              </span>
            )}
            {rock.ownerName ? <span className="text-[11px] text-muted">{rock.ownerName}</span> : null}
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
          </div>
        </div>

        {!collapsed && (
          <div className="mt-3 flex flex-col gap-2 pr-6">
            {rockMilestones.map((m) => renderMilestone(m))}

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
                users={users}
                onSubmit={(title, ownerUserId, ownerName) => {
                  addMilestoneOptimistic({ rockId: rock.id, title, ownerUserId, ownerName });
                  setOpenMilestoneForm((prev) => toggleInSet(prev, rock.id));
                  startTransition(async () => {
                    const result = await createMilestoneAction({ rockId: rock.id, quarterKey, title, ownerUserId, ownerName });
                    if (!result.ok) showError(result.message);
                  });
                }}
                onCancel={() => setOpenMilestoneForm((prev) => toggleInSet(prev, rock.id))}
              />
            )}

            {level === 0 && openSubForm.has(rock.id) && (
              <AddRockForm
                users={users}
                placeholder="שם תת-הסלע"
                onSubmit={(title, description, ownerUserId, ownerName) => {
                  addRockOptimistic({ title, description, parentRockId: rock.id, ownerUserId, ownerName });
                  setOpenSubForm((prev) => toggleInSet(prev, rock.id));
                  startTransition(async () => {
                    const result = await createRockAction({ title, description, quarterKey, parentRockId: rock.id, ownerUserId, ownerName });
                    if (!result.ok) showError(result.message);
                  });
                }}
                onCancel={() => setOpenSubForm((prev) => toggleInSet(prev, rock.id))}
              />
            )}

            {level === 0 && subRocks.length > 0 && (
              <div className="flex flex-col gap-2 pt-1">{subRocks.map((sr) => renderRockCard(sr, 1))}</div>
            )}
          </div>
        )}
      </div>
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
            users={users}
            placeholder="שם הסלע"
            onSubmit={(title, description, ownerUserId, ownerName) => {
              addRockOptimistic({ title, description, parentRockId: null, ownerUserId, ownerName });
              setOpenNewRock(false);
              startTransition(async () => {
                const result = await createRockAction({ title, description, quarterKey, ownerUserId, ownerName });
                if (!result.ok) showError(result.message);
              });
            }}
            onCancel={() => setOpenNewRock(false)}
          />
        </div>
      )}

      {topRocks.length === 0 ? (
        <div className="card text-sm text-muted">עדיין אין סלעים לרבעון הזה. מומלץ להתחיל עם עד 3 סלעים מרכזיים.</div>
      ) : (
        <div className="flex flex-col gap-3">{topRocks.map((r) => renderRockCard(r, 0))}</div>
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
            העברה ל{monthLabel(currentMonthKey())}
          </button>
        </div>
      )}
    </div>
  );
}

function AddRockForm({
  users,
  placeholder,
  onSubmit,
  onCancel,
}: {
  users: AssignableUser[];
  placeholder: string;
  onSubmit: (title: string, description: string, ownerUserId: string, ownerName: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerId, setOwnerId] = useState("");

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-card-border bg-white p-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="תיאור (רשות)"
        rows={2}
        className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={ownerId}
          onChange={(e) => setOwnerId(e.target.value)}
          className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
        >
          <option value="">אחראי (רשות)</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (!title.trim()) return;
            const owner = users.find((u) => u.id === ownerId);
            onSubmit(title, description, ownerId, owner?.name ?? "");
            setTitle("");
            setDescription("");
            setOwnerId("");
          }}
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
        >
          שמירה
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted hover:underline">
          ביטול
        </button>
      </div>
    </div>
  );
}

function AddMilestoneForm({
  users,
  onSubmit,
  onCancel,
}: {
  users: AssignableUser[];
  onSubmit: (title: string, ownerUserId: string, ownerName: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-card-border bg-white p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="שם אבן הדרך"
        className="min-w-[160px] flex-1 rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
      />
      <select
        value={ownerId}
        onChange={(e) => setOwnerId(e.target.value)}
        className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
      >
        <option value="">אחראי (רשות)</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          if (!title.trim()) return;
          const owner = users.find((u) => u.id === ownerId);
          onSubmit(title, ownerId, owner?.name ?? "");
          setTitle("");
          setOwnerId("");
        }}
        className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-3 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
      >
        הוספה
      </button>
      <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted hover:underline">
        ביטול
      </button>
    </div>
  );
}
