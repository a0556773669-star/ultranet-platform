"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Save, Lock, LockOpen } from "lucide-react";
import type { RockReview, RockReviewPeriod } from "@ultranet/shared-types";
import { saveReviewAction } from "./actions";
import { useToast } from "@/lib/toast";
import { ROCK_OWNERS } from "./owners";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

/**
 * סיכום הישיבה של התקופה (`Meeting` באפיון): מבנה מומלץ, משתתפים, תאריך וסיכום.
 * ישיבה אפשר לנעול - נעילה הופכת את הסיכום לסופי עד שנפתח מחדש במפורש.
 */
export function ReviewPanel({
  period,
  periodKey,
  title,
  agenda,
  initialNotes,
  initialParticipants = [],
  initialMeetingDate = "",
  initialLocked = false,
  previousReviews,
  readOnly = false,
}: {
  period: RockReviewPeriod;
  periodKey: string;
  title: string;
  agenda: string[];
  initialNotes: string;
  initialParticipants?: string[];
  initialMeetingDate?: string;
  initialLocked?: boolean;
  previousReviews: RockReview[];
  /** רבעון בארכיון - הסיכום מוצג אך לא ניתן לעריכה */
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [participants, setParticipants] = useState<string[]>(initialParticipants);
  const [meetingDate, setMeetingDate] = useState(initialMeetingDate);
  const [locked, setLocked] = useState(initialLocked);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError, toastNode } = useToast();

  const frozen = readOnly || locked;

  function save(nextLocked = locked) {
    startTransition(async () => {
      const result = await saveReviewAction(period, periodKey, { notes, participants, meetingDate, locked: nextLocked });
      if (!result.ok) {
        showError(result.message);
        return;
      }
      setLocked(nextLocked);
      showSuccess(nextLocked ? "הישיבה נשמרה וננעלה" : "הסיכום נשמר");
    });
  }

  function toggleParticipant(name: string) {
    setParticipants((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
  }

  return (
    <div className="card mb-4">
      {toastNode}
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-right">
        <span className="flex items-center gap-2 text-sm font-bold text-ink">
          {title}
          {locked && (
            <span className="flex items-center gap-1 rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[11px] font-bold text-muted">
              <Lock className="h-3 w-3" />
              נעולה
            </span>
          )}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setShowAgenda((v) => !v)}
            className="self-start text-xs font-semibold text-teal hover:underline"
          >
            {showAgenda ? "הסתרת מבנה מומלץ לפגישה" : "הצגת מבנה מומלץ לפגישה"}
          </button>
          {showAgenda && (
            <ol className="list-decimal space-y-1 rounded-lg bg-[#f4f6f9] p-3 pr-7 text-xs text-muted">
              {agenda.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1 text-xs font-bold text-muted">
              תאריך הישיבה
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                disabled={frozen}
                className="rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
              />
            </label>
            <div className="flex items-center gap-1.5 text-xs font-bold text-muted">
              משתתפים
              {ROCK_OWNERS.map((name) => (
                <button
                  key={name}
                  type="button"
                  disabled={frozen}
                  onClick={() => toggleParticipant(name)}
                  className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition disabled:opacity-60 ${
                    participants.includes(name)
                      ? "border-teal bg-teal-bg text-teal-dark"
                      : "border-card-border bg-white text-muted hover:bg-[#f4f6f9]"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            readOnly={frozen}
            placeholder={frozen ? "לא נכתב סיכום לתקופה הזו." : "מה עלה בישיבה? לקחים, החלטות, מה מעבירים הלאה..."}
            className={`${FIELD} read-only:text-muted`}
          />

          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => save(false)}
                disabled={isPending || locked}
                className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {isPending ? "שומר..." : "שמירת סיכום"}
              </button>
              <button
                type="button"
                onClick={() => save(!locked)}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#f4f6f9] disabled:opacity-60"
              >
                {locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {locked ? "פתיחת הישיבה לעריכה" : "נעילת הישיבה"}
              </button>
            </div>
          )}

          {previousReviews.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-xs font-semibold text-teal hover:underline"
              >
                {showHistory ? "הסתרת סיכומים קודמים" : `הצגת סיכומים קודמים (${previousReviews.length})`}
              </button>
              {showHistory && (
                <div className="mt-2 flex flex-col gap-2">
                  {previousReviews.map((r) => (
                    <div key={r.id} className="rounded-lg border border-card-border bg-[#f4f6f9] p-2 text-xs text-ink">
                      <div className="mb-1 flex flex-wrap items-center gap-2 font-bold text-muted">
                        <span>{r.meetingDate || r.periodKey}</span>
                        {r.participants?.length ? <span className="font-normal">{r.participants.join(", ")}</span> : null}
                      </div>
                      <div className="whitespace-pre-wrap">{r.notes}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
