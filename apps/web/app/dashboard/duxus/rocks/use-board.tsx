"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  Milestone,
  MilestoneOrigin,
  MilestonePriority,
  MilestoneStatus,
  PeriodType,
  Rock,
} from "@ultranet/shared-types";
import { DeleteDialog } from "./delete-dialog";
import type { RockDeletionSummary } from "./actions";
import {
  assignMilestonesAction,
  createMilestoneAction,
  createRockAction,
  deleteMilestoneAction,
  deleteRockAction,
  getRockDeletionSummary,
  openNextMonthAction,
  openNextWeekAction,
  reopenMilestoneAction,
  setMilestoneStatusAction,
  setRockDroppedAction,
  unassignMilestoneAction,
  updateMilestoneAction,
  updateRockAction,
  type QuarterBoard,
} from "./actions";
import { assignmentId, milestoneIdsInPeriod, type ToneContext } from "./task-status";
import { useToast } from "@/lib/toast";
import { buildRocksById, rockBreadcrumb } from "./rock-lookup";
import type { MilestonePatch } from "./milestone-panel";

/** מה שממתין לאישור מחיקה. הסיכום של סלע נטען אסינכרונית ומגיע רגע אחרי הפתיחה. */
type PendingDelete =
  | { kind: "milestone"; milestone: Milestone }
  | { kind: "rock"; rock: Rock; summary?: RockDeletionSummary }
  | null;

function tempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * המצב המשותף לכל מסכי המשימות. הלוח נטען פעם אחת בשרת (`loadQuarterBoard`) ומועבר
 * לכאן; ההוק מחזיק עותק מקומי לעדכון אופטימי, כדי שהמסך יגיב מיד ולא ימתין לשרת -
 * ובכל כישלון מחזיר את המצב הקודם ומציג הודעה.
 *
 * `today` ו-`weekWarningActive` מגיעים מהשרת ולא מחושבים כאן, כדי שהצביעה תהיה
 * זהה בשרת ובלקוח.
 */
