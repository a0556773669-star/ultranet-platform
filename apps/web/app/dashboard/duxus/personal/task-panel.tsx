"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Copy, History, Phone, Save, Trash2, X } from "lucide-react";
import type {
  PersonalTask,
  PersonalTaskAccess,
  PersonalTaskComment,
  PersonalTaskPriority,
  PersonalTaskStatus,
  TaskActivity,
} from "@ultranet/shared-types";
import {
  PERSONAL_ACTIVE_STATUSES,
  PERSONAL_PRIORITIES,
  PERSONAL_PRIORITY_LABEL,
  PERSONAL_STATUS_LABEL,
  formatStamp,
  telHref,
} from "./personal-task-ui";
import {
  addPersonalCommentAction,
  cancelPersonalTaskAction,
  deletePersonalTaskAction,
  listPersonalActivity,
  listPersonalComments,
  markPersonalTaskViewedAction,
  setPersonalTaskStatusAction,
  updatePersonalTaskAction,
  type PersonalTaskInput,
} from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

const ACTION_LABEL: Record<string, string> = {
  create: "נוצרה",
  update: "עריכה",
  status: "שינוי סטטוס",
  complete: "הושלמה",
  reopen: "נפתחה מחדש",
  cancel: "בוטלה",
  delete: "נמחקה",
  restore: "שוחזרה",
  view: "נפתחה לראשונה",
  comment: "הערה",
};

/**
 * חלונית פרטי משימה (סעיף 14) - עריכה, הערות כרונולוגיות, היסטוריית שינויים
 * ופעולות. ההערות וההיסטוריה נטענות **רק כשנפתחת החלונית**, כדי שרשימה של מאות
 * משימות לא תשלוף את כל השרשורים מראש.
 */
