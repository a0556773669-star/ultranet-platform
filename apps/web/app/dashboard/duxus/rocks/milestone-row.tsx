"use client";

import type { ReactNode } from "react";
import { Check, RotateCcw } from "lucide-react";
import type { Milestone, MilestoneStatus } from "@ultranet/shared-types";
import { MILESTONE_STATUSES, STATUS_LABEL, STATUS_SHORT, TONES, milestoneTone, type ToneContext } from "./task-status";

/**
 * שורת אבן דרך - הרכיב היחיד שמצייר משימה בכל המסכים (שבוע, חודש, רבעון, ארכיון),
 * כדי שהתצוגה והפעולות יהיו זהות בכל מקום.
 *
 * העיצוב לפי סעיף 9 באפיון: **בלי לצבוע שורה שלמה בצבע חזק** - פס צד דק, נקודה
 * ותג קטן בלבד. כל הפעולות הנפוצות זמינות מהשורה עצמה (סעיף 13): סימון בוצע,
 * שינוי סטטוס, אחראי והערה קצרה - בלי לפתוח חלון.
 */
export function MilestoneRow({
  milestone,
  toneContext,
  breadcrumb,
  selectable = false,
  selected = false,
  onSelect,
  onOpen,
  onStatus,
  onComplete,
  onReopen,
  readOnly = false,
  extraBadges,
  dense = false,
}: {
  milestone: Milestone;
  toneContext: ToneContext;
  breadcrumb?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onOpen?: (m: Milestone) => void;
  onStatus?: (m: Milestone, status: MilestoneStatus) => void;
  onComplete?: (m: Milestone) => void;
  onReopen?: (m: Milestone) => void;
  readOnly?: boolean;
  extraBadges?: ReactNode;
  /** שורה צפופה לרשימות ארוכות (מצב ישיבה, ארכיון) */
  dense?: boolean;
}) {
  const tone = TONES[milestoneTone(milestone, toneContext)];
  const done = milestone.status === "done";
  const cancelled = milestone.status === "cancelled";
  const pending = milestone.id.startsWith("temp-");

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-card-border border-r-[3px] bg-white ${tone.side} ${
        dense ? "px-2.5 py-1.5" : "px-3 py-2"
      } text-sm ${pending ? "opacity-60" : ""} ${selected ? "ring-1 ring-teal" : ""}`}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onSelect?.(milestone.id)}
          aria-label={`בחירת ${milestone.title}`}
          className="h-4 w-4 shrink-0 accent-[#1a8a76]"
        />
      )}

      {/* סימון "הושלם" בלחיצה אחת. לחיצה נוספת אינה מבטלת מיד - היא פותחת פעולת
          "פתיחה מחדש" מפורשת, כדי למנוע ביטול בטעות (סעיף 7.5). */}
      {!readOnly && onComplete && (
        <button
          type="button"
          onClick={() => (done ? onReopen?.(milestone) : onComplete(milestone))}
          title={done ? "פתיחה מחדש" : "סימון כהושלם"}
          aria-label={done ? "פתיחה מחדש" : "סימון כהושלם"}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition ${
            done ? "border-emerald-400 bg-emerald-500 text-white" : "border-card-border bg-white text-transparent hover:border-teal"
          }`}
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}

      <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`} aria-hidden />

      <button
        type="button"
        onClick={() => onOpen?.(milestone)}
        className="flex min-w-0 flex-1 flex-col items-start text-right"
      >
        <span className={`truncate ${cancelled ? "text-muted line-through" : done ? "text-muted" : "text-ink"}`}>
          {milestone.title}
        </span>
        {(breadcrumb || milestone.notes) && (
          <span className="truncate text-[11px] text-muted">
            {breadcrumb}
            {breadcrumb && milestone.notes ? " · " : ""}
            {milestone.notes}
          </span>
        )}
      </button>

      <div className="flex shrink-0 items-center gap-1.5">
        {extraBadges}
        {milestone.reopenCount ? (
          <span className="flex items-center gap-0.5 rounded-full border border-card-border bg-[#f4f6f9] px-1.5 py-0.5 text-[11px] font-bold text-muted" title="נפתחה מחדש">
            <RotateCcw className="h-3 w-3" />
            {milestone.reopenCount}
          </span>
        ) : null}
        {milestone.carryOverCount ? (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700" title="שובצה מחדש">
            נדחה {milestone.carryOverCount}
          </span>
        ) : null}
        {milestone.dueDate ? (
          <span className={`rounded-full border px-1.5 py-0.5 text-[11px] font-bold ${tone.badge}`}>{milestone.dueDate.slice(5)}</span>
        ) : null}
        {milestone.ownerName ? <span className="text-[11px] text-muted">{milestone.ownerName}</span> : null}

        {readOnly || !onStatus ? (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone.badge}`}>
            {STATUS_SHORT[milestone.status]}
          </span>
        ) : (
          <select
            value={milestone.status}
            onChange={(e) => onStatus(milestone, e.target.value as MilestoneStatus)}
            aria-label={`סטטוס ${milestone.title}`}
            className={`rounded-full border px-2 py-0.5 text-[11px] font-bold focus:outline-none ${tone.badge}`}
          >
            {MILESTONE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
