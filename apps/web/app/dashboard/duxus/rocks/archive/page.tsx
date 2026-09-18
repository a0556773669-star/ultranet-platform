import Link from "next/link";
import { Archive, Lock, CalendarPlus } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { listQuarters, loadHistory } from "../actions";
import { TasksShell } from "../board-loader";
import { currentQuarterKey } from "../date-utils";
import { computeProgress } from "../task-status";
import { ArchiveActions } from "./archive-actions";

function formatRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return "";
  return `${startDate ?? ""}${startDate && endDate ? " – " : ""}${endDate ?? ""}`;
}

/**
 * לשונית הארכיון (סעיף 7): ציר הזמן של כל הרבעונים - מה תוכנן בכל אחד, כמה הושלם,
 * ומעבר לצפייה בו. רבעון מאורכב הוא **קריאה בלבד** (נאכף בשרת, לא רק בהסתרת כפתורים),
 * וניתן להחזיר אותו לפעיל בפעולה מפורשת שנרשמת ביומן.
 */
export default async function ArchivePage({ searchParams }: { searchParams: { q?: string } }) {
  await requireModuleAccess("duxus");
  const [quarters, history] = await Promise.all([listQuarters(), loadHistory()]);
  const activeKey = searchParams.q || quarters.find((q) => q.status === "active")?.id || quarters[0]?.id || currentQuarterKey();

  const rows = quarters.map((q) => {
    const rocks = history.rocks.filter((r) => r.quarterKey === q.id && !r.parentRockId);
    // "שייך לרבעון" = הבית שלו, או התחייבות מחודשת שנעשתה אליו כשיוך-רבעון.
    const assignedIds = new Set(
      history.assignments.filter((a) => a.periodType === "quarter" && a.periodKey === q.id).map((a) => a.milestoneId)
    );
    const milestones = history.milestones.filter((m) => m.quarterKey === q.id || assignedIds.has(m.id));
    const progress = computeProgress(milestones);
    const added = milestones.filter((m) => m.origin && m.origin !== "quarter").length;
    return { quarter: q, rocks: rocks.length, progress, added };
  });

  return (
    <TasksShell quarterKey={activeKey}>
      <div className="card">
        <h2 className="mb-3 flex items-center gap-1.5 text-base font-extrabold text-ink">
          <Archive className="h-4.5 w-4.5" />
          ציר הזמן של הרבעונים ({rows.length})
        </h2>

        {rows.length === 0 ? (
          <div className="text-sm text-muted">עדיין לא נפתח אף רבעון.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map(({ quarter, rocks, progress, added }) => (
              <div
                key={quarter.id}
                className={`flex flex-wrap items-center gap-3 rounded-[11px] border border-card-border border-r-[3px] bg-white px-3 py-2.5 ${
                  quarter.status === "archived" ? "border-r-card-border" : "border-r-teal"
                }`}
              >
                <div className="min-w-[180px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/dashboard/duxus/rocks/quarter?q=${encodeURIComponent(quarter.id)}`} className="font-bold text-ink hover:underline">
                      {quarter.label}
                    </Link>
                    {quarter.status === "archived" ? (
                      <span className="flex items-center gap-1 rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[11px] font-bold text-muted">
                        <Lock className="h-3 w-3" />
                        ארכיון · קריאה בלבד
                      </span>
                    ) : (
                      <span className="rounded-full border border-teal bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">פעיל</span>
                    )}
                    {quarter.rolledFromKey ? (
                      <span className="rounded-full border border-purple/40 bg-[#f4ecf8] px-2 py-0.5 text-[11px] font-bold text-purple">
                        נפתח מרבעון קודם
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-muted">{formatRange(quarter.startDate, quarter.endDate)}</div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
                  <span>{rocks} סלעים</span>
                  <span>
                    {progress.done}/{progress.total} אבני דרך
                  </span>
                  {progress.cancelled ? <span>{progress.cancelled} בוטלו</span> : null}
                  {added ? <span>{added} נוספו תוך כדי</span> : null}
                  <span className="font-bold text-ink">{progress.percent}%</span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/duxus/rocks/quarter?q=${encodeURIComponent(quarter.id)}`}
                    className="rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#f4f6f9]"
                  >
                    צפייה
                  </Link>
                  <ArchiveActions quarterKey={quarter.id} label={quarter.label} status={quarter.status} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-card-border pt-3">
          <Link
            href={`/dashboard/duxus/rocks/rollover?q=${encodeURIComponent(activeKey)}`}
            className="flex w-fit items-center gap-1 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
          >
            <CalendarPlus className="h-3.5 w-3.5" />
            פתיחת רבעון חדש
          </Link>
        </div>
      </div>
    </TasksShell>
  );
}
