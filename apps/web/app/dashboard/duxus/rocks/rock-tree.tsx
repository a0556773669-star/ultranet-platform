"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Rock, Milestone } from "@ultranet/shared-types";

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
      const list = subRocksByParent.get(key) ?? [];
      list.push(r);
      subRocksByParent.set(key, list);
    });
  return { topRocks, subRocksByParent };
}

/** משימות שוטפות (`source: "adhoc"`) אינן תלויות בסלע ולכן לא נכנסות לעץ - הן מוצגות בקטע נפרד. */
export function isAdhoc(m: Milestone): boolean {
  return m.source === "adhoc" || !m.rockId;
}

/** מפרידה בין אבני דרך שנגזרו מסלע לבין המשימות השוטפות, לפי אותו כלל בכל הטאבים. */
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
    const list = map.get(m.rockId) ?? [];
    list.push(m);
    map.set(m.rockId, list);
  });
  return map;
}

/** מצב ההתקדמות של סלע/תת-סלע, נגזר אוטומטית מאבני הדרך שתחתיו - לא נשמר ב-DB. */
export type RockProgressState = "empty" | "open" | "progress" | "done";

export type RockProgress = { total: number; done: number; percent: number; state: RockProgressState };

export function computeProgress(milestones: Milestone[]): RockProgress {
  const total = milestones.length;
  const done = milestones.filter((m) => m.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const state: RockProgressState = total === 0 ? "empty" : done === total ? "done" : done > 0 ? "progress" : "open";
  return { total, done, percent, state };
}

const BAR_CLASS: Record<RockProgressState, string> = {
  empty: "bg-card-border",
  open: "bg-card-border",
  progress: "bg-amber-400",
  done: "bg-emerald-500",
};

function ProgressBar({ progress }: { progress: RockProgress }) {
  if (progress.total === 0) return null;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eceff3]">
        <div className={`h-full rounded-full transition-all ${BAR_CLASS[progress.state]}`} style={{ width: `${progress.percent}%` }} />
      </div>
      <span className="shrink-0 text-[11px] font-semibold text-muted">
        {progress.done}/{progress.total}
      </span>
    </div>
  );
}

/**
 * עץ סלעים/תתי-סלעים/אבני-דרך משותף לטאבי רבעון/חודשי/שבועי - כדי שהתצוגה תהיה
 * זהה בכל מקום ("שיראה כמו ברבעון"). כל דף מזין מה להציג בכל אבן דרך
 * (renderMilestone) ומה להציג מתחת לרשימת אבני הדרך של כל סלע - למשל כפתור/טופס
 * "+ אבן דרך" (renderRockFooter). renderRockExtra מוסיף כפתורים בשורת הכותרת של
 * הסלע (למשל סטטוס/מחיקה - רלוונטי רק בטאב רבעון).
 *
 * הצבע והתג של כל סלע/תת-סלע נגזרים **אוטומטית** מאבני הדרך שתחתיו (כולל אלו של
 * תתי-הסלעים): כולן בוצעו → ירוק "הושלם", חלקן → כתום "בתהליך", אף אחת → ניטרלי.
 */
export function RockMilestoneTree({
  topRocks,
  subRocksByParent,
  milestonesByRock,
  renderMilestone,
  renderRockExtra,
  renderRockFooter,
  emptyMessage,
}: {
  topRocks: Rock[];
  subRocksByParent: Map<string, Rock[]>;
  milestonesByRock: Map<string, Milestone[]>;
  renderMilestone: (m: Milestone) => ReactNode;
  renderRockExtra?: (rock: Rock, level: 0 | 1) => ReactNode;
  renderRockFooter?: (rock: Rock, level: 0 | 1) => ReactNode;
  emptyMessage: string;
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
    const progress = computeProgress(collectDescendantMilestones(rock.id));
    const pending = rock.id.startsWith("temp-");

    const tone =
      progress.state === "done"
        ? { border: "!border-emerald-300", bg: "!bg-emerald-50", subBorder: "border-emerald-300", subBg: "bg-emerald-50" }
        : progress.state === "progress"
          ? { border: "!border-amber-300", bg: "!bg-amber-50/50", subBorder: "border-amber-300", subBg: "bg-amber-50/50" }
          : { border: "", bg: "", subBorder: "border-card-border", subBg: "bg-[#f9fafb]" };

    const cardClass =
      level === 0 ? `card ${tone.border} ${tone.bg}` : `rounded-[11px] border p-3 ${tone.subBorder} ${tone.subBg}`;

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
            <span>
              <span className="font-bold text-ink">{rock.title}</span>
              {progress.state === "done" && (
                <span className="mr-2 rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  ✓ הושלם במלואו
                </span>
              )}
              {progress.state === "progress" && (
                <span className="mr-2 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-bold text-amber-700">
                  בתהליך · {progress.percent}%
                </span>
              )}
              {rock.description ? <span className="mr-2 text-xs text-muted">{rock.description}</span> : null}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
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
