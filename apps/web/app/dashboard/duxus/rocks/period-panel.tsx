"use client";

import { useState } from "react";
import { CalendarDays, CalendarRange, ChevronLeft, Plus, Trash2 } from "lucide-react";
import type { Milestone, Rock, RockReview } from "@ultranet/shared-types";
import { ReviewPanel } from "./review-panel";
import { AddMilestoneForm } from "./add-forms";
import { rockBreadcrumb } from "./rock-lookup";
import { isAdhoc } from "./rock-tree";

const WEEKLY_AGENDA = [
  "מה נשמע?",
  "אבני הדרך של השבוע - הצלחנו?",
  "הפקת לקחים",
  "קביעת אבני דרך לשבוע הבא עם הטלת אחריות ברורה",
];

const MONTHLY_AGENDA = [
  "מה נשמע?",
  "בדיקת המשימות של החודש - האם עמדנו",
  "אם לא הגענו - למה לא?",
  "האם צריך לשנות/לעדכן את הסלע?",
  "איך נצליח לעמוד גם בחודש הבא",
  "קביעת אבני דרך לחודש הבא עם הטלת אחריות ברורה",
  "בחירת אבני דרך מתוכן לשבוע הקרוב",
];

type Level = "week" | "month";

const COPY = {
  week: {
    icon: CalendarDays,
    title: "המשימות של השבוע",
    openFirst: "פתיחת השבוע הראשון",
    openNext: "פתיחת שבוע חדש",
    empty: "עוד לא נפתח שבוע ברבעון הזה. פותחים שבוע ומושכים אליו את אבני הדרך של החודש.",
    noTasks: "אין עדיין משימות לשבוע הזה - מושכים אבני דרך מהחודש או מוסיפים משימה שוטפת.",
    pull: "הוספה מאבני הדרך של החודש",
    overdue: "לא הושלמו משבועות קודמים",
    carry: "העבר לשבוע הנוכחי",
    previous: "שבועות קודמים ברבעון",
    addTask: "הוסף משימה שבועית/שוטפת",
    reviewTitle: "פגישה שבועית",
    agenda: WEEKLY_AGENDA,
    period: "weekly" as const,
  },
  month: {
    icon: CalendarRange,
    title: "המשימות של החודש",
    openFirst: "פתיחת החודש הראשון",
    openNext: "פתיחת חודש חדש",
    empty: "עוד לא נפתח חודש ברבעון הזה. פותחים חודש ומושכים אליו אבני דרך מהרבעון.",
    noTasks: "אין עדיין משימות לחודש הזה - מושכים אבני דרך מהרבעון או מוסיפים משימה שוטפת.",
    pull: "הוספה מאבני הדרך של הרבעון",
    overdue: "לא הושלמו מחודשים קודמים",
    carry: "העבר לחודש הנוכחי",
    previous: "חודשים קודמים ברבעון",
    addTask: "הוסף משימה שוטפת לחודש",
    reviewTitle: "פגישה חודשית",
    agenda: MONTHLY_AGENDA,
    period: "monthly" as const,
  },
};

/**
 * קומת תקופה בלוח העבודה - שבוע או חודש, אותו רכיב בדיוק. הקומות מוצגות זו מעל
 * זו (שבוע ➔ חודש ➔ רבעון) כדי שהמשימות הפעילות תמיד יהיו בראש המסך, במקום
 * לפזר אותן בין טאבים.
 *
 * "פתיחת תקופה חדשה" לא מוחקת ולא נועלת את הקודמת - היא יורדת ל"תקופות קודמות"
 * בתוך אותה קומה, ואבני הדרך שלה ממשיכות להופיע ברמת החודש/רבעון כל עוד הרבעון
 * פעיל (כולל התג שמראה באיזה דלי הן נמצאות).
 */
