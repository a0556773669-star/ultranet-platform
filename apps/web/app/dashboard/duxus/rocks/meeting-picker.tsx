"use client";

import { useMemo, useState } from "react";
import { X, CheckSquare, Square, Search } from "lucide-react";
import type { Milestone, MilestoneStatus, Rock } from "@ultranet/shared-types";
import { MILESTONE_STATUSES, STATUS_LABEL, TONES, milestoneTone, type ToneContext } from "./task-status";
import { ROCK_OWNERS } from "./owners";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-xs focus:border-teal focus:bg-white focus:outline-none";

type Group = { rock: Rock | null; parent: Rock | null; milestones: Milestone[] };

/**
 * מצב הבחירה המהירה של ישיבה חודשית/שבועית (סעיף 7.4).
 *
 * המסך בנוי לעבודה עם עשרות שורות ולכן **אינו דורש לפתוח אף משימה**: ליד כל אבן
 * דרך תיבת בחירה קבועה, לחיצה על שם השורה בוחרת אותה, ושורת תת-הסלע בוחרת את כל
 * מה שבתוכה. הסינון והחיפוש **אינם מאפסים בחירות** שכבר נעשו (קריטריון קבלה 11),
 * ואבן דרך שכבר משויכת לתקופה מוצגת מסומנת ומנוטרלת כדי למנוע שיוך כפול.
 */
