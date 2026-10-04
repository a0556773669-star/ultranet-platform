"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarPlus, CheckSquare, Square } from "lucide-react";
import type { Milestone, Quarter, Rock } from "@ultranet/shared-types";
import { rolloverQuarterAction } from "../actions";
import { useToast } from "@/lib/toast";
import { STATUS_LABEL, isOpenMilestone } from "../task-status";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

/**
 * אשף "פתיחת רבעון חדש".
 *
 * **אין שכפול** (סעיף 19): אבן דרך שלא הושלמה אינה מועתקת לרבעון החדש - היא נשארת
 * אותה רשומה אחת, עם אותה היסטוריה ואותו יומן, ומקבלת *שיוך נוסף* לרבעון החדש.
 * הסלע שלה נגרר איתה לתצוגה ומסומן שם "מרבעון קודם", כך שהיא מגיעה בהיררכיה
 * המלאה ולא כמשימה יתומה. מה שכבר הושלם נשאר ברבעון הישן ולא מוצע לבחירה.
 */
export function RolloverClient({
  quarter,
  rocks,
  milestones,
}: {
  quarter: Quarter;
  rocks: Rock[];
  milestones: Milestone[];
}) {
  const router = useRouter();
  const { showError, toastNode } = useToast();
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [archiveSource, setArchiveSource] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const rocksById = useMemo(() => new Map(rocks.map((r) => [r.id, r])), [rocks]);
  const open = useMemo(() => milestones.filter(isOpenMilestone), [milestones]);
  const closed = useMemo(() => milestones.filter((m) => !isOpenMilestone(m)), [milestones]);

  const groups = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    open.forEach((m) => map.set(m.rockId, [...(map.get(m.rockId) ?? []), m]));
    return Array.from(map.entries()).map(([rockId, list]) => {
      const rock = rocksById.get(rockId) ?? null;
      const parent = rock?.parentRockId ? (rocksById.get(rock.parentRockId) ?? null) : null;
      return { rockId, title: rock ? `${parent ? `${parent.title} ‹ ` : ""}${rock.title}` : "משימות שוטפות", list };
    });
  }, [open, rocksById]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    if (!label.trim()) {
      showError("יש להזין שם לרבעון החדש");
      return;
    }
    setSaving(true);
    void (async () => {
      const result = await rolloverQuarterAction({
        fromQuarterKey: quarter.id,
        label,
        startDate,
        endDate,
        milestoneIds: Array.from(selected),
        archiveSource,
      });
      setSaving(false);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      router.push(`/dashboard/duxus/rocks/quarter?q=${encodeURIComponent(result.quarterKey)}`);
    })();
  }

  return (
    <div className="flex flex-col gap-4">
      {toastNode}

      <section className="card">
        <h2 className="mb-3 text-base font-extrabold text-ink">הרבעון החדש</h2>
        <div className="flex flex-col gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder='שם הרבעון, למשל "ראש חודש כסלו - ראש חודש אדר"'
            className={FIELD}
          />
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1 text-xs text-muted">
              מתאריך
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={FIELD} />
            </label>
            <label className="flex items-center gap-1 text-xs text-muted">
              עד תאריך
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={FIELD} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={archiveSource} onChange={(e) => setArchiveSource(e.target.checked)} className="h-4 w-4 accent-[#1a8a76]" />
            להעביר את &quot;{quarter.label}&quot; לארכיון (קריאה בלבד) בסיום
          </label>
        </div>
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-ink">למה מתחייבים שוב? ({open.length} פתוחות)</h2>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setSelected(new Set(open.map((m) => m.id)))}
              className="flex items-center gap-1 font-semibold text-teal hover:underline"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              סימון כל מה שלא הושלם
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="flex items-center gap-1 font-semibold text-muted hover:underline"
            >
              <Square className="h-3.5 w-3.5" />
              נקה בחירה
            </button>
          </div>
        </div>

        <p className="mb-3 rounded-lg bg-[#f4f6f9] p-2.5 text-xs text-muted">
          אבן דרך שנבחרת כאן <b>אינה משוכפלת</b>: היא נשארת אותה משימה אחת עם כל ההיסטוריה שלה, ורק מקבלת התחייבות נוספת ברבעון
          החדש. הסלע שמעליה ייגרר איתה לתצוגה.
        </p>

        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-card-border p-4 text-sm text-muted">
            אין אבני דרך פתוחות ברבעון הזה. אפשר לפתוח רבעון חדש ולהתחיל דף חלק.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((g) => (
              <div key={g.rockId || "adhoc"} className="rounded-[11px] border border-card-border">
                <div className="flex items-center justify-between gap-2 border-b border-card-border bg-[#f9fafb] px-3 py-1.5">
                  <span className="text-xs font-bold text-ink">{g.title}</span>
                  <button
                    type="button"
                    onClick={() => setSelected((prev) => new Set([...prev, ...g.list.map((m) => m.id)]))}
                    className="text-[11px] font-semibold text-teal hover:underline"
                  >
                    בחר הכול ({g.list.length})
                  </button>
                </div>
                <div className="flex flex-col gap-1 p-2">
                  {g.list.map((m) => (
                    <label
                      key={m.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border border-card-border px-2.5 py-1.5 text-sm ${
                        selected.has(m.id) ? "bg-teal-bg/40" : "bg-white hover:bg-[#f9fafb]"
                      }`}
                    >
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} className="h-4 w-4 accent-[#1a8a76]" />
                      <span className="min-w-0 flex-1 truncate text-ink">{m.title}</span>
                      {m.carryOverCount ? (
                        <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                          כבר נדחה {m.carryOverCount}
                        </span>
                      ) : null}
                      {m.ownerName ? <span className="shrink-0 text-[11px] text-muted">{m.ownerName}</span> : null}
                      <span className="shrink-0 rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[11px] font-bold text-muted">
                        {STATUS_LABEL[m.status]}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {closed.length > 0 && (
          <details className="mt-3 rounded-lg border border-card-border bg-[#f9fafb] p-3">
            <summary className="cursor-pointer text-xs font-bold text-muted">
              נסגרו ברבעון הזה ונשארים בהיסטוריה ({closed.length})
            </summary>
            <div className="mt-2 flex flex-col gap-1">
              {closed.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-card-border bg-white px-2.5 py-1.5 text-xs">
                  <span className={m.status === "cancelled" ? "text-muted line-through" : "text-muted"}>{m.title}</span>
                  <span className="shrink-0 text-[11px] font-bold text-muted">{STATUS_LABEL[m.status]}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2.5 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
        >
          <CalendarPlus className="h-4 w-4" />
          {saving ? "פותח..." : `פתיחת הרבעון עם ${selected.size} התחייבויות`}
        </button>
        <Link href={`/dashboard/duxus/rocks/quarter?q=${encodeURIComponent(quarter.id)}`} className="text-sm font-semibold text-muted hover:underline">
          ביטול
        </Link>
      </div>
    </div>
  );
}
