"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, Plus, RotateCcw, Search, Undo2, X } from "lucide-react";
import type { PersonalTask, PersonalTaskPriority } from "@ultranet/shared-types";
import { useToast } from "@/lib/toast";
import { PersonalTaskRow } from "./task-row";
import { PersonalTaskPanel } from "./task-panel";
import { QuickAdd } from "./quick-add";
import {
  PERSONAL_PRIORITIES,
  PERSONAL_PRIORITY_LABEL,
  PERSONAL_SORT_LABEL,
  formatStamp,
  isDueToday,
  isOverdue,
  sortActiveTasks,
  sortCompletedTasks,
  type PersonalSort,
} from "./personal-task-ui";
import {
  completePersonalTaskAction,
  createPersonalTaskAction,
  reopenPersonalTaskAction,
  restorePersonalTaskAction,
  setPersonalTaskPinnedAction,
  type PersonalBoard,
  type PersonalTaskInput,
} from "./actions";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none";

/** כמה מושלמות נטענות בבת אחת - סעיף 11 ממליץ על 30 וכפתור "הצג עוד". */
const COMPLETED_PAGE = 30;

/** חלון ה"ביטול" אחרי סימון בטעות, בשניות (סעיף 10). */
const UNDO_SECONDS = 8;

const SORT_KEY = "ultranet.personalTasks.sort";

type QuickView = "all" | "new" | "urgent" | "today" | "overdue" | "waiting";

const QUICK_VIEWS: { key: QuickView; label: string }[] = [
  { key: "all", label: "הכול" },
  { key: "new", label: "חדש" },
  { key: "urgent", label: "דחוף" },
  { key: "today", label: "להיום" },
  { key: "overdue", label: "באיחור" },
  { key: "waiting", label: "ממתין" },
];

type CompletedRange = "all" | "day" | "week" | "month";

const COMPLETED_RANGES: { key: CompletedRange; label: string }[] = [
  { key: "day", label: "היום" },
  { key: "week", label: "השבוע" },
  { key: "month", label: "החודש" },
  { key: "all", label: "הכול" },
];

const RANGE_MS: Record<Exclude<CompletedRange, "all">, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

