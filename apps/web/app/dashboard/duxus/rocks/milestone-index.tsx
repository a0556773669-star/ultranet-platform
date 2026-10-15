"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Milestone } from "@ultranet/shared-types";

/**
 * אינדקס אבני הדרך של הלוח הנוכחי, לפי מזהה. מאפשר לשורה (`MilestoneRow`) להציג
 * תלות שלא הושלמה (סעיף 49) ומספר צעדים (סעיף 30) בלי להעביר את כל הלוח לכל שורה.
 * בלי ספק (מסכים שלא עוטפים) - האינדקס ריק והתגים פשוט לא מוצגים.
 */
const MilestoneIndexContext = createContext<Map<string, Milestone>>(new Map());

export function MilestoneIndexProvider({ milestones, children }: { milestones: Milestone[]; children: ReactNode }) {
  const index = useMemo(() => new Map(milestones.map((m) => [m.id, m])), [milestones]);
  return <MilestoneIndexContext.Provider value={index}>{children}</MilestoneIndexContext.Provider>;
}

export function useMilestoneIndex(): Map<string, Milestone> {
  return useContext(MilestoneIndexContext);
}

/** התלויות שעוד לא הושלמו (בוטלה/נמחקה = לא נספרת). */
export function openDependencies(m: Milestone, index: Map<string, Milestone>): Milestone[] {
  const out: Milestone[] = [];
  (m.dependsOnIds ?? []).forEach((id) => {
    const d = index.get(id);
    if (d && !d.deletedAt && d.status !== "done" && d.status !== "cancelled") out.push(d);
  });
  return out;
}

/**
 * האם הוספת `candidateId` כתלות של `selfId` תיצור מעגל: אם מ-`candidateId` אפשר להגיע
 * (דרך `dependsOnIds`) חזרה ל-`selfId`. אותה בדיקה נאכפת שוב בשרת.
 */
export function createsCycle(selfId: string, candidateId: string, index: Map<string, Milestone>): boolean {
  const seen = new Set<string>();
  const stack = [candidateId];
  while (stack.length) {
    const id = stack.pop() as string;
    if (id === selfId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    (index.get(id)?.dependsOnIds ?? []).forEach((d) => stack.push(d));
  }
  return false;
}
