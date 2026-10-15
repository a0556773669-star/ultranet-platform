"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { X, Save, History, Trash2, MoreHorizontal, Scissors, Link2, Inbox } from "lucide-react";
import type {
  Milestone,
  MilestoneStatus,
  MilestonePriority,
  PeriodAssignment,
  PeriodType,
  Rock,
  TaskActivity,
} from "@ultranet/shared-types";
import { createsCycle, useMilestoneIndex } from "./milestone-index";
import { listMilestoneActivity } from "./actions";
import { MILESTONE_STATUSES, STATUS_LABEL, TONES, assignmentsOf, milestoneTone, type ToneContext } from "./task-status";
import { ROCK_OWNERS } from "./owners";
import { monthLabel, weekLabel } from "./date-utils";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

const PRIORITY_LABEL: Record<MilestonePriority, string> = { low: "נמוכה", normal: "רגילה", high: "גבוהה" };

const OUTCOME_LABEL: Record<string, string> = {
  open: "פתוח",
  done: "הושלם",
  missed: "לא הושלם בתקופה",
  cancelled: "בוטל",
};

const ACTION_LABEL: Record<string, string> = {
  create: "יצירה",
  update: "עריכה",
  assign: "שיבוץ לתקופה",
  unassign: "הסרה מתכנון",
  status: "שינוי סטטוס",
  complete: "השלמה",
  reopen: "פתיחה מחדש",
  cancel: "ביטול",
  move: "שינוי מבני",
  delete: "מחיקה",
  restore: "שחזור",
  decision: "החלטת ישיבה",
};

