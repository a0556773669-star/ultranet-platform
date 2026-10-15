"use client";

import { useState } from "react";
import { Inbox, Plus } from "lucide-react";
import type { MilestoneOrigin } from "@ultranet/shared-types";
import type { Board } from "./use-board";
import { MilestoneRow } from "./milestone-row";

/**
 * תיבת קליטה (אפיון המשך, סעיף 25): רעיונות שעולים במהלך השבוע ונרשמים בשורה אחת,
 * **בלי להשתבץ** לחודש או לשבוע. הם מוצגים לבחירה בשלב 3 של "ניהול ישיבה", ומשם
 * נכנסים לתכנון כמו כל אבן דרך - אותה רשומה, בלי עותק.
 *
 * זה לא "משימות ליוני": שם נרשמות תקלות/בקשות לביצוע ישיר; כאן - רעיונות לתכנון.
 */
export function InboxSection({ board, origin }: { board: Board; origin: MilestoneOrigin }) {
  const [title, setTitle] = useState("");
  const items = board.inboxItems;

  function add() {
    const t = title.trim();
    if (!t) return;
    setTitle("");
    board.createMilestone({ rockId: "", source: "adhoc", origin, title: t, inbox: true });
  }

  return (
    <details className="card mb-4">
      <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-bold text-ink">
        <Inbox className="h-4 w-4 text-muted" />
        תיבת קליטה ({items.length})
        <span className="text-[11px] font-normal text-muted">רעיונות שממתינים לבחירה בישיבה - לא משתבצים אוטומטית</span>
      </summary>
      <div className="mt-3 flex flex-col gap-2">
        {!board.readOnly && (
          <div className="flex items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              placeholder="רעיון לתכנון (משימה לביצוע ישיר - ב'משימות ליוני')"
              aria-label="רעיון חדש לתיבת הקליטה"
              className="flex-1 rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={add}
              disabled={!title.trim()}
              className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-teal hover:bg-[#f4f6f9] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              הוספה
            </button>
          </div>
        )}
        {items.length === 0 ? (
          <div className="text-xs text-muted">התיבה ריקה.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {items.map((m) => (
              <MilestoneRow
                key={m.id}
                milestone={m}
                toneContext={board.toneContext(m)}
                onOpen={(x) => board.setOpenMilestoneId(x.id)}
                readOnly
                dense
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