export function PersonalTaskPanel({
  task,
  access,
  onClose,
  onChanged,
  onComplete,
}: {
  task: PersonalTask;
  access: PersonalTaskAccess;
  onClose: () => void;
  onChanged: () => void;
  onComplete: (task: PersonalTask) => void;
}) {
  const canEdit = access === "owner" || access === "editor";
  const isOwner = access === "owner";
  const done = task.status === "done";
  const cancelled = task.status === "cancelled";
  // משימה שהושלמה ניתנת לעריכה על ידי בעל הרשימה בלבד (סעיף 17).
  const canEditFields = canEdit && (!done || isOwner) && !cancelled;

  const [form, setForm] = useState<PersonalTaskInput>({
    title: task.title,
    description: task.description ?? "",
    contactName: task.contactName ?? "",
    contactPhone: task.contactPhone ?? "",
    priority: task.priority,
    dueDate: task.dueDate ?? "",
    dueTime: task.dueTime ?? "",
  });
  const [comments, setComments] = useState<PersonalTaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setForm({
      title: task.title,
      description: task.description ?? "",
      contactName: task.contactName ?? "",
      contactPhone: task.contactPhone ?? "",
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      dueTime: task.dueTime ?? "",
    });
    setMessage("");
    setShowHistory(false);
    listPersonalComments(task.id).then(setComments).catch(() => setComments([]));
    // הפתיחה הראשונה נרשמת ביומן ומסירה את חיווי "חדש" - בלי לשנות סטטוס ל"בטיפול".
    // רק פתיחה **ראשונה** משנה דבר, ולכן רק היא מרעננת את הרשימה.
    if (!task.viewedAt) void markPersonalTaskViewedAction(task.id).then(() => onChanged());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  function set<K extends keyof PersonalTaskInput>(key: K, value: PersonalTaskInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function run(fn: () => Promise<{ ok: true } | { ok: false; message: string }>, success = "") {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage(success);
      onChanged();
    });
  }

  function save() {
    if (!form.title?.trim()) {
      setMessage("יש להזין כותרת למשימה");
      return;
    }
    run(() => updatePersonalTaskAction(task.id, form, task.updatedAt), "השינויים נשמרו");
  }

  function cancelTask() {
    const reason = window.prompt("סיבת הביטול:");
    if (reason === null) return;
    if (!reason.trim()) {
      setMessage("יש להזין סיבת ביטול");
      return;
    }
    run(() => cancelPersonalTaskAction(task.id, reason, task.updatedAt));
  }

  function remove() {
    if (!window.confirm("למחוק את המשימה? היא תוסר מהרשימה אך תישמר להיסטוריה ולשחזור.")) return;
    startTransition(async () => {
      const result = await deletePersonalTaskAction(task.id);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      onChanged();
      onClose();
    });
  }

  function addComment() {
    const body = newComment.trim();
    if (!body) return;
    startTransition(async () => {
      const result = await addPersonalCommentAction(task.id, body);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setNewComment("");
      setComments(await listPersonalComments(task.id));
      onChanged();
    });
  }

  function toggleHistory() {
    const next = !showHistory;
    setShowHistory(next);
    if (next && activity.length === 0) {
      listPersonalActivity(task.id).then(setActivity).catch(() => setActivity([]));
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex justify-start bg-black/30" role="dialog" aria-modal="true">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-card-border bg-white p-4 shadow-card">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-base font-extrabold text-ink">{task.title}</h2>
            <p className="text-[11px] text-muted">
              {PERSONAL_STATUS_LABEL[task.status]}
              {task.createdBy ? ` · נוצר על ידי ${task.createdBy}` : ""}
              {task.createdAt ? ` · ${formatStamp(task.createdAt)}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="rounded-md p-1 text-muted transition hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {message ? <p className="mb-2 rounded-lg bg-[#f4f6f9] px-3 py-2 text-xs font-bold text-ink">{message}</p> : null}

        {done ? (
          <p className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            הושלמה {formatStamp(task.completedAt)}
            {task.completedBy ? ` · ${task.completedBy}` : ""}
          </p>
        ) : null}
        {cancelled ? (
          <p className="mb-2 rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-xs font-bold text-muted">
            בוטלה {formatStamp(task.cancelledAt)}
            {task.cancelReason ? ` · ${task.cancelReason}` : ""}
          </p>
        ) : null}

        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-bold text-muted">
            כותרת
            <input value={form.title} onChange={(e) => set("title", e.target.value)} disabled={!canEditFields} className={`mt-1 ${FIELD}`} />
          </label>

          <label className="text-xs font-bold text-muted">
            פירוט
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              disabled={!canEditFields}
              className={`mt-1 ${FIELD}`}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold text-muted">
              שם הפונה
              <input
                value={form.contactName}
                onChange={(e) => set("contactName", e.target.value)}
                disabled={!canEditFields}
                className={`mt-1 ${FIELD}`}
              />
            </label>
            <label className="text-xs font-bold text-muted">
              טלפון
              <input
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                disabled={!canEditFields}
                dir="ltr"
                inputMode="tel"
                className={`mt-1 ${FIELD} text-right`}
              />
            </label>
          </div>

          {task.contactPhone ? (
            <div className="flex items-center gap-2">
              <a
                href={telHref(task.contactPhone)}
                className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2.5 py-1 text-xs font-bold text-teal-dark transition hover:bg-gray-50"
              >
                <Phone className="h-3.5 w-3.5" />
                חיוג
              </a>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(task.contactPhone ?? "").then(() => setMessage("המספר הועתק"))}
                className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2.5 py-1 text-xs font-bold text-muted transition hover:bg-gray-50"
              >
                <Copy className="h-3.5 w-3.5" />
                העתקה
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs font-bold text-muted">
              דחיפות
              <select
                value={form.priority}
                onChange={(e) => set("priority", e.target.value as PersonalTaskPriority)}
                disabled={!canEditFields}
                className={`mt-1 ${FIELD}`}
              >
                {PERSONAL_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PERSONAL_PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-muted">
              תאריך יעד
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => set("dueDate", e.target.value)}
                disabled={!canEditFields}
                className={`mt-1 ${FIELD}`}
              />
            </label>
            <label className="text-xs font-bold text-muted">
              שעה
              <input
                type="time"
                value={form.dueTime}
                onChange={(e) => set("dueTime", e.target.value)}
                disabled={!canEditFields || !form.dueDate}
                className={`mt-1 ${FIELD} disabled:opacity-50`}
              />
            </label>
          </div>

          {canEdit && !done && !cancelled ? (
            <label className="text-xs font-bold text-muted">
              סטטוס
              <select
                value={task.status}
                onChange={(e) => run(() => setPersonalTaskStatusAction(task.id, e.target.value as PersonalTaskStatus, "", task.updatedAt))}
                className={`mt-1 ${FIELD}`}
              >
                {PERSONAL_ACTIVE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PERSONAL_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {canEditFields ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                שמירה
              </button>
              {!done ? (
                <button type="button" onClick={() => onComplete(task)} disabled={isPending} className="btn-outline flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  סימון כהושלם
                </button>
              ) : null}
              <button type="button" onClick={cancelTask} disabled={isPending} className="btn-outline">
                ביטול המשימה
              </button>
              {isOwner ? (
                <button
                  type="button"
                  onClick={remove}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  מחיקה
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 border-t border-card-border pt-3">
          <h3 className="mb-2 text-sm font-extrabold text-ink">הערות</h3>
          <div className="flex flex-col gap-1.5">
            {comments.length === 0 ? <p className="text-xs text-muted">אין עדיין הערות.</p> : null}
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2">
                <p className="text-sm text-ink">{c.body}</p>
                <p className="text-[11px] text-muted">
                  {c.createdBy}
                  {c.createdBy && c.createdAt ? " · " : ""}
                  {formatStamp(c.createdAt)}
                </p>
              </div>
            ))}
          </div>

          {canEdit ? (
            <div className="mt-2 flex items-start gap-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
                placeholder="הוספת הערה"
                className={FIELD}
              />
              <button type="button" onClick={addComment} disabled={isPending || !newComment.trim()} className="btn-outline shrink-0">
                הוספה
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-5 border-t border-card-border pt-3">
          <button type="button" onClick={toggleHistory} className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <History className="h-4 w-4" />
            היסטוריית שינויים
            <span className="text-[11px] font-bold text-muted">{showHistory ? "הסתרה" : "הצגה"}</span>
          </button>

          {showHistory ? (
            <div className="mt-2 flex flex-col gap-1">
              {activity.length === 0 ? <p className="text-xs text-muted">טוען...</p> : null}
              {activity.map((a) => (
                <div key={a.id} className="flex flex-wrap items-baseline gap-1 text-[11px] text-muted">
                  <span className="font-bold text-ink">{ACTION_LABEL[a.action] ?? a.action}</span>
                  {a.field ? <span>· {a.field}</span> : null}
                  {a.oldValue || a.newValue ? (
                    <span>
                      · {a.oldValue || "—"} ← {a.newValue || "—"}
                    </span>
                  ) : null}
                  {a.note ? <span>· {a.note}</span> : null}
                  <span>· {a.userName}</span>
                  <span>· {formatStamp(a.at)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