export function useBoard(board: QuarterBoard, today: string, weekWarningActive: boolean) {
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();

  const [rocks, setRocks] = useState(board.rocks);
  const [milestones, setMilestones] = useState(board.milestones);
  const [assignments, setAssignments] = useState(board.assignments);
  const [openMilestoneId, setOpenMilestoneId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  useEffect(() => setRocks(board.rocks), [board.rocks]);
  useEffect(() => setMilestones(board.milestones), [board.milestones]);
  useEffect(() => setAssignments(board.assignments), [board.assignments]);

  const quarterKey = board.quarter.id;
  const readOnly = board.quarter.status === "archived";
  const rocksById = useMemo(() => buildRocksById(rocks), [rocks]);

  const weekIds = useMemo(
    () => milestoneIdsInPeriod(assignments, "week", board.activeWeekKey),
    [assignments, board.activeWeekKey]
  );
  const monthIds = useMemo(
    () => milestoneIdsInPeriod(assignments, "month", board.activeMonthKey),
    [assignments, board.activeMonthKey]
  );

  const inPeriod = useCallback(
    (periodType: PeriodType, periodKey: string) => milestoneIdsInPeriod(assignments, periodType, periodKey),
    [assignments]
  );

  const toneContext = useCallback(
    (m: Milestone): ToneContext => ({ today, weekWarningActive, inCurrentWeek: weekIds.has(m.id) }),
    [today, weekWarningActive, weekIds]
  );

  const breadcrumb = useCallback((rockId: string) => rockBreadcrumb(rockId, rocksById), [rocksById]);

  const openMilestone = useMemo(
    () => milestones.find((m) => m.id === openMilestoneId) ?? null,
    [milestones, openMilestoneId]
  );

  function patchMilestone(id: string, patch: Partial<Milestone>) {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  // --- סטטוסים ---

  /**
   * שינוי סטטוס. המתנה וביטול מחייבים הערה/סיבה (סעיף 6) ולכן נשאלים כאן לפני
   * הקריאה לשרת; השרת אוכף את אותו כלל שוב, כדי שזו לא תהיה הגנה בממשק בלבד.
   */
  const setStatus = useCallback(
    (m: Milestone, status: MilestoneStatus) => {
      if (status === m.status) return;
      if (m.status === "done" && status !== "done") {
        showError("אבן דרך שהושלמה נפתחת מחדש בפעולה מפורשת - לחצו על סימון ההשלמה");
        return;
      }
      let reason = "";
      let waitUntil = "";
      if (status === "waiting") {
        reason = prompt("במי או במה תלוי הביצוע?")?.trim() ?? "";
        if (!reason) return;
        waitUntil = prompt("תאריך מעקב (רשות, YYYY-MM-DD):")?.trim() ?? "";
      }
      if (status === "cancelled") {
        reason = prompt("מה סיבת הביטול?")?.trim() ?? "";
        if (!reason) return;
      }

      const before = m.status;
      patchMilestone(m.id, {
        status,
        done: status === "done",
        waitReason: status === "waiting" ? reason : m.waitReason,
        cancelReason: status === "cancelled" ? reason : m.cancelReason,
      });
      startTransition(async () => {
        const result = await setMilestoneStatusAction(m.id, status, { reason, waitUntil });
        if (!result.ok) {
          showError(result.message);
          patchMilestone(m.id, { status: before, done: before === "done" });
        }
      });
    },
    [showError]
  );

  const complete = useCallback(
    (m: Milestone) => setStatus(m, "done"),
    [setStatus]
  );

  /** פתיחה מחדש - פעולה מפורשת עם סיבה, כדי למנוע ביטול השלמה בטעות (סעיף 7.5). */
  const reopen = useCallback(
    (m: Milestone) => {
      const reason = prompt("פתיחה מחדש של משימה שהושלמה. מה הסיבה?")?.trim() ?? "";
      if (!reason) return;
      patchMilestone(m.id, { status: "in_progress", done: false });
      startTransition(async () => {
        const result = await reopenMilestoneAction(m.id, reason);
        if (!result.ok) {
          showError(result.message);
          patchMilestone(m.id, { status: m.status, done: m.status === "done" });
        }
      });
    },
    [showError]
  );

  // --- עריכה ומחיקה ---

  const saveMilestone = useCallback(
    async (patch: MilestonePatch, expectedUpdatedAt: number): Promise<boolean> => {
      if (!openMilestoneId) return false;
      const result = await updateMilestoneAction(openMilestoneId, patch, expectedUpdatedAt);
      if (!result.ok) {
        showError(result.message);
        router.refresh();
        return false;
      }
      patchMilestone(openMilestoneId, { ...patch, updatedAt: Date.now() });
      showSuccess("אבן הדרך נשמרה");
      router.refresh();
      return true;
    },
    [openMilestoneId, router, showError, showSuccess]
  );

  /**
   * מחיקה נפתחת תמיד בדיאלוג ולא ב-`confirm`, כי יש **שתי** תשובות אפשריות
   * ולא אחת: ארכוב (יורד מהלוח, נשמר בהיסטוריה) או מחיקה לצמיתות.
   */
  const removeMilestone = useCallback((m: Milestone) => setPendingDelete({ kind: "milestone", milestone: m }), []);

  const runDeleteMilestone = useCallback(
    (m: Milestone, permanent: boolean) => {
      setPendingDelete(null);
      setMilestones((prev) => prev.filter((x) => x.id !== m.id));
      setOpenMilestoneId((id) => (id === m.id ? null : id));
      startTransition(async () => {
        const result = await deleteMilestoneAction(m.id, permanent);
        if (!result.ok) {
          showError(result.message);
          setMilestones((prev) => [...prev, m]);
          return;
        }
        showSuccess(permanent ? "אבן הדרך נמחקה לצמיתות" : "אבן הדרך ירדה מהלוח ונשמרה בהיסטוריה");
        router.refresh();
      });
    },
    [router, showError, showSuccess]
  );

  // --- שיוכי תקופה ---

  /** שיוך מרוכז - רשומה אחת לכל אבן דרך, בלי שכפול, ובאישור אחד (סעיף 7.4). */
  const assign = useCallback(
    (ids: string[], periodType: PeriodType, periodKey: string) => {
      if (!ids.length) return;
      const now = Date.now();
      setAssignments((prev) => [
        ...prev,
        ...ids
          .filter((id) => !prev.some((a) => a.id === assignmentId(id, periodType, periodKey)))
          .map((id) => ({
            id: assignmentId(id, periodType, periodKey),
            milestoneId: id,
            quarterKey,
            periodType,
            periodKey,
            assignedAt: now,
            outcome: "open" as const,
          })),
      ]);
      startTransition(async () => {
        const result = await assignMilestonesAction(ids, periodType, periodKey, quarterKey);
        if (!result.ok) {
          showError(result.message);
          router.refresh();
          return;
        }
        showSuccess(`נוספו ${result.count} אבני דרך ל${periodType === "week" ? "שבוע" : periodType === "month" ? "חודש" : "רבעון"}`);
        router.refresh();
      });
    },
    [quarterKey, router, showError, showSuccess]
  );

  const unassign = useCallback(
    (m: Milestone, periodType: PeriodType, periodKey: string) => {
      const reason = prompt("הסרה מהתכנון של התקופה הנוכחית. מה הסיבה?")?.trim() ?? "";
      if (!reason) return;
      const id = assignmentId(m.id, periodType, periodKey);
      const removed = assignments.find((a) => a.id === id);
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      startTransition(async () => {
        const result = await unassignMilestoneAction(m.id, periodType, periodKey, reason);
        if (!result.ok) {
          showError(result.message);
          if (removed) setAssignments((prev) => [...prev, removed]);
        }
      });
    },
    [assignments, showError]
  );

  // --- יצירה ---

  const createMilestone = useCallback(
    (input: {
      rockId: string;
      title: string;
      ownerName?: string;
      dueDate?: string;
      priority?: MilestonePriority;
      origin?: MilestoneOrigin;
      source?: "rock" | "adhoc";
      assignTo?: { periodType: PeriodType; periodKey: string }[];
    }) => {
      const id = tempId();
      const now = Date.now();
      setMilestones((prev) => [
        ...prev,
        {
          id,
          rockId: input.source === "adhoc" ? "" : input.rockId,
          quarterKey,
          title: input.title,
          ownerName: input.ownerName ?? "",
          status: "not_started",
          done: false,
          priority: input.priority ?? "normal",
          dueDate: input.dueDate ?? "",
          carryOverCount: 0,
          reopenCount: 0,
          source: input.source ?? "rock",
          origin: input.origin ?? "quarter",
          order: now,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      setAssignments((prev) => [
        ...prev,
        ...(input.assignTo ?? []).map((a) => ({
          id: assignmentId(id, a.periodType, a.periodKey),
          milestoneId: id,
          quarterKey,
          periodType: a.periodType,
          periodKey: a.periodKey,
          assignedAt: now,
          outcome: "open" as const,
        })),
      ]);
      startTransition(async () => {
        const result = await createMilestoneAction({ ...input, quarterKey });
        if (!result.ok) {
          showError(result.message);
          setMilestones((prev) => prev.filter((m) => m.id !== id));
          setAssignments((prev) => prev.filter((a) => a.milestoneId !== id));
          return;
        }
        router.refresh();
      });
    },
    [quarterKey, router, showError]
  );

  const createRock = useCallback(
    (input: { title: string; description?: string; parentRockId?: string | null; ownerName?: string; dueDate?: string }) => {
      const id = tempId();
      const now = Date.now();
      setRocks((prev) => [
        ...prev,
        {
          id,
          title: input.title,
          description: input.description ?? "",
          quarterKey,
          parentRockId: input.parentRockId ?? null,
          ownerName: input.ownerName ?? "",
          dueDate: input.dueDate ?? "",
          status: "active",
          order: now,
          createdAt: now,
          updatedAt: now,
        },
      ]);
      startTransition(async () => {
        const result = await createRockAction({ ...input, quarterKey });
        if (!result.ok) {
          showError(result.message);
          setRocks((prev) => prev.filter((r) => r.id !== id));
          return;
        }
        router.refresh();
      });
    },
    [quarterKey, router, showError]
  );

  const saveRock = useCallback(
    (rock: Rock, patch: { title?: string; description?: string; ownerName?: string; dueDate?: string }) => {
      setRocks((prev) => prev.map((r) => (r.id === rock.id ? { ...r, ...patch } : r)));
      startTransition(async () => {
        const result = await updateRockAction(rock.id, patch);
        if (!result.ok) {
          showError(result.message);
          setRocks((prev) => prev.map((r) => (r.id === rock.id ? rock : r)));
        }
      });
    },
    [showError]
  );

  /** ביטול סלע - ההחלטה הידנית היחידה על סלע. "הושלם" תמיד מחושב (סעיף 19). */
  const dropRock = useCallback(
    (rock: Rock) => {
      const dropped = rock.status !== "dropped";
      const reason = dropped ? (prompt(`ביטול הסלע "${rock.title}". מה הסיבה?`)?.trim() ?? "") : "";
      if (dropped && !reason) return;
      setRocks((prev) => prev.map((r) => (r.id === rock.id ? { ...r, status: dropped ? "dropped" : "active" } : r)));
      startTransition(async () => {
        const result = await setRockDroppedAction(rock.id, dropped, reason);
        if (!result.ok) {
          showError(result.message);
          setRocks((prev) => prev.map((r) => (r.id === rock.id ? rock : r)));
          return;
        }
        router.refresh();
      });
    },
    [router, showError]
  );

  /** נטען קודם סיכום מה-שרת, כדי שהדיאלוג יציג בדיוק מה ייעלם ולא ינחש. */
  const removeRock = useCallback((rock: Rock) => {
    setPendingDelete({ kind: "rock", rock });
    void getRockDeletionSummary(rock.id).then((summary) =>
      setPendingDelete((current) => (current?.kind === "rock" && current.rock.id === rock.id ? { ...current, summary } : current))
    );
  }, []);

  const runDeleteRock = useCallback(
    (rock: Rock, permanent: boolean) => {
      setPendingDelete(null);
      setRocks((prev) => prev.filter((r) => r.id !== rock.id));
      startTransition(async () => {
        const result = await deleteRockAction(rock.id, permanent);
        if (!result.ok) {
          showError(result.message);
          setRocks((prev) => [...prev, rock]);
          return;
        }
        showSuccess(permanent ? "הסלע נמחק לצמיתות" : "הסלע ירד מהלוח ונשמר בהיסטוריה");
        router.refresh();
      });
    },
    [router, showError, showSuccess]
  );

  // --- פתיחת תקופה חדשה ---

  const openNextWeek = useCallback(() => {
    if (
      board.activeWeekKey &&
      !confirm("לפתוח שבוע חדש? תוצאות ההתחייבות של השבוע הנוכחי ננעלות, והוא יורד ל\"שבועות קודמים\".")
    )
      return;
    startTransition(async () => {
      const result = await openNextWeekAction(quarterKey, board.activeWeekKey, board.activeMonthKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess("נפתח שבוע חדש");
      router.refresh();
    });
  }, [board.activeWeekKey, board.activeMonthKey, quarterKey, router, showError, showSuccess]);

  const openNextMonth = useCallback(() => {
    if (board.activeMonthKey && !confirm("לפתוח חודש חדש? תוצאות ההתחייבות של החודש הנוכחי ננעלות.")) return;
    startTransition(async () => {
      const result = await openNextMonthAction(quarterKey, board.activeMonthKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess("נפתח חודש חדש");
      router.refresh();
    });
  }, [board.activeMonthKey, quarterKey, router, showError, showSuccess]);

  const deleteDialogNode = (() => {
    if (!pendingDelete) return null;

    if (pendingDelete.kind === "milestone") {
      const m = pendingDelete.milestone;
      const assignmentCount = assignments.filter((a) => a.milestoneId === m.id).length;
      // אבן דרך טרייה בלי שום שיוך ובלי היסטוריה - אין מה לארכב, רק למחוק.
      const hasHistory = assignmentCount > 0 || m.status !== "not_started";
      return (
        <DeleteDialog
          title={`מחיקת "${m.title}"`}
          lines={[
            "אבן הדרך עצמה",
            `${assignmentCount} שיוכי תקופה (רבעון / חודש / שבוע)`,
            "יומן הפעולות של אבן הדרך",
          ]}
          archiveLabel={hasHistory ? "ארכוב" : undefined}
          archiveHint="ארכוב מוריד את אבן הדרך מהלוח אך משאיר אותה בהיסטוריה ובדוחות. מחיקה לצמיתות אינה הפיכה."
          isPending={isPending}
          onArchive={() => runDeleteMilestone(m, false)}
          onPermanent={() => runDeleteMilestone(m, true)}
          onClose={() => setPendingDelete(null)}
        />
      );
    }

    const { rock, summary } = pendingDelete;
    const hasChildren = (summary?.subRocks ?? 0) > 0 || (summary?.milestones ?? 0) > 0;
    return (
      <DeleteDialog
        title={`מחיקת הסלע "${rock.title}"`}
        lines={
          summary
            ? [
                "הסלע עצמו",
                `${summary.subRocks} תתי-סלעים`,
                `${summary.milestones} אבני דרך`,
                `${summary.assignments} שיוכי תקופה ויומן הפעולות שלהם`,
              ]
            : ["טוען את פירוט התכולה..."]
        }
        archiveLabel={hasChildren ? "ארכוב" : undefined}
        archiveHint="ארכוב מוריד את הסלע וכל מה שתחתיו מהלוח, אך משאיר הכל בהיסטוריה. מחיקה לצמיתות אינה הפיכה."
        requireTyping={hasChildren}
        isPending={isPending}
        onArchive={() => runDeleteRock(rock, false)}
        onPermanent={() => runDeleteRock(rock, true)}
        onClose={() => setPendingDelete(null)}
      />
    );
  })();

  return {
    quarterKey,
    readOnly,
    today,
    weekWarningActive,
    settings: board.settings,
    activeMonthKey: board.activeMonthKey,
    activeWeekKey: board.activeWeekKey,
    rocks,
    milestones,
    assignments,
    rocksById,
    weekIds,
    monthIds,
    inPeriod,
    toneContext,
    breadcrumb,
    isPending,
    toastNode,
    deleteDialogNode,
    showError,
    showSuccess,
    openMilestone,
    setOpenMilestoneId,
    setStatus,
    complete,
    reopen,
    saveMilestone,
    removeMilestone,
    assign,
    unassign,
    createMilestone,
    createRock,
    saveRock,
    dropRock,
    removeRock,
    openNextWeek,
    openNextMonth,
  };
}

export type Board = ReturnType<typeof useBoard>;
