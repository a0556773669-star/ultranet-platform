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

export function groupMilestonesByRock(milestones: Milestone[]): Map<string, Milestone[]> {
  const map = new Map<string, Milestone[]>();
  milestones.forEach((m) => {
    const list = map.get(m.rockId) ?? [];
    list.push(m);
    map.set(m.rockId, list);
  });
  return map;
}

/**
 * עץ סלעים/תתי-סלעים/אבני-דרך משותף לטאבי רבעון/חודשי/שבועי - כדי שהתצוגה תהיה
 * זהה בכל מקום ("שיראה כמו ברבעון"). כל דף מזין מה להציג בכל אבן דרך
 * (renderMilestone) ומה להציג מתחת לרשימת אבני הדרך של כל סלע - למשל כפתור/טופס
 * "+ אבן דרך" (renderRockFooter). renderRockExtra מוסיף כפתורים בשורת הכותרת של
 * הסלע (למשל סטטוס/מחיקה - רלוונטי רק בטאב רבעון).
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
    const doneCount = rockMilestones.filter((m) => m.done).length;
    const allDescendantMilestones = collectDescendantMilestones(rock.id);
    const allDone = allDescendantMilestones.length > 0 && allDescendantMilestones.every((m) => m.done);
    const pending = rock.id.startsWith("temp-");

    const cardClass =
      level === 0
        ? `card ${allDone ? "!border-emerald-300 !bg-emerald-50" : ""}`
        : `rounded-[11px] border p-3 ${allDone ? "border-emerald-300 bg-emerald-50" : "border-card-border bg-[#f9fafb]"}`;

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
              {allDone && (
                <span className="mr-2 rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  ✓ הושלם במלואו
                </span>
              )}
              {rock.description ? <span className="mr-2 text-xs text-muted">{rock.description}</span> : null}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            {rockMilestones.length > 0 && (
              <span className="text-[11px] text-muted">
                {doneCount}/{rockMilestones.length}
              </span>
            )}
            {rock.ownerName ? <span className="text-[11px] text-muted">{rock.ownerName}</span> : null}
            {renderRockExtra?.(rock, level)}
          </div>
        </div>

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
