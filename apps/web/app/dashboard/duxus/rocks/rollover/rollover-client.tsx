"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarPlus, CheckCheck } from "lucide-react";
import type { Quarter, Rock, Milestone } from "@ultranet/shared-types";
import { rolloverQuarterAction } from "../actions";
import { groupRocksByParent, groupMilestonesByRock, splitRockAndAdhoc } from "../rock-tree";
import { useToast } from "@/lib/toast";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

function toggle(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/**
 * אשף "פתיחת רבעון חדש": בוחרים מה מהרבעון הנוכחי לא הושלם ורוצים לגלגל קדימה,
 * נותנים שם לרבעון החדש, והרבעון הישן עובר לארכיון (קריאה בלבד).
 *
 * בחירת אבן דרך גוררת אוטומטית את הסלע ותת-הסלע שמעליה (גם בתצוגה כאן וגם בשרת),
 * כדי שהיא תגיע לרבעון החדש עם ההקשר המלא ולא כמשימה יתומה.
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
  const [isPending, startTransition] = useTransition();

  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [archiveSource, setArchiveSource] = useState(true);
  const [selectedMilestones, setSelectedMilestones] = useState<Set<string>>(new Set());
  const [selectedRocks, setSelectedRocks] = useState<Set<string>>(new Set());

  const { topRocks, subRocksByParent } = useMemo(() => groupRocksByParent(rocks), [rocks]);
  const { adhocTasks } = useMemo(() => splitRockAndAdhoc(milestones), [milestones]);
  const milestonesByRock = useMemo(() => groupMilestonesByRock(milestones), [milestones]);
  const rocksById = useMemo(() => new Map(rocks.map((r) => [r.id, r])), [rocks]);

  const openMilestones = useMemo(() => milestones.filter((m) => !m.done), [milestones]);

  /** הסלעים שיגיעו בפועל לרבעון החדש: מה שסומן ידנית + שרשרת האבות של כל אבן דרך שסומנה. */
  const effectiveRockIds = useMemo(() => {
    const result = new Set<string>();
    const addChain = (rockId: string) => {
      let cursor: string | null | undefined = rockId;
      while (cursor && rocksById.has(cursor) && !result.has(cursor)) {
        result.add(cursor);
        cursor = rocksById.get(cursor)?.parentRockId ?? null;
      }
    };
    selectedRocks.forEach(addChain);
    milestones.forEach((m) => {
      if (selectedMilestones.has(m.id) && m.rockId) addChain(m.rockId);
    });
    return result;
  }, [selectedRocks, selectedMilestones, milestones, rocksById]);

  function selectAllOpen() {
    setSelectedMilestones(new Set(openMilestones.map((m) => m.id)));
    setSelectedRocks(new Set(rocks.filter((r) => r.status !== "dropped").map((r) => r.id)));
  }

  function clearAll() {
    setSelectedMilestones(new Set());
    setSelectedRocks(new Set());
  }

  function handleSubmit() {
    if (!label.trim()) {
      showError("יש להזין שם לרבעון החדש");
      return;
    }
    startTransition(async () => {
      const result = await rolloverQuarterAction({
        fromQuarterKey: quarter.id,
        label,
        startDate,
        endDate,
        rockIds: Array.from(effectiveRockIds),
        milestoneIds: Array.from(selectedMilestones),
        archiveSource,
      });
      if (!result.ok) {
        showError(result.message);
        return;
      }
      router.push(`/dashboard/duxus/rocks?q=${encodeURIComponent(result.quarterKey)}`);
    });
  }

  function renderMilestoneRow(m: Milestone, indent: boolean) {
    if (m.done) {
      return (
        <div
          key={m.id}
          className={`flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm ${indent ? "mr-6" : ""}`}
        >
          <span className="inline-block h-4 w-4" />
          <span className="flex-1 text-emerald-800 line-through">{m.title}</span>
          <span className="shrink-0 text-[11px] font-bold text-emerald-700">הושלם - נשאר בהיסטוריה</span>
        </div>
      );
    }
    return (
      <label
        key={m.id}
        className={`flex items-center gap-2 rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm ${indent ? "mr-6" : ""}`}
      >
        <input
          type="checkbox"
          checked={selectedMilestones.has(m.id)}
          onChange={() => setSelectedMilestones((prev) => toggle(prev, m.id))}
          className="h-4 w-4 accent-teal"
        />
        <span className="flex-1 text-ink">{m.title}</span>
        {m.carryOverCount ? (
          <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
            כבר גולגל {m.carryOverCount}
          </span>
        ) : null}
        {m.ownerName ? <span className="shrink-0 text-[11px] text-muted">{m.ownerName}</span> : null}
      </label>
    );
  }

  function renderRock(rock: Rock, level: 0 | 1) {
    const subRocks = subRocksByParent.get(rock.id) ?? [];
    const rockMilestones = milestonesByRock.get(rock.id) ?? [];
    const carried = effectiveRockIds.has(rock.id);

    return (
      <div
        key={rock.id}
        className={
          level === 0
            ? `card ${carried ? "!border-teal" : ""}`
            : `rounded-[11px] border p-3 ${carried ? "border-teal bg-teal-bg/40" : "border-card-border bg-[#f9fafb]"}`
        }
      >
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedRocks.has(rock.id)}
            onChange={() => setSelectedRocks((prev) => toggle(prev, rock.id))}
            className="h-4 w-4 accent-teal"
          />
          <span className="flex-1 font-bold text-ink">{rock.title}</span>
          {carried && !selectedRocks.has(rock.id) && (
            <span className="rounded-full border border-teal bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">
              נגרר בגלל אבן דרך שנבחרה
            </span>
          )}
          {rock.ownerName ? <span className="text-[11px] text-muted">{rock.ownerName}</span> : null}
        </label>

        <div className="mt-2 flex flex-col gap-1.5 pr-6">
          {rockMilestones.map((m) => renderMilestoneRow(m, false))}
          {level === 0 && subRocks.length > 0 && (
            <div className="flex flex-col gap-2 pt-1">{subRocks.map((sr) => renderRock(sr, 1))}</div>
          )}
        </div>
      </div>
    );
  }

  const totalSelected = selectedMilestones.size;

  return (
    <div>
      {toastNode}

      <Link
        href={`/dashboard/duxus/rocks?q=${encodeURIComponent(quarter.id)}`}
        className="mb-4 flex w-fit items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לרבעון
      </Link>

      <div className="card mb-4">
        <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-ink">
          <CalendarPlus className="h-4 w-4" />
          פתיחת רבעון חדש
        </h2>
        <p className="mb-3 text-xs text-muted">
          הרבעון <span className="font-bold">{quarter.label}</span> ייסגר ויעבור לארכיון, ומה שתסמנו כאן יעבור לרבעון החדש עם
          ההיררכיה המלאה שלו (סלע ➔ תת-סלע ➔ אבן דרך).
        </p>
        <div className="flex flex-col gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="שם הרבעון החדש - למשל: ראש חודש כסלו - ראש חודש אדר"
            className={FIELD}
          />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-muted">
              מתאריך
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={FIELD} />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              עד תאריך
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={FIELD} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink">
            <input
              type="checkbox"
              checked={archiveSource}
              onChange={(e) => setArchiveSource(e.target.checked)}
              className="h-4 w-4 accent-teal"
            />
            להעביר את &quot;{quarter.label}&quot; לארכיון (קריאה בלבד) בסיום
          </label>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">מה מגלגלים לרבעון החדש?</h3>
        <div className="flex items-center gap-3">
          <button type="button" onClick={selectAllOpen} className="flex items-center gap-1 text-xs font-semibold text-teal hover:underline">
            <CheckCheck className="h-3.5 w-3.5" />
            סימון כל מה שלא הושלם
          </button>
          <button type="button" onClick={clearAll} className="text-xs font-semibold text-muted hover:underline">
            ניקוי בחירה
          </button>
        </div>
      </div>

      {topRocks.length === 0 ? (
        <div className="card text-sm text-muted">אין סלעים ברבעון הזה - אפשר פשוט לפתוח רבעון חדש וריק.</div>
      ) : (
        <div className="flex flex-col gap-3">{topRocks.map((r) => renderRock(r, 0))}</div>
      )}

      {adhocTasks.length > 0 && (
        <div className="card mt-4">
          <h3 className="mb-2 text-sm font-bold text-ink">משימות שוטפות</h3>
          <div className="flex flex-col gap-1.5">{adhocTasks.map((m) => renderMilestoneRow(m, false))}</div>
        </div>
      )}

      <div className="sticky bottom-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[11px] border border-teal bg-white px-4 py-3 shadow-lg">
        <span className="text-sm font-bold text-ink">
          {totalSelected} אבני דרך · {effectiveRockIds.size} סלעים/תתי-סלעים יעברו לרבעון החדש
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "פותח רבעון..." : "פתיחת הרבעון החדש"}
        </button>
      </div>
    </div>
  );
}