export function MeetingPicker({
  title,
  subtitle,
  candidates,
  rocks,
  alreadyAssigned,
  toneContext,
  confirmLabel,
  onConfirm,
  onClose,
  isPending = false,
}: {
  title: string;
  subtitle: string;
  candidates: Milestone[];
  rocks: Rock[];
  alreadyAssigned: Set<string>;
  toneContext: ToneContext;
  confirmLabel: string;
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
  isPending?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [rockFilter, setRockFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | MilestoneStatus>("");
  const [dueFilter, setDueFilter] = useState("");

  const rocksById = useMemo(() => new Map(rocks.map((r) => [r.id, r])), [rocks]);
  const topRocks = useMemo(() => rocks.filter((r) => !r.parentRockId), [rocks]);

  /** שורש הסלע של אבן דרך - כדי שסינון "לפי סלע" יתפוס גם אבני דרך שתלויות בתת-סלע. */
  function rootRockId(rockId: string): string {
    const rock = rocksById.get(rockId);
    if (!rock) return "";
    return rock.parentRockId ?? rock.id;
  }

  const shown = useMemo(() => {
    const q = text.trim();
    return candidates.filter((m) => {
      if (q && !m.title.includes(q) && !(m.notes ?? "").includes(q) && !(m.description ?? "").includes(q)) return false;
      if (rockFilter && rootRockId(m.rockId) !== rockFilter) return false;
      if (ownerFilter && (m.ownerName ?? "") !== ownerFilter) return false;
      if (statusFilter && m.status !== statusFilter) return false;
      if (dueFilter && (m.dueDate ?? "") > dueFilter) return false;
      return true;
    });
  }, [candidates, text, rockFilter, ownerFilter, statusFilter, dueFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Milestone[]>();
    shown.forEach((m) => map.set(m.rockId, [...(map.get(m.rockId) ?? []), m]));
    return Array.from(map.entries())
      .map(([rockId, milestones]) => {
        const rock = rocksById.get(rockId) ?? null;
        return { rock, parent: rock?.parentRockId ? (rocksById.get(rock.parentRockId) ?? null) : null, milestones };
      })
      .sort((a, b) => (a.parent?.title ?? a.rock?.title ?? "").localeCompare(b.parent?.title ?? b.rock?.title ?? ""));
  }, [shown, rocksById]);

  const selectable = (m: Milestone) => !alreadyAssigned.has(m.id);
  const selectableShown = shown.filter(selectable);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectMany(ids: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-black/30 p-3" role="dialog" aria-label={title}>
      <div className="mt-6 flex w-full max-w-4xl flex-col rounded-card bg-white shadow-xl">
        <header className="flex items-start justify-between gap-2 border-b border-card-border px-4 py-3">
          <div>
            <h2 className="text-base font-extrabold text-ink">{title}</h2>
            <p className="text-[11px] text-muted">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="סגירה">
            <X className="h-4.5 w-4.5" />
          </button>
        </header>

        {/* סינון - לא מאפס בחירות */}
        <div className="flex flex-wrap items-center gap-2 border-b border-card-border px-4 py-2.5">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="חיפוש חופשי"
              className={`w-full pr-7 ${FIELD}`}
            />
          </div>
          <select value={rockFilter} onChange={(e) => setRockFilter(e.target.value)} className={FIELD} aria-label="סינון לפי סלע">
            <option value="">כל הסלעים</option>
            {topRocks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className={FIELD} aria-label="סינון לפי אחראי">
            <option value="">כל האחראים</option>
            {ROCK_OWNERS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | MilestoneStatus)}
            className={FIELD}
            aria-label="סינון לפי סטטוס"
          >
            <option value="">כל הסטטוסים</option>
            {MILESTONE_STATUSES.filter((s) => s !== "done" && s !== "cancelled").map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-[11px] text-muted">
            יעד עד
            <input type="date" value={dueFilter} onChange={(e) => setDueFilter(e.target.value)} className={FIELD} />
          </label>
        </div>

        {/* פעולות בחירה */}
        <div className="flex flex-wrap items-center gap-2 border-b border-card-border bg-[#f9fafb] px-4 py-2 text-xs">
          <button
            type="button"
            onClick={() => selectMany(selectableShown.map((m) => m.id))}
            className="flex items-center gap-1 font-semibold text-teal hover:underline"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            בחר הכול המוצג ({selectableShown.length})
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="flex items-center gap-1 font-semibold text-muted hover:underline"
          >
            <Square className="h-3.5 w-3.5" />
            נקה בחירה
          </button>
          <span className="mr-auto text-muted">{shown.length} מתוך {candidates.length} אבני דרך פתוחות</span>
        </div>

        <div className="max-h-[52vh] overflow-y-auto px-4 py-3">
          {groups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-card-border p-4 text-center text-sm text-muted">
              אין אבני דרך פתוחות שמתאימות לסינון.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {groups.map((g) => {
                const groupSelectable = g.milestones.filter(selectable).map((m) => m.id);
                return (
                  <div key={g.rock?.id ?? "adhoc"} className="rounded-[11px] border border-card-border">
                    <div className="flex items-center justify-between gap-2 border-b border-card-border bg-[#f9fafb] px-3 py-1.5">
                      <span className="text-xs font-bold text-ink">
                        {g.parent ? `${g.parent.title} ‹ ` : ""}
                        {g.rock?.title ?? "משימות שוטפות"}
                      </span>
                      {groupSelectable.length > 0 && (
                        <button
                          type="button"
                          onClick={() => selectMany(groupSelectable)}
                          className="text-[11px] font-semibold text-teal hover:underline"
                        >
                          בחר תת-סלע ({groupSelectable.length})
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 p-2">
                      {g.milestones.map((m) => {
                        const assigned = alreadyAssigned.has(m.id);
                        const checked = assigned || selected.has(m.id);
                        const tone = TONES[milestoneTone(m, toneContext)];
                        return (
                          <label
                            key={m.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border border-card-border border-r-[3px] px-2.5 py-1.5 text-sm ${tone.side} ${
                              assigned ? "bg-[#f4f6f9] opacity-60" : checked ? "bg-teal-bg/40" : "bg-white hover:bg-[#f9fafb]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={assigned}
                              onChange={() => toggle(m.id)}
                              className="h-4 w-4 shrink-0 accent-[#1a8a76]"
                            />
                            <span className="min-w-0 flex-1 truncate text-ink">{m.title}</span>
                            {m.dueDate ? <span className="shrink-0 text-[11px] text-muted">{m.dueDate.slice(5)}</span> : null}
                            {m.ownerName ? <span className="shrink-0 text-[11px] text-muted">{m.ownerName}</span> : null}
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold ${tone.badge}`}>
                              {assigned ? "כבר בתקופה" : STATUS_LABEL[m.status]}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* סרגל פעולה דביק - נשאר גלוי בגלילה */}
        <footer className="sticky bottom-0 flex items-center justify-between gap-3 rounded-b-card border-t border-card-border bg-white px-4 py-3">
          <span className="text-sm font-bold text-ink">נבחרו {selected.size} אבני דרך</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-xs font-semibold text-muted hover:underline">
              ביטול
            </button>
            <button
              type="button"
              onClick={() => onConfirm(Array.from(selected))}
              disabled={selected.size === 0 || isPending}
              className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "שומר..." : confirmLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
