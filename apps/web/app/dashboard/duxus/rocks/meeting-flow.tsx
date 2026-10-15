"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Copy, Check, CalendarPlus } from "lucide-react";
import type { MeetingDecision, Milestone } from "@ultranet/shared-types";
import type { Board } from "./use-board";
import { listMeetingDecisions, type MeetingDecisionRecord } from "./actions";
import { MeetingPicker } from "./meeting-picker";
import { isOpenMilestone, STATUS_SHORT } from "./task-status";
import { monthLabel, weekKeyIndex, weekLabel } from "./date-utils";
import { ROCK_OWNERS } from "./owners";

type PeriodKind = "week" | "month";
type Step = 1 | 2 | 3 | 4;

const NO_OWNER = "ללא אחראי";

const DECISION_LABEL: Record<PeriodKind, Record<MeetingDecision, string>> = {
  week: { continue: "ממשיכים לשבוע הזה", replan: "חזרה לתכנון החודש", pause: "השהיה" },
  month: { continue: "ממשיכים לחודש הזה", replan: "חזרה לתכנון הרבעון", pause: "השהיה" },
};

const STEP_LABELS: { step: Step; label: string }[] = [
  { step: 1, label: "בדיקת ביצוע" },
  { step: 2, label: "מעבר על הפתוחות" },
  { step: 3, label: "בחירת התקופה הבאה" },
  { step: 4, label: "סיכום" },
];

function periodLabelOf(kind: PeriodKind, key: string): string {
  if (!key) return kind === "week" ? "שבוע שעוד לא נפתח" : "חודש שעוד לא נפתח";
  return kind === "week" ? weekLabel(key) : monthLabel(key);
}

function comparePeriodKeys(kind: PeriodKind, a: string, b: string): number {
  return kind === "week" ? weekKeyIndex(a) - weekKeyIndex(b) : a.localeCompare(b);
}

function ownerOf(m: Milestone): string {
  return m.ownerName?.trim() || NO_OWNER;
}

/** קיבוץ לפי אחראי, בסדר קבוע: האחראים הקבועים, אחריהם שמות אחרים, ובסוף "ללא אחראי". */
function groupByOwner(list: Milestone[]): { owner: string; items: Milestone[] }[] {
  const map = new Map<string, Milestone[]>();
  list.forEach((m) => map.set(ownerOf(m), [...(map.get(ownerOf(m)) ?? []), m]));
  const fixed: string[] = [...ROCK_OWNERS];
  const rank = (o: string) => (o === NO_OWNER ? 1000 : fixed.includes(o) ? fixed.indexOf(o) : 100);
  return Array.from(map.entries())
    .map(([owner, items]) => ({ owner, items }))
    .sort((a, b) => rank(a.owner) - rank(b.owner) || a.owner.localeCompare(b.owner, "he"));
}

function formatDate(ts: number): string {
  return ts ? new Date(ts).toLocaleDateString("he-IL") : "";
}

/**
 * "ניהול ישיבה" - הליך מונחה לישיבה שבועית/חודשית (אפיון סעיף 11 + מסמך המשך 28/29/51):
 *
 * 1. **בדיקת ביצוע** - מה נבחר לתקופה שחלפה ומה הושלם, לפי אחראי.
 * 2. **מעבר על הפתוחות** - לכל משימה שלא הושלמה החלטה מפורשת: להמשיך, להחזיר לתכנון
 *    או להשהות. שום דבר לא משתבץ לבד ושום משימה לא נעלמת - השהיה רק נרשמת ביומן.
 * 3. **בחירת התקופה הבאה** - מצב הבחירה הקיים (`MeetingPicker`) + תמונת עומס לפי
 *   אחראי (מספר משימות, לא שעות). רעיונות מתיבת הקליטה מוצגים כאן לבחירה.
 * 4. **סיכום קצר** - הושלם / נבחר / אחראי, עם העתקה. אין שליחה.
 *
 * הישיבה תמיד בוחרת ל**תקופה הפתוחה** (כמו קודם). התקופה שנבדקת בשלב 1 היא האחרונה
 * שלפניה; אם התקופה הפתוחה עצמה הסתיימה, פותחים תקופה חדשה מתוך שלב 1.
 */