export function PeriodPanel({
  level,
  periodKey,
  periodLabel,
  rocksById,
  readOnly,
  tasks,
  pullCandidates,
  overdue,
  previousPeriods,
  reviewNotes,
  previousReviews,
  isPending,
  onOpenNext,
  onToggleDone,
  onDelete,
  onCarryOver,
  onPull,
  onAddTask,
  badgeFor,
}: {
  level: Level;
  /** ריק = עוד לא נפתחה תקופה כזו ברבעון */
  periodKey: string;
  periodLabel: string;
  rocksById: Map<string, Rock>;
  readOnly: boolean;
  tasks: Milestone[];
  pullCandidates: Milestone[];
  overdue: Milestone[];
  previousPeriods: { key: string; label: string; tasks: Milestone[] }[];
  reviewNotes: string;
  previousReviews: RockReview[];
  isPending: boolean;
  onOpenNext: () => void;
  onToggleDone: (id: string) => void;
  onDelete: (id: string) => void;
  onCarryOver: (m: Milestone) => void;
  onPull: (ids: string[]) => void;
  onAddTask: (title: string, ownerName: string) => void;
  /** תג נוסף על משימה - למשל "בשבוע" בקומת החודש, כדי לראות לאן היא כבר קודמה */
  badgeFor?: (m: Milestone) => string | null;
}) {
  const copy = COPY[level];
  const Icon = copy.icon;
  const [openPull, setOpenPull] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const doneCount = tasks.filter((t) => t.done).length;

  function togglePicked(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePull() {
    if (!picked.size) return;
    onPull(Array.from(picked));
    setPicked(new Set());
    setOpenPull(false);
  }

  function taskRow(m: Milestone, interactive: boolean) {
    const pending = m.id.startsWith("temp-");
    return (
      <div
        key={m.id}
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
          m.done ? "border-emerald-200 bg-emerald-50" : "border-card-border bg-white"
        } ${pending ? "opacity-60" : ""}`}
      >
        <input
          type="checkbox"
          checked={m.done}
          disabled={readOnly || pending || !interactive}
          onChange={() => onToggleDone(m.id)}
          className="h-4 w-4 accent-emerald-600"
        />
        <div className="flex-1">
          <div className={m.done ? "text-emerald-800 line-through" : "text-ink"}>{m.title}</div>
          <div className="text-[11px] text-muted">{rockBreadcrumb(m.rockId, rocksById)}</div>
        </div>
        {badgeFor?.(m) ? (
          <span className="shrink-0 rounded-full border border-teal bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">
            {badgeFor(m)}
          </span>
        ) : null}
        {isAdhoc(m) && (
          <span className="shrink-0 rounded-full border border-purple bg-[#f4ecf8] px-2 py-0.5 text-[11px] font-bold text-purple">
            שוטף
          </span>
        )}
        {m.carryOverCount ? (
          <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
            גולגל {m.carryOverCount}
          </span>
        ) : null}
        {m.ownerName ? <span className="shrink-0 text-[11px] text-muted">{m.ownerName}</span> : null}
        {!readOnly && interactive && (
          <button type="button" onClick={() => onDelete(m.id)} className="shrink-0 text-muted hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <section className="card mb-4 border-r-4 border-r-teal">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
          <Icon className="h-4.5 w-4.5" />
          {copy.title}
          {periodKey ? <span className="text-sm font-semibold text-muted">· {periodLabel}</span> : null}
          {periodKey && tasks.length > 0 ? (
            <span className="text-[11px] font-semibold text-muted">
              ({doneCount}/{tasks.length})
            </span>
          ) : null}
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={onOpenNext}
            disabled={isPending}
            className="flex items-center gap-1 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {periodKey ? copy.openNext : copy.openFirst}
          </button>
        )}
      </div>

      {!periodKey ? (
        <div className="text-sm text-muted">{copy.empty}</div>
      ) : (
        <>
          <ReviewPanel
            period={copy.period}
            periodKey={periodKey}
            title={copy.reviewTitle}
            agenda={copy.agenda}
            initialNotes={reviewNotes}
            previousReviews={previousReviews}
            readOnly={readOnly}
          />

          {overdue.length > 0 && !readOnly && (
            <div className="mb-3 rounded-[11px] border border-amber-300 bg-amber-50/60 p-3">
              <h3 className="mb-2 text-xs font-bold text-amber-800">{copy.overdue}</h3>
              <div className="flex flex-col gap-2">
                {overdue.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm"
                  >
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
                      onClick={() => onCarryOver(m)}
                      disabled={isPending}
                      className="shrink-0 rounded-lg border border-teal bg-teal-bg px-3 py-1.5 text-xs font-bold text-teal-dark hover:opacity-90 disabled:opacity-60"
                    >
                      {copy.carry}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="text-sm text-muted">{copy.noTasks}</div>
          ) : (
            <div className="flex flex-col gap-2">{tasks.map((m) => taskRow(m, true))}</div>
          )}

          {!readOnly && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {pullCandidates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenPull((v) => !v)}
                  className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {copy.pull} ({pullCandidates.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpenAdd((v) => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                {copy.addTask}
              </button>
            </div>
          )}

          {openAdd && !readOnly && (
            <div className="mt-2">
              <AddMilestoneForm
                placeholder="מה צריך לעשות?"
                onSubmit={(title, ownerName) => {
                  onAddTask(title, ownerName);
                  setOpenAdd(false);
                }}
                onCancel={() => setOpenAdd(false)}
              />
            </div>
          )}

          {openPull && !readOnly && (
            <div className="mt-2 rounded-lg border border-dashed border-card-border p-3">
              <div className="flex flex-col gap-1.5">
                {pullCandidates.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={picked.has(m.id)}
                      onChange={() => togglePicked(m.id)}
                      className="h-4 w-4 accent-teal"
                    />
                    <div className="flex-1">
                      <div className="text-ink">{m.title}</div>
                      <div className="text-[11px] text-muted">{rockBreadcrumb(m.rockId, rocksById)}</div>
                    </div>
                    {m.ownerName ? <span className="text-[11px] text-muted">{m.ownerName}</span> : null}
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={handlePull}
                disabled={isPending || !picked.size}
                className="mt-2 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
              >
                הוספה ({picked.size})
              </button>
            </div>
          )}

          {previousPeriods.length > 0 && (
            <details className="mt-3 rounded-lg border border-card-border bg-[#f9fafb] p-3">
              <summary className="cursor-pointer text-xs font-bold text-muted">
                {copy.previous} ({previousPeriods.length})
              </summary>
              <div className="mt-2 flex flex-col gap-3">
                {previousPeriods.map((p) => (
                  <div key={p.key}>
                    <div className="mb-1 text-[11px] font-bold text-muted">
                      {p.label} · {p.tasks.filter((t) => t.done).length}/{p.tasks.length} הושלמו
                    </div>
                    <div className="flex flex-col gap-1.5">{p.tasks.map((m) => taskRow(m, true))}</div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </section>
  );
}
