"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Milestone, MilestoneStatus, PeriodAssignment, PeriodType } from "@ultranet/shared-types";
import type { HistoryData } from "../rocks/actions";
import { STATUS_LABEL } from "../rocks/task-status";
import { ROCK_OWNERS } from "../rocks/owners";
import { monthLabel, weekKeyIndex, weekLabel } from "../rocks/date-utils";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-xs focus:border-teal focus:bg-white focus:outline-none";

const ORIGIN_LABEL: Record<string, string> = {
  quarter: "תוכנן ברבעון",
  month: "נוסף במהלך החודש",
  week: "נוסף במהלך השבוע",
};

const OUTCOME_LABEL: Record<string, string> = {
  open: "פתוח",
  done: "הושלם בתקופה",
  missed: "לא הושלם בזמן",
  cancelled: "בוטל",
};

function formatDate(ts?: number): string {
  return ts ? new Date(ts).toLocaleDateString("he-IL") : "";
}

/**
 * מסך ההיסטוריה (סעיף 11): **התוכנית המקורית מול הביצוע בפועל**.
 *
 * הסינון כאן הוא צד-לקוח בכוונה - כל הדאטה של המודול נטען פעם אחת בשרת, וכך
 * מעבר בין תקופה, סלע, אחראי, סטטוס ומקור יצירה הוא מיידי ובלי שליפה חוזרת.
 */