function matchesText(task: PersonalTask, query: string): boolean {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  // חיפוש חופשי בכותרת, פירוט, שם הפונה, טלפון והערה האחרונה (סעיף 12).
  return [task.title, task.description, task.contactName, task.contactPhone, task.lastNote]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

/**
 * מסך "משימות ליוני".
 *
 * כל הדאטה מגיע בשליפה אחת מהשרת והסינון, המיון והחלוקה לקבוצות נעשים כאן -
 * ולכן כל שינוי במסננים הוא מיידי. הפעולות עצמן מעדכנות קודם את המצב המקומי
 * (כדי שהשורה תיעלם ברגע הלחיצה) ורק אחר כך מרעננות מהשרת; כישלון מחזיר את
 * המצב הקודם ומציג הודעה, כך שלעולם לא מוצגת הצלחה שלא אושרה (סעיף 17).
 */
export function PersonalClient({ board }: { board: PersonalBoard }) {
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  const [active, setActive] = useState(board.active);
  const [completed, setCompleted] = useState(board.completed);
  const [archived, setArchived] = useState(board.archived);

  const [query, setQuery] = useState("");
  const [view, setView] = useState<QuickView>("all");
  const [priority, setPriority] = useState<PersonalTaskPriority | "">("");
  const [creator, setCreator] = useState("");
  const [sort, setSort] = useState<PersonalSort>("smart");

  const [addOpen, setAddOpen] = useState(false);
  const [openId, setOpenId] = useState("");
  const [completedOpen, setCompletedOpen] = useState(false);
  const [completedShown, setCompletedShown] = useState(COMPLETED_PAGE);
  const [completedRange, setCompletedRange] = useState<CompletedRange>("week");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [undo, setUndo] = useState<{ task: PersonalTask; until: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canEdit = board.access === "owner" || board.access === "editor";
  const isOwner = board.access === "owner";

  useEffect(() => {
    setActive(board.active);
    setCompleted(board.completed);
    setArchived(board.archived);
  }, [board]);

  // בחירת המיון האחרונה נשמרת ומוחזרת בכניסה הבאה (סעיף 8).
  useEffect(() => {
    const saved = window.localStorage.getItem(SORT_KEY);
    if (saved && saved in PERSONAL_SORT_LABEL) setSort(saved as PersonalSort);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SORT_KEY, sort);
  }, [sort]);

  useEffect(() => () => void (undoTimer.current && clearTimeout(undoTimer.current)), []);

  const creators = useMemo(
    () => Array.from(new Set([...active, ...completed].map((t) => t.createdBy ?? "").filter(Boolean))).sort(),
    [active, completed]
  );

  const visibleActive = useMemo(() => {
    const filtered = active.filter((task) => {
      if (!matchesText(task, query)) return false;
      if (priority && task.priority !== priority) return false;
      if (creator && task.createdBy !== creator) return false;
      if (view === "new") return task.status === "new" && !task.viewedAt;
      if (view === "urgent") return task.priority === "urgent";
      if (view === "today") return isDueToday(task, board.today);
      if (view === "overdue") return isOverdue(task, board.today);
      if (view === "waiting") return task.status === "waiting";
      return true;
    });
    return sortActiveTasks(filtered, board.today, sort);
  }, [active, query, priority, creator, view, board.today, sort]);

  const visibleCompleted = useMemo(() => {
    const cutoff = completedRange === "all" ? 0 : Date.now() - RANGE_MS[completedRange];
    const filtered = completed.filter((task) => {
      if (!matchesText(task, query)) return false;
      if (creator && task.createdBy !== creator) return false;
      return (task.completedAt ?? task.updatedAt ?? 0) >= cutoff;
    });
    return sortCompletedTasks(filtered);
  }, [completed, query, creator, completedRange]);

  const newCount = active.filter((t) => t.status === "new" && !t.viewedAt).length;
  const openTask = [...active, ...completed, ...archived].find((t) => t.id === openId) ?? null;
  const filtersOn = Boolean(query || priority || creator || view !== "all");

  function refresh() {
    router.refresh();
  }

  function clearFilters() {
    setQuery("");
    setPriority("");
    setCreator("");
    setView("all");
  }

  async function handleCreate(input: PersonalTaskInput): Promise<boolean> {
    const result = await createPersonalTaskAction(input);
    if (!result.ok) {
      showError(result.message);
      return false;
    }
    showSuccess("המשימה נשמרה");
    refresh();
    return true;
  }

  function handleComplete(task: PersonalTask) {
    const now = Date.now();
    const optimistic: PersonalTask = {
      ...task,
      status: "done",
      completedAt: now,
      completedBy: board.currentUser,
      pinned: false,
    };
    setActive((prev) => prev.filter((t) => t.id !== task.id));
    setCompleted((prev) => [optimistic, ...prev]);
    setOpenId((current) => (current === task.id ? "" : current));

    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo({ task, until: now + UNDO_SECONDS * 1000 });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_SECONDS * 1000);

    void completePersonalTaskAction(task.id, task.updatedAt).then((result) => {
      if (!result.ok) {
        // כישלון מחזיר את השורה למקומה - לא מוצגת הצלחה שהשרת לא אישר.
        setCompleted((prev) => prev.filter((t) => t.id !== task.id));
        setActive((prev) => [task, ...prev]);
        setUndo(null);
        showError(result.message);
        return;
      }
      refresh();
    });
  }

  /** ה"ביטול" של חלון השניות: אותה פתיחה מחדש, רק בלי לנפח את מונה הפתיחות (סעיף 10). */
  function handleUndo() {
    const pending = undo;
    if (!pending) return;
    setUndo(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setCompleted((prev) => prev.filter((t) => t.id !== pending.task.id));
    setActive((prev) => [pending.task, ...prev]);
    void reopenPersonalTaskAction(pending.task.id, "", true).then((result) => {
      if (!result.ok) showError(result.message);
      refresh();
    });
  }

  function handleReopen(task: PersonalTask) {
    setCompleted((prev) => prev.filter((t) => t.id !== task.id));
    setActive((prev) => [{ ...task, status: "open", completedAt: null, completedBy: "" }, ...prev]);
    void reopenPersonalTaskAction(task.id).then((result) => {
      if (!result.ok) showError(result.message);
      else showSuccess("המשימה חזרה לרשימה הפעילה");
      refresh();
    });
  }

  function handlePin(task: PersonalTask) {
    const pinned = !task.pinned;
    setActive((prev) => prev.map((t) => (t.id === task.id ? { ...t, pinned } : t)));
    void setPersonalTaskPinnedAction(task.id, pinned).then((result) => {
      if (!result.ok) showError(result.message);
      refresh();
    });
  }

  function handleRestore(task: PersonalTask) {
    void restorePersonalTaskAction(task.id).then((result) => {
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess("המשימה שוחזרה");
      refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {toastNode}

      {/* כותרת עליונה (סעיף 3): שם הטאב, מספר המשימות הפעילות וכפתור ההוספה. */}
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-base font-extrabold text-ink">משימות ליוני</h2>
          <span className="rounded-full bg-teal-bg px-2 py-0.5 text-xs font-extrabold text-teal-dark">{active.length} פעילות</span>
          {newCount > 0 ? (
            <span className="rounded-full border border-teal-bg bg-white px-2 py-0.5 text-xs font-bold text-teal-dark">{newCount} חדשות</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-muted">
            מיון
            <select value={sort} onChange={(e) => setSort(e.target.value as PersonalSort)} className={`mr-1 ${FIELD}`}>
              {(Object.keys(PERSONAL_SORT_LABEL) as PersonalSort[]).map((key) => (
                <option key={key} value={key}>
                  {PERSONAL_SORT_LABEL[key]}
                </option>
              ))}
            </select>
          </label>

          {canEdit ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              הוספת משימה
            </button>
          ) : null}
        </div>
      </div>

      {/* סרגל סינון (סעיף 12) */}
      <div className="card flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש בכותרת, פירוט, שם, טלפון והערות"
              className={`w-full pr-8 ${FIELD}`}
            />
          </div>

          <select value={priority} onChange={(e) => setPriority(e.target.value as PersonalTaskPriority | "")} className={FIELD}>
            <option value="">כל הדחיפויות</option>
            {PERSONAL_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PERSONAL_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>

          <select value={creator} onChange={(e) => setCreator(e.target.value)} className={FIELD}>
            <option value="">כל המזינים</option>
            {creators.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          {filtersOn ? (
            <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs font-bold text-muted hover:text-ink">
              <X className="h-3.5 w-3.5" />
              ניקוי מסננים
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {QUICK_VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              className={view === item.key ? "pill-active" : "pill-inactive"}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* הרשימה הפעילה (סעיף 7) */}
      <div className="flex flex-col gap-1.5">
        {visibleActive.length === 0 ? (
          <div className="card text-center text-sm text-muted">
            {active.length === 0 ? "אין משימות פעילות. הכול נקי." : "אין משימות שתואמות את המסננים."}
          </div>
        ) : null}

        {visibleActive.map((task) => (
          <PersonalTaskRow
            key={task.id}
            task={task}
            today={board.today}
            canEdit={canEdit}
            onOpen={(t) => setOpenId(t.id)}
            onComplete={handleComplete}
            onPin={handlePin}
          />
        ))}
      </div>

      {/* משימות שהושלמו - קבוצה מכווצת בתחתית המסך (סעיף 11) */}
      <div className="card">
        <button type="button" onClick={() => setCompletedOpen((v) => !v)} className="flex w-full items-center gap-1.5 text-right">
          {completedOpen ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronLeft className="h-4 w-4 text-muted" />}
          <span className="text-sm font-extrabold text-ink">משימות שהושלמו</span>
          <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-xs font-bold text-muted">
            {completed.length}
          </span>
        </button>

        {completedOpen ? (
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {COMPLETED_RANGES.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => {
                    setCompletedRange(range.key);
                    setCompletedShown(COMPLETED_PAGE);
                  }}
                  className={completedRange === range.key ? "pill-active" : "pill-inactive"}
                >
                  {range.label}
                </button>
              ))}
            </div>

            {visibleCompleted.length === 0 ? <p className="text-sm text-muted">אין משימות שהושלמו בטווח הזה.</p> : null}

            <div className="flex flex-col gap-1.5">
              {visibleCompleted.slice(0, completedShown).map((task) => (
                <div key={task.id} className="flex flex-col">
                  <PersonalTaskRow
                    task={task}
                    today={board.today}
                    canEdit={canEdit}
                    onOpen={(t) => setOpenId(t.id)}
                    onReopen={handleReopen}
                  />
                  {task.completedAt ? (
                    <span className="px-3 pt-0.5 text-[11px] text-muted">
                      הושלמה {formatStamp(task.completedAt)}
                      {task.completedBy ? ` · ${task.completedBy}` : ""}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {visibleCompleted.length > completedShown ? (
              <button type="button" onClick={() => setCompletedShown((n) => n + COMPLETED_PAGE)} className="btn-outline w-fit">
                הצג עוד
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* מבוטלות ומחוקות - נשארות בהיסטוריה ולעולם לא ברשימה הפעילה (קריטריון קבלה 11) */}
      {archived.length > 0 ? (
        <div className="card">
          <button type="button" onClick={() => setArchiveOpen((v) => !v)} className="flex w-full items-center gap-1.5 text-right">
            {archiveOpen ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronLeft className="h-4 w-4 text-muted" />}
            <span className="text-sm font-extrabold text-ink">בוטלו ונמחקו</span>
            <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-xs font-bold text-muted">
              {archived.length}
            </span>
          </button>

          {archiveOpen ? (
            <div className="mt-3 flex flex-col gap-1.5">
              {archived.map((task) => (
                <div key={task.id} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PersonalTaskRow task={task} today={board.today} canEdit={false} onOpen={(t) => setOpenId(t.id)} />
                  </div>
                  {isOwner && task.deletedAt ? (
                    <button
                      type="button"
                      onClick={() => handleRestore(task)}
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-card-border bg-white px-2 py-1 text-[11px] font-bold text-muted transition hover:bg-gray-50"
                    >
                      <RotateCcw className="h-3 w-3" />
                      שחזור
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* הודעת הביטול הקצרה אחרי סימון (סעיף 10) */}
      {undo ? (
        <div className="fixed bottom-5 left-1/2 z-[150] flex -translate-x-1/2 items-center gap-3 rounded-lg bg-ink px-4 py-2.5 text-sm font-bold text-white shadow-lg">
          <span>המשימה סומנה כהושלמה</span>
          <button type="button" onClick={handleUndo} className="flex items-center gap-1 text-teal-light hover:opacity-80">
            <Undo2 className="h-4 w-4" />
            ביטול
          </button>
        </div>
      ) : null}

      <QuickAdd
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={handleCreate}
        onOpenTask={(id) => {
          setAddOpen(false);
          setOpenId(id);
        }}
      />

      {openTask ? (
        <PersonalTaskPanel
          task={openTask}
          access={board.access}
          onClose={() => setOpenId("")}
          onChanged={refresh}
          onComplete={handleComplete}
        />
      ) : null}
    </div>
  );
}
