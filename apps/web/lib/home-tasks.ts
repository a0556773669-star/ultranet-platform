import { listQuarters, loadQuarterBoard } from "@/app/dashboard/duxus/rocks/actions";
import { loadPersonalBoard } from "@/app/dashboard/duxus/personal/actions";
import { computeProgress, milestoneIdsInPeriod } from "@/app/dashboard/duxus/rocks/task-status";

/**
 * תקציר המשימות לדף הבית (אפיון שדרוג v2, סעיף 1). **קריאה בלבד** — אותם טוענים שמסכי
 * המשימות משתמשים בהם, בלי שום כתיבה ובלי מקור נתונים נוסף.
 *
 * - `personal` — "משימות ליוני": פתוחות ומתוכן דחופות. `null` כשאין למשתמש גישה לטאב.
 * - `week` — השבוע הפתוח: כמה אבני דרך נבחרו לו וכמה מהן הושלמו. `null` כשעוד לא נפתח שבוע.
 * - `rocks` — הסלעים של הרבעון הפעיל (בלי תתי-סלעים ובלי סלעים שבוטלו) והתקדמותם, לפי
 *   `computeProgress` — אותו חישוב של מסך הרבעון.
 *
 * מדדי השבוע והרבעון יכולים לחפוף בכוונה (אותה אבן דרך שייכת לשניהם), ולכן לא מחברים אותם.
 */
export type HomeTasks = {
  personal: { open: number; urgent: number } | null;
  week: { selected: number; done: number } | null;
  quarterLabel: string;
  rocks: { id: string; title: string; percent: number; total: number }[];
};

export async function loadHomeTasks(): Promise<HomeTasks> {
  const [quarters, personalBoard] = await Promise.all([listQuarters(), loadPersonalBoard()]);

  const personal =
    personalBoard.access === "none"
      ? null
      : {
          open: personalBoard.active.length,
          urgent: personalBoard.active.filter((t) => t.priority === "urgent").length,
        };

  const quarter = quarters.find((q) => q.status === "active");
  if (!quarter) return { personal, week: null, quarterLabel: "", rocks: [] };

  const board = await loadQuarterBoard(quarter.id);

  let week: HomeTasks["week"] = null;
  if (board.activeWeekKey) {
    const ids = milestoneIdsInPeriod(board.assignments, "week", board.activeWeekKey);
    const inWeek = board.milestones.filter((m) => ids.has(m.id));
    week = { selected: inWeek.length, done: inWeek.filter((m) => m.status === "done").length };
  }

  const topRocks = board.rocks.filter(
    (r) => r.quarterKey === quarter.id && !r.parentRockId && r.status !== "dropped",
  );
  const rocks = topRocks.map((rock) => {
    const familyIds = new Set([rock.id, ...board.rocks.filter((r) => r.parentRockId === rock.id).map((r) => r.id)]);
    const progress = computeProgress(board.milestones.filter((m) => familyIds.has(m.rockId)));
    return { id: rock.id, title: rock.title, percent: progress.percent, total: progress.total };
  });

  return { personal, week, quarterLabel: quarter.label, rocks };
}