export function HistoryClient({ data }: { data: HistoryData }) {
  const [quarterFilter, setQuarterFilter] = useState("");
  const [rockFilter, setRockFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | MilestoneStatus>("");
  const [originFilter, setOriginFilter] = useState("");
  const [text, setText] = useState("");

  const rocksById = useMemo(() => new Map(data.rocks.map((r) => [r.id, r])), [data.rocks]);
  const quartersById = useMemo(() => new Map(data.quarters.map((q) => [q.id, q])), [data.quarters]);
  const topRocks = useMemo(() => data.rocks.filter((r) => !r.parentRockId), [data.rocks]);

  function breadcrumb(rockId: string): string {
    if (!rockId) return "משימה שוטפת";
    const rock = rocksById.get(rockId);
    if (!rock) return "";
    const parent = rock.parentRockId ? rocksById.get(rock.parentRockId) : null;
    return parent ? `${parent.title} ‹ ${rock.title}` : rock.title;
  }

  function rootRockId(rockId: string): string {
    const rock = rocksById.get(rockId);
    if (!rock) return "";
    return rock.parentRockId ?? rock.id;
  }

  /** שיוכי התקופה של כל אבן דרך - זה מה שמראה "כמה פעמים שובצה מחדש". */
  const assignmentsByMilestone = useMemo(() => {
    const map = new Map<string, PeriodAssignment[]>();
    data.assignments.forEach((a) => map.set(a.milestoneId, [...(map.get(a.milestoneId) ?? []), a]));
    return map;
  }, [data.assignments]);

  const rows = useMemo(() => {
    const q = text.trim();
    return data.milestones
      .filter((m) => {
        if (quarterFilter && m.quarterKey !== quarterFilter) {
          const assigned = (assignmentsByMilestone.get(m.id) ?? []).some(
            (a) => a.periodType === "quarter" && a.periodKey === quarterFilter
          );
          if (!assigned) return false;
        }
        if (rockFilter && rootRockId(m.rockId) !== rockFilter) return false;
        if (ownerFilter && (m.ownerName ?? "") !== ownerFilter) return false;
        if (statusFilter && m.status !== statusFilter) return false;
        if (originFilter && (m.origin ?? "quarter") !== originFilter) return false;
        if (q && !m.title.includes(q) && !(m.notes ?? "").includes(q)) return false;
        return true;
      })
      .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0) || b.createdAt - a.createdAt);
  }, [data.milestones, quarterFilter, rockFilter, ownerFilter, statusFilter, originFilter, text, assignmentsByMilestone]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * מדדי התקופה (סעיף 11): מספר התחייבויות, אחוז השלמה בזמן, כמה נדחו וכמה נוספו
   * תוך כדי. המדדים מיועדים לשיפור התכנון - הם נגזרים מהדאטה ולא ניתנים לעריכה.
   */
  const metrics = useMemo(() => {
    const ids = new Set(rows.map((m) => m.id));
    const relevant = data.assignments.filter((a) => ids.has(a.milestoneId) && a.periodType !== "quarter");
    const closed = relevant.filter((a) => a.outcome !== "open");
    const onTime = closed.filter((a) => a.outcome === "done").length;
    return {
      commitments: relevant.length,
      closed: closed.length,
      onTimePercent: closed.length ? Math.round((onTime / closed.length) * 100) : 0,
      pushed: rows.filter((m) => (m.carryOverCount ?? 0) > 0).length,
      addedMidPeriod: rows.filter((m) => (m.origin ?? "quarter") !== "quarter").length,
      reopened: rows.filter((m) => (m.reopenCount ?? 0) > 0).length,
      cancelled: rows.filter((m) => m.status === "cancelled").length,
    };
  }, [rows, data.assignments]);

  function periodText(periodType: PeriodType, periodKey: string): string {
    if (periodType === "week") return weekLabel(periodKey);
    if (periodType === "month") return monthLabel(periodKey);
    return quartersById.get(periodKey)?.label ?? periodKey;
  }

  function renderAssignments(m: Milestone) {
    const list = (assignmentsByMilestone.get(m.id) ?? [])
      .filter((a) => a.periodType !== "quarter")
      .sort((a, b) => (a.periodType === b.periodType ? weekKeyIndex(a.periodKey) - weekKeyIndex(b.periodKey) : a.assignedAt - b.assignedAt));
    if (!list.length) return <span className="text-[11px] text-muted">לא שובצה לתקופה</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {list.map((a) => (
          <span
            key={a.id}
            title={OUTCOME_LABEL[a.outcome] ?? a.outcome}
            className={`rounded-full border px-1.5 py-0.5 text-[11px] font-bold ${
              a.outcome === "done"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : a.outcome === "missed"
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-card-border bg-[#f4f6f9] text-muted"
            }`}
          >
            {periodText(a.periodType, a.periodKey)}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[160px] flex-1">
            <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="חיפוש חופשי" className={`w-full pr-7 ${FIELD}`} />
          </div>
          <select value={quarterFilter} onChange={(e) => setQuarterFilter(e.target.value)} aria-label="רבעון" className={FIELD}>
            <option value="">כל הרבעונים</option>
            {data.quarters.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
          <select value={rockFilter} onChange={(e) => setRockFilter(e.target.value)} aria-label="סלע" className={FIELD}>
            <option value="">כל הסלעים</option>
            {topRocks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} aria-label="אחראי" className={FIELD}>
            <option value="">כל האחראים</option>
            {ROCK_OWNERS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | MilestoneStatus)}
            aria-label="סטטוס"
            className={FIELD}
          >
            <option value="">כל הסטטוסים</option>
            {(Object.keys(STATUS_LABEL) as MilestoneStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <select value={originFilter} onChange={(e) => setOriginFilter(e.target.value)} aria-label="מקור יצירה" className={FIELD}>
            <option value="">כל מקורות היצירה</option>
            {Object.entries(ORIGIN_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {[
            { label: "אבני דרך", value: rows.length },
            { label: "התחייבויות", value: metrics.commitments },
            { label: "נסגרו", value: metrics.closed },
            { label: "הושלמו בזמן", value: `${metrics.onTimePercent}%` },
            { label: "נדחו קדימה", value: metrics.pushed },
            { label: "נוספו תוך כדי", value: metrics.addedMidPeriod },
            { label: "נפתחו מחדש", value: metrics.reopened },
          ].map((c) => (
            <div key={c.label} className="rounded-[11px] border border-card-border bg-[#f9fafb] px-2.5 py-2 text-center">
              <div className="text-lg font-extrabold leading-none text-ink">{c.value}</div>
              <div className="mt-1 text-[11px] font-semibold text-muted">{c.label}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          המדדים מיועדים לשיפור התכנון בלבד ואינם ניתנים לעריכה ידנית - הם נגזרים מיומן הפעולות ומשיוכי התקופות.
        </p>
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-bold text-ink">תוכנית מול ביצוע ({rows.length})</h2>
        {rows.length === 0 ? (
          <div className="text-sm text-muted">אין אבני דרך שמתאימות לסינון.</div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map((m) => (
              <div
                key={m.id}
                className={`flex flex-wrap items-center gap-2 rounded-lg border border-card-border border-r-[3px] bg-white px-3 py-2 text-sm ${
                  m.status === "done"
                    ? "border-r-emerald-400"
                    : m.status === "cancelled"
                      ? "border-r-card-border"
                      : (m.carryOverCount ?? 0) > 0
                        ? "border-r-amber-400"
                        : "border-r-card-border"
                }`}
              >
                <div className="min-w-[200px] flex-1">
                  <div className={m.status === "cancelled" ? "text-muted line-through" : "text-ink"}>{m.title}</div>
                  <div className="text-[11px] text-muted">
                    {breadcrumb(m.rockId)}
                    {" · "}
                    {quartersById.get(m.quarterKey)?.label ?? m.quarterKey}
                    {" · "}
                    {ORIGIN_LABEL[m.origin ?? "quarter"]}
                    {m.ownerName ? ` · ${m.ownerName}` : ""}
                  </div>
                </div>

                <div className="min-w-[160px]">{renderAssignments(m)}</div>

                <div className="flex shrink-0 items-center gap-1.5 text-[11px]">
                  {m.carryOverCount ? (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700">
                      שובץ מחדש {m.carryOverCount}
                    </span>
                  ) : null}
                  {m.reopenCount ? (
                    <span className="rounded-full border border-card-border bg-[#f4f6f9] px-1.5 py-0.5 font-bold text-muted">
                      נפתח מחדש {m.reopenCount}
                    </span>
                  ) : null}
                  {m.status === "cancelled" && m.cancelReason ? (
                    <span className="text-muted" title={m.cancelReason}>
                      סיבה: {m.cancelReason}
                    </span>
                  ) : null}
                  {m.status === "done" ? (
                    <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                      {formatDate(m.doneAt)}
                      {m.completedBy ? ` · ${m.completedBy}` : ""}
                    </span>
                  ) : (
                    <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 font-bold text-muted">
                      {STATUS_LABEL[m.status]}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 text-sm font-bold text-ink">סיכומי ישיבות</h2>
        <div className="flex flex-col gap-3">
          {(
            [
              ["quarterly", "רבעון"],
              ["monthly", "חודש"],
              ["weekly", "שבוע"],
            ] as const
          ).map(([period, label]) => {
            const reviews = data.reviews
              .filter((r) => r.period === period && (r.notes.trim() || r.participants?.length))
              .sort((a, b) => b.updatedAt - a.updatedAt);
            return (
              <details key={period} className="rounded-lg border border-card-border bg-[#f9fafb] p-3">
                <summary className="cursor-pointer text-xs font-bold text-ink">
                  {label} ({reviews.length})
                </summary>
                {reviews.length === 0 ? (
                  <div className="mt-2 text-xs text-muted">אין עדיין סיכומים.</div>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    {reviews.map((r) => (
                      <div key={r.id} className="rounded-lg border border-card-border bg-white p-2 text-xs text-ink">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 font-bold text-muted">
                          <span>
                            {period === "weekly"
                              ? weekLabel(r.periodKey)
                              : period === "monthly"
                                ? monthLabel(r.periodKey)
                                : (quartersById.get(r.periodKey)?.label ?? r.periodKey)}
                            {r.meetingDate ? ` · ${r.meetingDate}` : ""}
                          </span>
                          <span className="font-normal">{r.participants?.join(", ") || r.createdBy}</span>
                        </div>
                        <div className="whitespace-pre-wrap">{r.notes}</div>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}