function formatDateTime(ts: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

export type MilestonePatch = {
  title?: string;
  description?: string;
  ownerName?: string;
  dueDate?: string;
  priority?: MilestonePriority;
  notes?: string;
  rockId?: string;
  /** הפעולה הבאה (אפיון המשך, סעיף 26) */
  nextAction?: string;
  /** "תלוי ב־" (סעיף 49) */
  dependsOnIds?: string[];
};

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/**
 * חלונית הצד של אבן דרך (סעיף 10) - **לא עמוד חדש**. מציגה את כל מה שידוע על אבן
 * הדרך: פרטים, שיוכים לתקופות ויומן פעולות, ומאפשרת לערוך, להעביר לתת-סלע אחר,
 * לשנות סטטוס, לבטל, לפתוח מחדש ולמחוק - הכל במקום אחד.
 *
 * סגירה עם שינויים שלא נשמרו מציגה אזהרה, כדי שלא יאבדו (סעיף 10).
 */
export function MilestonePanel({
  milestone,
  rocks,
  assignments,
  toneContext,
  readOnly,
  onClose,
  onSave,
  onStatus,
  onReopen,
  onDelete,
  onOpenMilestone,
  onSplit,
}: {
  milestone: Milestone;
  rocks: Rock[];
  assignments: PeriodAssignment[];
  toneContext: ToneContext;
  readOnly: boolean;
  onClose: () => void;
  onSave: (patch: MilestonePatch, expectedUpdatedAt: number) => Promise<boolean>;
  onStatus: (m: Milestone, status: MilestoneStatus) => void;
  onReopen: (m: Milestone) => void;
  onDelete: (m: Milestone) => void;
  /** פתיחת אבן דרך מקושרת (תלות / צעד / מקור הפיצול) באותה חלונית */
  onOpenMilestone?: (id: string) => void;
  /** פיצול לצעדים (סעיף 30) - כלי נדיר, ולכן בתפריט "עוד" */
  onSplit?: (parent: Milestone, steps: string[], assignTo: { periodType: PeriodType; periodKey: string }[]) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [ownerName, setOwnerName] = useState(milestone.ownerName ?? "");
  const [dueDate, setDueDate] = useState(milestone.dueDate ?? "");
  const [priority, setPriority] = useState<MilestonePriority>(milestone.priority ?? "normal");
  const [notes, setNotes] = useState(milestone.notes ?? "");
  const [rockId, setRockId] = useState(milestone.rockId);
  const [nextAction, setNextAction] = useState(milestone.nextAction ?? "");
  const [dependsOnIds, setDependsOnIds] = useState<string[]>(milestone.dependsOnIds ?? []);
  const [moreOpen, setMoreOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitText, setSplitText] = useState("");
  const [splitAssign, setSplitAssign] = useState(false);
  const [activity, setActivity] = useState<TaskActivity[] | null>(null);
  const index = useMilestoneIndex();
  const [isPending, startTransition] = useTransition();

  // החלונית נשארת פתוחה כשהלוח מתרענן; טעינת ערכים מחדש רק כשמדובר באבן דרך אחרת.
  useEffect(() => {
    setTitle(milestone.title);
    setDescription(milestone.description ?? "");
    setOwnerName(milestone.ownerName ?? "");
    setDueDate(milestone.dueDate ?? "");
    setPriority(milestone.priority ?? "normal");
    setNotes(milestone.notes ?? "");
    setRockId(milestone.rockId);
    setNextAction(milestone.nextAction ?? "");
    setDependsOnIds(milestone.dependsOnIds ?? []);
    setMoreOpen(false);
    setSplitOpen(false);
    setSplitText("");
    setSplitAssign(false);
    setActivity(null);
  }, [milestone.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    title !== milestone.title ||
    description !== (milestone.description ?? "") ||
    ownerName !== (milestone.ownerName ?? "") ||
    dueDate !== (milestone.dueDate ?? "") ||
    priority !== (milestone.priority ?? "normal") ||
    notes !== (milestone.notes ?? "") ||
    rockId !== milestone.rockId ||
    nextAction !== (milestone.nextAction ?? "") ||
    !sameIds(dependsOnIds, milestone.dependsOnIds ?? []);

  const tone = TONES[milestoneTone(milestone, toneContext)];
  const myAssignments = assignmentsOf(assignments, milestone.id);
  const rocksById = new Map(rocks.map((r) => [r.id, r]));

  // --- קישורים: מקור הפיצול, צעדים, תלויות ---
  const splitParent = milestone.splitFromId ? index.get(milestone.splitFromId) : undefined;
  const steps = useMemo(
    () => Array.from(index.values()).filter((m) => m.splitFromId === milestone.id && !m.deletedAt),
    [index, milestone.id]
  );
  const dependents = useMemo(
    () => Array.from(index.values()).filter((m) => !m.deletedAt && (m.dependsOnIds ?? []).includes(milestone.id)),
    [index, milestone.id]
  );
  /** מועמדות לתלות: פתוחות, לא היא עצמה, לא כבר נבחרו, ולא כאלה שייצרו מעגל. */
  const dependencyOptions = useMemo(
    () =>
      Array.from(index.values())
        .filter(
          (m) =>
            m.id !== milestone.id &&
            !m.id.startsWith("temp-") &&
            !m.deletedAt &&
            m.status !== "done" &&
            m.status !== "cancelled" &&
            !dependsOnIds.includes(m.id) &&
            !createsCycle(milestone.id, m.id, index)
        )
        .sort((a, b) => a.title.localeCompare(b.title, "he")),
    [index, milestone.id, dependsOnIds]
  );
  const openPeriods = myAssignments.filter((a) => a.outcome === "open" && a.periodType !== "quarter");
  const canSplit = !readOnly && !!onSplit && milestone.status !== "done" && milestone.status !== "cancelled";
  const splitLines = splitText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  /** מעבר לאבן דרך מקושרת באותה חלונית - עם אזהרה אם יש שינויים שלא נשמרו. */
  function openLinked(id: string) {
    if (!onOpenMilestone) return;
    if (dirty && !confirm("יש שינויים שלא נשמרו. לעבור בכל זאת?")) return;
    onOpenMilestone(id);
  }

  function linkChip(m: Milestone | undefined, id: string, onRemove?: () => void) {
    const done = m?.status === "done";
    return (
      <div key={id} className="flex items-center gap-2 rounded-lg border border-card-border bg-[#f9fafb] px-2.5 py-1.5 text-xs">
        <button
          type="button"
          onClick={() => m && openLinked(m.id)}
          disabled={!m || !onOpenMilestone}
          className="min-w-0 flex-1 truncate text-right font-normal text-ink hover:text-teal hover:underline disabled:no-underline"
        >
          {m?.title ?? "אבן דרך שאינה ברבעון המוצג"}
        </button>
        {m ? (
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
              done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700"
            }`}
          >
            {STATUS_LABEL[m.status]}
          </span>
        ) : null}
        {onRemove && !readOnly ? (
          <button type="button" onClick={onRemove} aria-label="הסרת התלות" className="shrink-0 text-muted hover:text-red-600">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    );
  }

  function handleSplit() {
    if (!splitLines.length || !onSplit) return;
    if (dirty && !confirm("יש שינויים שלא נשמרו באבן הדרך. הפיצול לא שומר אותם. להמשיך?")) return;
    // שיוכי רבעון לרבעון אחר (גלגול) עוברים תמיד, כדי שהצעדים יוצגו היכן שהמקור מוצג.
    // שיוך לחודש/שבוע - רק אם המשתמש סימן במפורש.
    const assignTo = myAssignments
      .filter((a) => a.outcome === "open")
      .filter((a) => (a.periodType === "quarter" ? a.periodKey !== milestone.quarterKey : splitAssign))
      .map((a) => ({ periodType: a.periodType, periodKey: a.periodKey }));
    startTransition(async () => {
      const ok = await onSplit(milestone, splitLines, assignTo);
      if (ok) {
        setSplitOpen(false);
        setSplitText("");
      }
    });
  }

  function handleClose() {
    if (dirty && !confirm("יש שינויים שלא נשמרו. לסגור בכל זאת?")) return;
    onClose();
  }

  function handleSave() {
    startTransition(async () => {
      const patch: MilestonePatch = { title, description, ownerName, dueDate, priority, notes, rockId };
      // שדות הרשות החדשים נשלחים רק כשהשתנו, כדי ששמירה רגילה לא תכתוב אותם למסמך קיים.
      if (nextAction !== (milestone.nextAction ?? "")) patch.nextAction = nextAction;
      if (!sameIds(dependsOnIds, milestone.dependsOnIds ?? [])) patch.dependsOnIds = dependsOnIds;
      const ok = await onSave(patch, milestone.updatedAt ?? 0);
      if (ok) setActivity(null);
    });
  }

  function loadActivity() {
    startTransition(async () => setActivity(await listMilestoneActivity(milestone.id)));
  }

  return (
    <div className="fixed inset-0 z-[150] flex" role="dialog" aria-label={`אבן דרך: ${milestone.title}`}>
      <button type="button" aria-label="סגירה" onClick={handleClose} className="flex-1 bg-black/25" />
      <aside className="flex h-full w-full max-w-[460px] flex-col overflow-y-auto border-r border-card-border bg-white shadow-xl">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-2 border-b border-card-border bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden />
              <span className="truncate text-sm font-extrabold text-ink">{milestone.title}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              נוצרה {formatDateTime(milestone.createdAt)}
              {milestone.createdBy ? ` · ${milestone.createdBy}` : ""}
              {milestone.origin === "month" ? " · נוספה במהלך החודש" : milestone.origin === "week" ? " · נוספה במהלך השבוע" : ""}
            </div>
          </div>
          <div className="relative flex shrink-0 items-center gap-1">
            {canSplit && (
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className="rounded-lg p-1 text-muted hover:bg-[#f4f6f9] hover:text-ink"
                aria-label="עוד"
                aria-expanded={moreOpen}
                title="עוד"
              >
                <MoreHorizontal className="h-4.5 w-4.5" />
              </button>
            )}
            {moreOpen && (
              <div className="absolute left-0 top-8 z-20 w-48 rounded-lg border border-card-border bg-white p-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    setSplitOpen(true);
                  }}
                  className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-right text-xs font-semibold text-ink hover:bg-[#f4f6f9]"
                >
                  <Scissors className="h-3.5 w-3.5" />
                  פיצול לצעדים
                </button>
              </div>
            )}
            <button type="button" onClick={handleClose} className="text-muted hover:text-ink" aria-label="סגירה">
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-3 p-4">
          {milestone.inbox ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-xs text-muted">
              <Inbox className="h-3.5 w-3.5 shrink-0" />
              בתיבת הקליטה - ממתין לבחירה בישיבה. לא משובץ אוטומטית לחודש או לשבוע.
            </div>
          ) : null}

          {milestone.splitFromId ? (
            <div className="rounded-lg border border-card-border bg-[#f9fafb] px-3 py-2 text-xs text-muted">
              צעד מתוך:{" "}
              {splitParent ? (
                <button type="button" onClick={() => openLinked(splitParent.id)} className="font-semibold text-teal hover:underline">
                  {splitParent.title}
                </button>
              ) : (
                "אבן דרך שאינה ברבעון המוצג"
              )}
            </div>
          ) : null}

          {splitOpen && canSplit && (
            <section className="rounded-[11px] border border-teal/40 bg-teal-bg/30 p-3">
              <div className="mb-1 text-xs font-bold text-ink">פיצול לצעדים</div>
              <p className="mb-2 text-[11px] text-muted">
                כל שורה תהפוך לאבן דרך חדשה באותו סלע, מקושרת למשימה הזו. המשימה המקורית נשמרת כמות שהיא ולא תסומן כהושלמה אוטומטית.
              </p>
              <textarea
                value={splitText}
                onChange={(e) => setSplitText(e.target.value)}
                rows={4}
                placeholder={"צעד ראשון\nצעד שני\nצעד שלישי"}
                className={FIELD}
                autoFocus
              />
              {openPeriods.length > 0 && (
                <label className="mt-2 flex items-center gap-2 text-[11px] text-ink">
                  <input
                    type="checkbox"
                    checked={splitAssign}
                    onChange={(e) => setSplitAssign(e.target.checked)}
                    className="h-4 w-4 accent-[#1a8a76]"
                  />
                  לשבץ את הצעדים גם ל
                  {openPeriods.map((a) => (a.periodType === "week" ? weekLabel(a.periodKey) : monthLabel(a.periodKey))).join(" ול")}
                </label>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSplit}
                  disabled={isPending || splitLines.length === 0}
                  className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
                >
                  {isPending ? "שומר..." : splitLines.length ? `יצירת ${splitLines.length} צעדים` : "יצירת צעדים"}
                </button>
                <button type="button" onClick={() => setSplitOpen(false)} className="text-xs font-semibold text-muted hover:underline">
                  ביטול
                </button>
              </div>
            </section>
          )}

          {/* סטטוס */}
          <section>
            <div className="mb-1.5 text-xs font-bold text-muted">סטטוס</div>
            <div className="flex flex-wrap gap-1.5">
              {MILESTONE_STATUSES.map((s) => {
                const active = milestone.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={readOnly}
                    onClick={() => (milestone.status === "done" && s !== "done" ? onReopen(milestone) : onStatus(milestone, s))}
                    className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition disabled:opacity-60 ${
                      active ? "border-teal bg-teal-bg text-teal-dark" : "border-card-border bg-white text-muted hover:bg-[#f4f6f9]"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                );
              })}
            </div>
            {milestone.status === "waiting" && milestone.waitReason ? (
              <div className="mt-2 rounded-lg border border-purple/30 bg-[#f4ecf8] px-3 py-2 text-xs text-purple">
                ממתין ל: {milestone.waitReason}
                {milestone.waitUntil ? ` · מעקב ב-${milestone.waitUntil}` : ""}
              </div>
            ) : null}
            {milestone.status === "cancelled" && milestone.cancelReason ? (
              <div className="mt-2 rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-xs text-muted">
                סיבת ביטול: {milestone.cancelReason}
              </div>
            ) : null}
            {milestone.status === "done" && milestone.doneAt ? (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                הושלם {formatDateTime(milestone.doneAt)}
                {milestone.completedBy ? ` · ${milestone.completedBy}` : ""}
              </div>
            ) : null}
          </section>

          {/* פרטים */}
          <section className="flex flex-col gap-2">
            <label className="text-xs font-bold text-muted">
              כותרת
              <input value={title} onChange={(e) => setTitle(e.target.value)} readOnly={readOnly} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="text-xs font-bold text-muted">
              תיאור
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                readOnly={readOnly}
                className={`mt-1 ${FIELD}`}
              />
            </label>
            <label className="text-xs font-bold text-muted">
              סלע ותת-סלע
              <select
                value={rockId}
                onChange={(e) => setRockId(e.target.value)}
                disabled={readOnly || milestone.source === "adhoc"}
                className={`mt-1 ${FIELD}`}
              >
                {milestone.source === "adhoc" && <option value="">משימה שוטפת (ללא סלע)</option>}
                {rocks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.parentRockId ? `${rocksById.get(r.parentRockId)?.title ?? ""} ‹ ${r.title}` : r.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <label className="flex-1 text-xs font-bold text-muted">
                אחראי
                <select value={ownerName} onChange={(e) => setOwnerName(e.target.value)} disabled={readOnly} className={`mt-1 ${FIELD}`}>
                  <option value="">ללא</option>
                  {ROCK_OWNERS.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                  {ownerName && !ROCK_OWNERS.includes(ownerName as (typeof ROCK_OWNERS)[number]) && (
                    <option value={ownerName}>{ownerName}</option>
                  )}
                </select>
              </label>
              <label className="flex-1 text-xs font-bold text-muted">
                עדיפות
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as MilestonePriority)}
                  disabled={readOnly}
                  className={`mt-1 ${FIELD}`}
                >
                  {(["low", "normal", "high"] as MilestonePriority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="text-xs font-bold text-muted">
              תאריך יעד
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} readOnly={readOnly} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="text-xs font-bold text-muted">
              הערה קצרה (מוצגת בשורה)
              <input value={notes} onChange={(e) => setNotes(e.target.value)} readOnly={readOnly} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="text-xs font-bold text-muted">
              הפעולה הבאה (רשות)
              <input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                readOnly={readOnly}
                maxLength={160}
                placeholder="למשל: להתקשר לספק ולבקש הצעת מחיר"
                className={`mt-1 ${FIELD}`}
              />
            </label>

            {/* תלוי ב־ (סעיף 49) - מידע בלבד, בלי חסימה אוטומטית */}
            <div className="text-xs font-bold text-muted">
              <div className="flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5" />
                תלוי ב־
              </div>
              <div className="mt-1 flex flex-col gap-1.5">
                {dependsOnIds.map((id) => linkChip(index.get(id), id, () => setDependsOnIds((prev) => prev.filter((x) => x !== id))))}
                {!readOnly && (
                  <select
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id) setDependsOnIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                    }}
                    className={FIELD}
                    aria-label="הוספת תלות"
                  >
                    <option value="">{dependsOnIds.length ? "הוספת תלות נוספת..." : "בחירת אבן דרך שהמשימה תלויה בה..."}</option>
                    {dependencyOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                        {m.ownerName ? ` · ${m.ownerName}` : ""}
                      </option>
                    ))}
                  </select>
                )}
                {readOnly && dependsOnIds.length === 0 && <span className="font-normal">אין תלות.</span>}
              </div>
            </div>

            {!readOnly && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!dirty || isPending}
                  className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isPending ? "שומר..." : "שמירה"}
                </button>
                {dirty && <span className="text-[11px] font-bold text-amber-600">יש שינויים שלא נשמרו</span>}
                <button
                  type="button"
                  onClick={() => onDelete(milestone)}
                  className="mr-auto flex items-center gap-1 text-xs font-semibold text-muted hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  מחיקה
                </button>
              </div>
            )}
          </section>

          {steps.length > 0 && (
            <section>
              <div className="mb-1.5 text-xs font-bold text-muted">
                צעדים ({steps.filter((m) => m.status === "done").length}/{steps.filter((m) => m.status !== "cancelled").length} הושלמו)
              </div>
              <div className="flex flex-col gap-1.5">{steps.map((m) => linkChip(m, m.id))}</div>
            </section>
          )}

          {dependents.length > 0 && (
            <section>
              <div className="mb-1.5 text-xs font-bold text-muted">משימות שתלויות בזו ({dependents.length})</div>
              <div className="flex flex-col gap-1.5">{dependents.map((m) => linkChip(m, m.id))}</div>
            </section>
          )}

          {/* שיוכים לתקופות */}
          <section>
            <div className="mb-1.5 text-xs font-bold text-muted">שיוכים לתקופות ({myAssignments.length})</div>
            {myAssignments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-card-border p-2 text-xs text-muted">עדיין לא שובצה לתקופה.</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {myAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-card-border bg-[#f9fafb] px-2.5 py-1.5 text-xs"
                  >
                    <span className="text-ink">
                      {a.periodType === "week" ? weekLabel(a.periodKey) : a.periodType === "month" ? monthLabel(a.periodKey) : "הרבעון"}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                        a.outcome === "done"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : a.outcome === "missed"
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-card-border bg-white text-muted"
                      }`}
                    >
                      {OUTCOME_LABEL[a.outcome] ?? a.outcome}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* יומן פעולות */}
          <section>
            <button
              type="button"
              onClick={() => (activity ? setActivity(null) : loadActivity())}
              className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline"
            >
              <History className="h-3.5 w-3.5" />
              {activity ? "הסתרת יומן הפעולות" : "הצגת יומן הפעולות"}
            </button>
            {activity && (
              <div className="mt-2 flex flex-col gap-1.5">
                {activity.length === 0 ? (
                  <div className="text-xs text-muted">אין עדיין רישומים.</div>
                ) : (
                  activity.map((a) => (
                    <div key={a.id} className="rounded-lg border border-card-border bg-[#f9fafb] px-2.5 py-1.5 text-[11px]">
                      <div className="flex items-center justify-between gap-2 font-bold text-ink">
                        <span>{ACTION_LABEL[a.action] ?? a.action}</span>
                        <span className="font-normal text-muted">{formatDateTime(a.at)}</span>
                      </div>
                      <div className="text-muted">
                        {a.field ? `${a.field}: ` : ""}
                        {a.oldValue ? `${a.oldValue} ← ` : ""}
                        {a.newValue}
                        {a.note ? ` · ${a.note}` : ""}
                        {a.userName ? ` · ${a.userName}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </aside>
    </div>
  );
}
