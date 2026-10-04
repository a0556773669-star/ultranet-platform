"use client";

import { Check, Phone, Pin, RotateCcw, User } from "lucide-react";
import type { PersonalTask } from "@ultranet/shared-types";
import {
  PERSONAL_PRIORITY_BADGE,
  PERSONAL_PRIORITY_LABEL,
  PERSONAL_STATUS_BADGE,
  PERSONAL_STATUS_LABEL,
  formatDue,
  isDueToday,
  isOverdue,
} from "./personal-task-ui";

/**
 * שורת משימה - הרכיב היחיד שמצייר משימה, גם ברשימה הפעילה וגם בקבוצת המושלמות.
 *
 * העיצוב לפי סעיף 13: **החיווי רגוע**. אין צביעה של שורה שלמה - רק פס צד דק
 * באדום עדין למשימה באיחור, תג קטן לדחיפות, ונקודת "חדש" עד שיוני פתח אותה.
 */
export function PersonalTaskRow({
  task,
  today,
  canEdit,
  onOpen,
  onComplete,
  onReopen,
  onPin,
}: {
  task: PersonalTask;
  today: string;
  canEdit: boolean;
  onOpen: (task: PersonalTask) => void;
  onComplete?: (task: PersonalTask) => void;
  onReopen?: (task: PersonalTask) => void;
  onPin?: (task: PersonalTask) => void;
}) {
  const done = task.status === "done";
  const cancelled = task.status === "cancelled";
  const overdue = isOverdue(task, today);
  const dueToday = isDueToday(task, today);
  const isNew = task.status === "new" && !task.viewedAt;
  const pending = task.id.startsWith("temp-");

  const side = overdue ? "border-r-red-300" : task.pinned ? "border-r-teal" : "border-r-card-border";
  const dueBadge = overdue
    ? "border-red-200 bg-red-50 text-red-700"
    : dueToday
      ? "border-teal-bg bg-teal-bg font-extrabold text-teal-dark"
      : "border-card-border bg-[#f4f6f9] text-muted";

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-card-border border-r-[3px] bg-white px-3 py-2 text-sm ${side} ${
        pending ? "opacity-60" : ""
      }`}
    >
      {/* סעיף 10: סימון ביצוע בלחיצה אחת. בקבוצת המושלמות אין "ביטול סימון" בתיבה
          עצמה (סעיף 11) - שם יש כפתור "פתיחה מחדש" מפורש. */}
      {canEdit && !done && !cancelled && onComplete ? (
        <button
          type="button"
          onClick={() => onComplete(task)}
          title="סימון כהושלם"
          aria-label={`סימון ${task.title} כהושלם`}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border border-card-border bg-white text-transparent transition hover:border-teal hover:text-teal/40"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border ${
            done ? "border-emerald-400 bg-emerald-500 text-white" : "border-card-border bg-[#f4f6f9] text-transparent"
          }`}
          aria-hidden
        >
          <Check className="h-3.5 w-3.5" />
        </span>
      )}

      {isNew ? <span className="h-2 w-2 shrink-0 rounded-full bg-teal" title="משימה חדשה" aria-label="משימה חדשה" /> : null}

      <button type="button" onClick={() => onOpen(task)} className="flex min-w-0 flex-1 flex-col items-start text-right">
        <span className="flex w-full items-center gap-1.5">
          {task.pinned ? <Pin className="h-3 w-3 shrink-0 text-teal" aria-label="מוצמדת" /> : null}
          <span className={`truncate ${cancelled ? "text-muted line-through" : done ? "text-muted" : "text-ink"}`}>{task.title}</span>
          {isNew ? (
            <span className="shrink-0 rounded-full bg-teal-bg px-1.5 py-0.5 text-[10px] font-extrabold text-teal-dark">חדש</span>
          ) : null}
        </span>

        {task.contactName || task.contactPhone || task.lastNote ? (
          <span className="flex w-full items-center gap-1.5 truncate text-[11px] text-muted">
            {task.contactName ? (
              <span className="flex shrink-0 items-center gap-0.5">
                <User className="h-3 w-3" />
                {task.contactName}
              </span>
            ) : null}
            {task.contactPhone ? (
              <span className="flex shrink-0 items-center gap-0.5" dir="ltr">
                <Phone className="h-3 w-3" />
                {task.contactPhone}
              </span>
            ) : null}
            {task.lastNote ? <span className="truncate">· {task.lastNote}</span> : null}
          </span>
        ) : null}
      </button>

      <div className="flex shrink-0 items-center gap-1.5">
        {task.reopenCount ? (
          <span
            className="flex items-center gap-0.5 rounded-full border border-card-border bg-[#f4f6f9] px-1.5 py-0.5 text-[11px] font-bold text-muted"
            title="נפתחה מחדש"
          >
            <RotateCcw className="h-3 w-3" />
            {task.reopenCount}
          </span>
        ) : null}

        {task.priority !== "normal" ? (
          <span className={`rounded-full border px-1.5 py-0.5 text-[11px] font-bold ${PERSONAL_PRIORITY_BADGE[task.priority]}`}>
            {PERSONAL_PRIORITY_LABEL[task.priority]}
          </span>
        ) : null}

        {task.dueDate ? (
          <span className={`rounded-full border px-1.5 py-0.5 text-[11px] font-bold ${dueBadge}`} title={overdue ? "באיחור" : "תאריך יעד"}>
            {formatDue(task)}
          </span>
        ) : null}

        {task.status === "waiting" || task.status === "in_progress" ? (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${PERSONAL_STATUS_BADGE[task.status]}`}>
            {PERSONAL_STATUS_LABEL[task.status]}
          </span>
        ) : null}

        {task.createdBy ? <span className="hidden text-[11px] text-muted sm:inline">{task.createdBy}</span> : null}

        {canEdit && onPin && !done && !cancelled ? (
          <button
            type="button"
            onClick={() => onPin(task)}
            title={task.pinned ? "ביטול הצמדה" : "הצמדה לראש הרשימה"}
            aria-label={task.pinned ? "ביטול הצמדה" : "הצמדה לראש הרשימה"}
            className={`rounded-md p-1 transition hover:bg-gray-100 ${task.pinned ? "text-teal" : "text-muted"}`}
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {canEdit && done && onReopen ? (
          <button
            type="button"
            onClick={() => onReopen(task)}
            className="rounded-lg border border-card-border bg-white px-2 py-1 text-[11px] font-bold text-muted transition hover:bg-gray-50"
          >
            פתיחה מחדש
          </button>
        ) : null}
      </div>
    </div>
  );
}
