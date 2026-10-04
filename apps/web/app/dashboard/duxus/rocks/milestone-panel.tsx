"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Save, History, Trash2 } from "lucide-react";
import type { Milestone, MilestoneStatus, MilestonePriority, PeriodAssignment, Rock, TaskActivity } from "@ultranet/shared-types";
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
};

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
}) {
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [ownerName, setOwnerName] = useState(milestone.ownerName ?? "");
  const [dueDate, setDueDate] = useState(milestone.dueDate ?? "");
  const [priority, setPriority] = useState<MilestonePriority>(milestone.priority ?? "normal");
  const [notes, setNotes] = useState(milestone.notes ?? "");
  const [rockId, setRockId] = useState(milestone.rockId);
  const [activity, setActivity] = useState<TaskActivity[] | null>(null);
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
    setActivity(null);
  }, [milestone.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty =
    title !== milestone.title ||
    description !== (milestone.description ?? "") ||
    ownerName !== (milestone.ownerName ?? "") ||
    dueDate !== (milestone.dueDate ?? "") ||
    priority !== (milestone.priority ?? "normal") ||
    notes !== (milestone.notes ?? "") ||
    rockId !== milestone.rockId;

  const tone = TONES[milestoneTone(milestone, toneContext)];
  const myAssignments = assignmentsOf(assignments, milestone.id);
  const rocksById = new Map(rocks.map((r) => [r.id, r]));

  function handleClose() {
    if (dirty && !confirm("יש שינויים שלא נשמרו. לסגור בכל זאת?")) return;
    onClose();
  }

  function handleSave() {
    startTransition(async () => {
      const ok = await onSave({ title, description, ownerName, dueDate, priority, notes, rockId }, milestone.updatedAt ?? 0);
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
          <button type="button" onClick={handleClose} className="shrink-0 text-muted hover:text-ink" aria-label="סגירה">
            <X className="h-4.5 w-4.5" />
          </button>
        </header>

        <div className="flex flex-col gap-3 p-4">
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
