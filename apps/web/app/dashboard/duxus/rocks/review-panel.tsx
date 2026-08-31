"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Save } from "lucide-react";
import type { RockReview, RockReviewPeriod } from "@ultranet/shared-types";
import { saveReviewAction } from "./actions";
import { useToast } from "@/lib/toast";

export function ReviewPanel({
  period,
  periodKey,
  title,
  agenda,
  initialNotes,
  previousReviews,
  readOnly = false,
}: {
  period: RockReviewPeriod;
  periodKey: string;
  title: string;
  agenda: string[];
  initialNotes: string;
  previousReviews: RockReview[];
  /** רבעון בארכיון - הסיכום מוצג אך לא ניתן לעריכה */
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes);
  const [showAgenda, setShowAgenda] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError, toastNode } = useToast();

  function handleSave() {
    startTransition(async () => {
      const result = await saveReviewAction(period, periodKey, notes);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess("הסיכום נשמר");
    });
  }

  return (
    <div className="card mb-4">
      {toastNode}
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-right">
        <span className="text-sm font-bold text-ink">{title}</span>
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
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            readOnly={readOnly}
            placeholder={readOnly ? "לא נכתב סיכום לתקופה הזו." : "מה עלה בפגישה? לקחים, החלטות, מה מעבירים הלאה..."}
            className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none read-only:text-muted"
          />
          {!readOnly && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-1.5 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {isPending ? "שומר..." : "שמירת סיכום"}
          </button>
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
                      <div className="mb-1 font-bold text-muted">{r.periodKey}</div>
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
