"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type { Milestone, Rock } from "@ultranet/shared-types";
import { computeProgress, rockWarning, type Progress } from "./task-status";

export function toggleInSet(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function groupRocksByParent(rocks: Rock[]): { topRocks: Rock[]; subRocksByParent: Map<string, Rock[]> } {
  const topRocks = rocks.filter((r) => !r.parentRockId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const subRocksByParent = new Map<string, Rock[]>();
  rocks
    .filter((r) => r.parentRockId)
    .forEach((r) => {
      const key = r.parentRockId as string;
      subRocksByParent.set(key, [...(subRocksByParent.get(key) ?? []), r]);
    });
  return { topRocks, subRocksByParent };
}

/** משימות שוטפות (`source: "adhoc"`) אינן תלויות בסלע ולכן לא נכנסות לעץ. */
export function isAdhoc(m: Milestone): boolean {
  return m.source === "adhoc" || !m.rockId;
}

export function splitRockAndAdhoc(milestones: Milestone[]): { rockMilestones: Milestone[]; adhocTasks: Milestone[] } {
  return {
    rockMilestones: milestones.filter((m) => !isAdhoc(m)),
    adhocTasks: milestones.filter((m) => isAdhoc(m)),
  };
}

export function groupMilestonesByRock(milestones: Milestone[]): Map<string, Milestone[]> {
  const map = new Map<string, Milestone[]>();
  milestones.forEach((m) => {
    if (isAdhoc(m)) return;
    map.set(m.rockId, [...(map.get(m.rockId) ?? []), m]);
  });
  return map;
}

const BAR_CLASS: Record<Progress["state"], string> = {
  empty: "bg-card-border",
  open: "bg-card-border",
  progress: "bg-teal",
  done: "bg-emerald-500",
};

function ProgressBar({ progress }: { progress: Progress }) {
  if (progress.total === 0) return null;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eceff3]">
        <div className={`h-full rounded-full transition-all ${BAR_CLASS[progress.state]}`} style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="shrink-0 text-[11px] font-semibold text-muted">
        {progress.done}/{progress.total}
        {progress.cancelled ? ` · ${progress.cancelled} בוטלו` : ""}
      </span>
    </div>
  );
}

/**
 * עץ סלעים ➔ תתי-סלעים ➔ אבני דרך. ההתקדמות של כל סלע/תת-סלע **מחושבת** מאבני
 * הדרך שתחתיו (סעיף 6) - אין סימון ידני של "הושלם" ואין שדה התקדמות שמור ב-DB.
 * משימות מבוטלות יוצאות מהמכנה.
 *
 * תג האזהרה (סעיף 9) מגיע לתת-סלע בלבד, ורק אם יש בו אבן דרך שעברה יעד או שכל מה
 * שנבחר בו לתקופה עדיין לא התחיל. הסלע מציג סיכום של ילדיו ואינו נצבע ידנית.
 */
export function RockMilestoneTree({
  topRocks,
  subRocksByParent,
  milestonesByRock,
  renderMilestone,
  renderRockExtra,
  renderRockFooter,
  emptyMessage,
  warningContext,
  foreignRockIds,
}: {
  topRocks: Rock[];
  subRocksByParent: Map<string, Rock[]>;
  milestonesByRock: Map<string, Milestone[]>;
  renderMilestone: (m: Milestone) => ReactNode;
  renderRockExtra?: (rock: Rock, level: 0 | 1) => ReactNode;
  renderRockFooter?: (rock: Rock, level: 0 | 1) => ReactNode;
  emptyMessage: string;
  warningContext: { today: string; selectedIds?: Set<string>; weekWarningActive?: boolean };
  /** סלעים שהגיעו מרבעון קודם בעקבות אבן דרך שהתחייבנו אליה מחדש */
  foreignRockIds?: Set<string>;
}) {
  const [collapsedRocks, setCollapsedRocks] = useState<Set<string>>(new Set());

  function collectDescendantMilestones(rockId: string): Milestone[] {
    const own = milestonesByRock.get(rockId) ?? [];
    const subs = subRocksByParent.get(rockId) ?? [];
    return [...own, ...subs.flatMap((sr) => collectDescendantMilestones(sr.id))];
  }

  function renderRockCard(rock: Rock, level: 0 | 1): ReactNode {
    const subRocks = subRocksByParent.get(rock.id) ?? [];
    const rockMilestones = milestonesByRock.get(rock.id) ?? [];
    const collapsed = collapsedRocks.has(rock.id);
    const descendants = collectDescendantMilestones(rock.id);
    const progress = computeProgress(descendants);
    const warning = level === 1 ? rockWarning(descendants, warningContext) : "none";
    const dropped = rock.status === "dropped";
    const pending = rock.id.startsWith("temp-");

    const side =
      dropped
        ? "border-r-card-border"
        : warning === "overdue"
          ? "border-r-red-400"
          : warning === "warn"
            ? "border-r-amber-400"
            : progress.state === "done"
              ? "border-r-emerald-400"
              : progress.state === "progress"
                ? "border-r-teal"
                : "border-r-card-border";

    const cardClass =
      level === 0
        ? `card border-r-[3px] ${side}`
        : `rounded-[11px] border border-card-border border-r-[3px] bg-[#f9fafb] p-3 ${side}`;

    return (
      <div key={rock.id} className={`${cardClass} ${pending ? "opacity-60" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => setCollapsedRocks((prev) => toggleInSet(prev, rock.id))}
            className="flex flex-1 items-start gap-2 text-right"
          >
            {collapsed ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            ) : (
              <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            )}
            <span className="min-w-0">
              <span className={`font-bold ${dropped ? "text-muted line-through" : "text-ink"}`}>{rock.title}</span>
              {progress.state === "done" && !dropped && (
                <span className="mr-2 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  ✓ הושלם
                </span>
              )}
              {progress.state === "progress" && !dropped && (
                <span className="mr-2 rounded-full border border-teal bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">
                  {progress.percent}%
                </span>
              )}
              {warning !== "none" && (
                <span
                  className={`mr-2 inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                    warning === "overdue" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-700"
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  {warning === "overdue" ? "עבר יעד" : "טרם התחיל"}
                </span>
              )}
              {foreignRockIds?.has(rock.id) && (
                <span className="mr-2 rounded-full border border-purple/40 bg-[#f4ecf8] px-2 py-0.5 text-[11px] font-bold text-purple">
                  מרבעון קודם
                </span>
              )}
              {rock.description ? <span className="mr-2 text-xs text-muted">{rock.description}</span> : null}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            {rock.dueDate ? <span className="text-[11px] text-muted">יעד {rock.dueDate.slice(5)}</span> : null}
            {rock.ownerName ? <span className="text-[11px] text-muted">{rock.ownerName}</span> : null}
            {renderRockExtra?.(rock, level)}
          </div>
        </div>

        <ProgressBar progress={progress} />

        {!collapsed && (
          <div className="mt-3 flex flex-col gap-2 pr-6">
            {rockMilestones.map((m) => renderMilestone(m))}
            {renderRockFooter?.(rock, level)}
            {level === 0 && subRocks.length > 0 && (
              <div className="flex flex-col gap-2 pt-1">{subRocks.map((sr) => renderRockCard(sr, 1))}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (topRocks.length === 0) {
    return <div className="card text-sm text-muted">{emptyMessage}</div>;
  }

  return <div className="flex flex-col gap-3">{topRocks.map((r) => renderRockCard(r, 0))}</div>;
}