export function MeetingFlow({ board, kind, onClose }: { board: Board; kind: PeriodKind; onClose: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [decisions, setDecisions] = useState<Record<string, MeetingDecision>>({});
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [savedDecisions, setSavedDecisions] = useState<{ milestone: Milestone; decision: MeetingDecision }[]>([]);
  const [pastDecisions, setPastDecisions] = useState<Record<string, MeetingDecisionRecord>>({});
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeKey = kind === "week" ? board.activeWeekKey : board.activeMonthKey;
  const activeLabel = periodLabelOf(kind, activeKey);
  const unit = kind === "week" ? "שבוע" : "חודש";

  useEffect(() => {
    let alive = true;
    void listMeetingDecisions(board.quarterKey)
      .then((d) => alive && setPastDecisions(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [board.quarterKey]);

  const byId = useMemo(() => new Map(board.milestones.map((m) => [m.id, m])), [board.milestones]);

  /** כל מפתחות התקופה מהסוג הזה שיש להם שיוך, מהישן לחדש. */
  const keys = useMemo(
    () =>
      Array.from(new Set(board.assignments.filter((a) => a.periodType === kind).map((a) => a.periodKey))).sort((a, b) =>
        comparePeriodKeys(kind, a, b)
      ),
    [board.assignments, kind]
  );
  const prevKey = useMemo(
    () => (activeKey ? (keys.filter((k) => comparePeriodKeys(kind, k, activeKey) < 0).pop() ?? "") : ""),
    [keys, activeKey, kind]
  );
  const reviewKey = prevKey || activeKey;

  const activeIds = useMemo(() => board.inPeriod(kind, activeKey), [board, kind, activeKey]);
  const reviewTasks = useMemo(() => {
    const ids = board.inPeriod(kind, reviewKey);
    return board.milestones.filter((m) => ids.has(m.id) && m.status !== "cancelled");
  }, [board, kind, reviewKey]);
  const reviewDone = reviewTasks.filter((m) => m.status === "done");
  const reviewOpen = reviewTasks.filter((m) => m.status !== "done");
  const activeOpenCount = board.milestones.filter((m) => activeIds.has(m.id) && isOpenMilestone(m)).length;

  /** מה שכבר הוחלט בישיבה הזו לא עולה שוב אם חוזרים לשלב 2. */
  const savedIds = useMemo(() => new Set(savedDecisions.map((d) => d.milestone.id)), [savedDecisions]);

  /**
   * המשימות שעולות להחלטה: פתוחות, היו משויכות לתקופה קודמת מאותו סוג, ועדיין לא
   * נמצאות בתקופה הפתוחה. משימה שהושהתה בעבר עולה שוב - היא לא נעלמת.
   */
  const unfinished = useMemo(() => {
    if (!activeKey) return [];
    const lastKeyById = new Map<string, string>();
    board.assignments
      .filter((a) => a.periodType === kind && comparePeriodKeys(kind, a.periodKey, activeKey) < 0)
      .forEach((a) => {
        const prev = lastKeyById.get(a.milestoneId);
        if (!prev || comparePeriodKeys(kind, a.periodKey, prev) > 0) lastKeyById.set(a.milestoneId, a.periodKey);
      });
    return board.milestones
      .filter((m) => lastKeyById.has(m.id) && isOpenMilestone(m) && !activeIds.has(m.id) && !savedIds.has(m.id))
      .map((m) => ({ milestone: m, fromKey: lastKeyById.get(m.id) ?? "" }));
  }, [board.assignments, board.milestones, activeIds, activeKey, kind, savedIds]);

  const decidedCount = unfinished.filter((u) => decisions[u.milestone.id]).length;

  /** מועמדות לשלב 3: כמו מסכי הבחירה הקיימים, ובנוסף רעיונות מתיבת הקליטה. */
  const candidates = useMemo(() => {
    const decidedAway = new Set(savedDecisions.filter((d) => d.decision !== "continue").map((d) => d.milestone.id));
    const base =
      kind === "week"
        ? board.milestones.filter((m) => (board.monthIds.has(m.id) || m.inbox) && isOpenMilestone(m))
        : board.milestones.filter((m) => isOpenMilestone(m));
    const continued = savedDecisions.filter((d) => d.decision === "continue").map((d) => byId.get(d.milestone.id) ?? d.milestone);
    const list = [...continued, ...base.filter((m) => !continued.some((c) => c.id === m.id))];
    return list.filter((m) => !decidedAway.has(m.id));
  }, [board.milestones, board.monthIds, byId, kind, savedDecisions]);

  const alreadyAssigned = kind === "week" ? board.weekIds : board.monthIds;

  async function saveDecisions() {
    const chosen = unfinished.flatMap((u) => {
      const decision = decisions[u.milestone.id];
      return decision ? [{ milestone: u.milestone, decision }] : [];
    });
    const list = chosen.map((c) => ({
      milestoneId: c.milestone.id,
      decision: c.decision,
      note: decisionNotes[c.milestone.id] ?? "",
    }));
    if (list.length) {
      setSaving(true);
      const ok = await board.recordDecisions(kind, list);
      setSaving(false);
      if (!ok) return;
      setSavedDecisions((prev) => [...prev.filter((p) => !chosen.some((c) => c.milestone.id === p.milestone.id)), ...chosen]);
      setDecisions({});
      setDecisionNotes({});
    }
    setStep(3);
  }

  function confirmSelection(ids: string[]) {
    if (kind === "week") {
      // רעיון מתיבת הקליטה שנבחר לשבוע נכנס גם לחודש הפתוח - כמו משימה שנוספת בשבוע.
      const inboxNotInMonth = ids.filter((id) => byId.get(id)?.inbox && !board.monthIds.has(id));
      board.assignBatch([
        { ids: inboxNotInMonth, periodType: "month", periodKey: board.activeMonthKey },
        { ids, periodType: "week", periodKey: board.activeWeekKey },
      ]);
    } else {
      board.assign(ids, "month", board.activeMonthKey);
    }
    setStep(4);
  }

  /** תמונת עומס (סעיף 51): כל משימה נספרת פעם אחת, לפי אחראי. מספר משימות - לא שעות. */
  function loadNode(selected: Set<string>) {
    const ids = new Set([...Array.from(activeIds), ...Array.from(selected)]);
    const tasks: Milestone[] = [];
    ids.forEach((id) => {
      const m = byId.get(id);
      if (m && m.status !== "cancelled") tasks.push(m);
    });
    const groups = groupByOwner(tasks);
    const owners = Array.from(new Set([...ROCK_OWNERS, ...groups.map((g) => g.owner)]));
    return (
      <div>
        <div className="mb-1.5 text-[11px] font-bold text-muted">עומס ה{unit} לפי אחראי - מספר משימות, לא שעות עבודה</div>
        <div className="flex flex-wrap gap-2">
          {owners.map((owner) => {
            const list = groups.find((g) => g.owner === owner)?.items ?? [];
            if (owner === NO_OWNER && list.length === 0) return null;
            const fresh = list.filter((m) => selected.has(m.id) && !activeIds.has(m.id)).length;
            return (
              <div key={owner} className="rounded-[11px] border border-card-border bg-[#f9fafb] px-3 py-1.5 text-xs">
                <span className="font-bold text-ink">{owner}</span>
                <span className="mr-1.5 text-lg font-extrabold leading-none text-teal-dark">{list.length}</span>
                <span className="text-muted">משימות</span>
                {fresh > 0 ? <span className="mr-1 text-[11px] text-muted">(+{fresh} בבחירה)</span> : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const stepper = (
    <ol className="flex flex-wrap items-center gap-1.5 border-b border-card-border bg-[#f9fafb] px-4 py-2 text-[11px]">
      {STEP_LABELS.map((s) => (
        <li key={s.step} className={s.step === step ? "pill-active !py-1 !text-[11px]" : "pill-inactive !py-1 !text-[11px]"}>
          {s.step < 4 ? `${s.step}. ` : ""}
          {s.label}
        </li>
      ))}
    </ol>
  );

  // --- שלב 3: מצב הבחירה הקיים, כשלב בתוך ההליך ---
  if (step === 3) {
    return (
      <MeetingPicker
        title={`ניהול ישיבה ${kind === "week" ? "שבועית" : "חודשית"} - בחירת ה${unit}`}
        subtitle={`${activeLabel} · בחירה מרובה, אישור אחד. שום דבר לא משתבץ בלי בחירה.`}
        candidates={candidates}
        rocks={board.rocks}
        alreadyAssigned={alreadyAssigned}
        toneContext={{ today: board.today, weekWarningActive: board.weekWarningActive }}
        confirmLabel={`הוספה ל${unit} והמשך לסיכום`}
        isPending={board.isPending}
        stepper={stepper}
        renderAside={loadNode}
        onBack={() => setStep(2)}
        onSkip={() => setStep(4)}
        onConfirm={confirmSelection}
        onClose={onClose}
      />
    );
  }

  // --- סיכום (סעיף 28) ---
  const selectedNow = board.milestones.filter((m) => board.inPeriod(kind, activeKey).has(m.id) && m.status !== "cancelled");
  const summaryText = (() => {
    const lines: string[] = [];
    lines.push(`סיכום ישיבה ${kind === "week" ? "שבועית" : "חודשית"} - ${new Date().toLocaleDateString("he-IL")}`);
    lines.push("");
    if (reviewKey) {
      lines.push(`הושלם ב${periodLabelOf(kind, reviewKey)}: ${reviewDone.length} מתוך ${reviewTasks.length}`);
      groupByOwner(reviewDone).forEach((g) => {
        lines.push(`${g.owner}:`);
        g.items.forEach((m) => lines.push(`  ✓ ${m.title}`));
      });
      lines.push("");
    }
    if (savedDecisions.length) {
      lines.push("החלטות על משימות פתוחות:");
      savedDecisions.forEach((d) => lines.push(`  • ${d.milestone.title} - ${DECISION_LABEL[kind][d.decision]}`));
      lines.push("");
    }
    lines.push(`נבחר ל${activeLabel}: ${selectedNow.length} משימות`);
    groupByOwner(selectedNow).forEach((g) => {
      lines.push(`${g.owner} (${g.items.length}):`);
      g.items.forEach((m) => lines.push(`  • ${m.title}${m.status === "done" ? " (הושלם)" : ""}`));
    });
    return lines.join("\n");
  })();

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      board.showError("ההעתקה נכשלה - אפשר לסמן את הטקסט ולהעתיק ידנית");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-black/30 p-3"
      role="dialog"
      aria-label="ניהול ישיבה"
    >
      <div className="mt-6 flex w-full max-w-3xl flex-col rounded-card bg-white shadow-xl">
        <header className="flex items-start justify-between gap-2 border-b border-card-border px-4 py-3">
          <div>
            <h2 className="text-base font-extrabold text-ink">ניהול ישיבה {kind === "week" ? "שבועית" : "חודשית"}</h2>
            <p className="text-[11px] text-muted">הישיבה בוחרת ל{activeLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="סגירה">
            <X className="h-4.5 w-4.5" />
          </button>
        </header>
        {stepper}

        <div className="max-h-[62vh] overflow-y-auto px-4 py-3">
          {step === 1 && (
            <div className="flex flex-col gap-3">
              {!reviewKey ? (
                <div className="rounded-lg border border-dashed border-card-border p-4 text-sm text-muted">
                  עוד אין {unit} קודם לבדוק. אפשר להמשיך ישר לבחירה.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-sm font-extrabold text-ink">{periodLabelOf(kind, reviewKey)}</h3>
                    <span className="text-xs text-muted">
                      הושלמו {reviewDone.length} מתוך {reviewTasks.length} שנבחרו
                    </span>
                  </div>
                  {reviewTasks.length === 0 ? (
                    <div className="text-xs text-muted">לא נבחרו משימות לתקופה הזו.</div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {groupByOwner(reviewTasks).map((g) => {
                        const done = g.items.filter((m) => m.status === "done").length;
                        return (
                          <div key={g.owner} className="rounded-[11px] border border-card-border p-2.5">
                            <div className="mb-1.5 flex items-center justify-between text-xs">
                              <span className="font-bold text-ink">{g.owner}</span>
                              <span className="text-muted">
                                {done}/{g.items.length} הושלמו
                              </span>
                            </div>
                            <ul className="flex flex-col gap-1 text-xs">
                              {g.items.map((m) => (
                                <li key={m.id} className="flex items-center gap-1.5">
                                  <span
                                    className={`h-2 w-2 shrink-0 rounded-full ${m.status === "done" ? "bg-emerald-500" : "bg-amber-400"}`}
                                    aria-hidden
                                  />
                                  <span className={`min-w-0 flex-1 truncate ${m.status === "done" ? "text-muted" : "text-ink"}`}>
                                    {m.title}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-muted">{STATUS_SHORT[m.status]}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {reviewOpen.length > 0 && reviewKey !== activeKey && (
                    <div className="text-xs text-muted">{reviewOpen.length} שלא הושלמו יעלו להחלטה בשלב הבא.</div>
                  )}
                </>
              )}

              {activeKey && activeOpenCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] border border-amber-300 bg-amber-50/60 p-3 text-xs text-amber-800">
                  <span>
                    {activeLabel} הפתוח כבר כולל {activeOpenCount} משימות פתוחות. אם ה{unit} הסתיים - פתחו {unit} חדש, ואז מה שלא
                    הושלם יעלה להחלטה בשלב הבא.
                  </span>
                  <button
                    type="button"
                    onClick={kind === "week" ? board.openNextWeek : board.openNextMonth}
                    disabled={board.isPending}
                    className="flex items-center gap-1 rounded-lg border border-amber-400 bg-white px-2.5 py-1 font-bold text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                  >
                    <CalendarPlus className="h-3.5 w-3.5" />
                    פתיחת {unit} חדש
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-2">
              {unfinished.length === 0 ? (
                <div className="rounded-lg border border-dashed border-card-border p-4 text-sm text-muted">
                  אין משימות פתוחות מ{unit} קודם שמחכות להחלטה.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-muted">
                      לכל משימה שלא הושלמה - החלטה מפורשת. השהיה משאירה אותה פתוחה, בלי שיבוץ, והיא תעלה שוב בישיבה הבאה.
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDecisions(Object.fromEntries(unfinished.map((u) => [u.milestone.id, "continue" as const])))
                      }
                      className="font-semibold text-teal hover:underline"
                    >
                      כולן ממשיכות
                    </button>
                  </div>
                  {unfinished.map(({ milestone: m, fromKey }) => {
                    const past = pastDecisions[m.id];
                    const chosen = decisions[m.id];
                    return (
                      <div key={m.id} className="rounded-[11px] border border-card-border p-2.5">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate font-semibold text-ink">{m.title}</span>
                          <span className="text-[11px] text-muted">{ownerOf(m)}</span>
                          <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[11px] font-bold text-muted">
                            {STATUS_SHORT[m.status]}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-muted">
                          {board.breadcrumb(m.rockId) || "משימה שוטפת"} · נבחרה ל{periodLabelOf(kind, fromKey)}
                          {m.nextAction ? ` · הפעולה הבאה: ${m.nextAction}` : ""}
                          {past
                            ? ` · החלטה קודמת: ${DECISION_LABEL[past.periodType === "month" ? "month" : "week"][past.decision] ?? past.decision} (${formatDate(past.at)})`
                            : ""}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {(["continue", "replan", "pause"] as MeetingDecision[]).map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDecisions((prev) => ({ ...prev, [m.id]: d }))}
                              aria-pressed={chosen === d}
                              className={`rounded-full border px-2.5 py-1 text-[12px] font-bold transition ${
                                chosen === d
                                  ? "border-teal bg-teal-bg text-teal-dark"
                                  : "border-card-border bg-white text-muted hover:bg-[#f4f6f9]"
                              }`}
                            >
                              {DECISION_LABEL[kind][d]}
                            </button>
                          ))}
                          <input
                            value={decisionNotes[m.id] ?? ""}
                            onChange={(e) => setDecisionNotes((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            placeholder="הערה (רשות)"
                            maxLength={200}
                            className="min-w-[140px] flex-1 rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1 text-xs focus:border-teal focus:bg-white focus:outline-none"
                          />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted">סיכום קצר להעתקה. שום דבר לא נשלח אוטומטית.</p>
              <pre className="whitespace-pre-wrap rounded-[11px] border border-card-border bg-[#f9fafb] p-3 font-sans text-xs leading-relaxed text-ink">
                {summaryText}
              </pre>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-b-card border-t border-card-border bg-white px-4 py-3">
          <span className="text-xs text-muted">
            {step === 2 && unfinished.length > 0 ? `הוחלט על ${decidedCount} מתוך ${unfinished.length}` : ""}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {step === 1 && (
              <>
                <button type="button" onClick={onClose} className="text-xs font-semibold text-muted hover:underline">
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!activeKey}
                  className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
                >
                  המשך למעבר על הפתוחות
                </button>
              </>
            )}
            {step === 2 && (
              <>
                <button type="button" onClick={() => setStep(1)} className="text-xs font-semibold text-muted hover:underline">
                  חזרה
                </button>
                <button
                  type="button"
                  onClick={saveDecisions}
                  disabled={saving || decidedCount < unfinished.length}
                  title={decidedCount < unfinished.length ? "יש לבחור החלטה לכל משימה" : undefined}
                  className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "שומר..." : unfinished.length ? "שמירת ההחלטות והמשך" : "המשך לבחירה"}
                </button>
              </>
            )}
            {step === 4 && (
              <>
                <button type="button" onClick={() => setStep(3)} className="text-xs font-semibold text-muted hover:underline">
                  חזרה לבחירה
                </button>
                <button type="button" onClick={copySummary} className="btn-outline flex items-center gap-1 px-3 py-1.5 text-xs">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "הועתק" : "העתקת הסיכום"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
                >
                  סיום
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
