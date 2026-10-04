import type { ReactNode } from "react";
import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../duxus-tabs";
import { TasksTabs } from "./tasks-tabs";
import { listQuarters, loadQuarterBoard, type QuarterBoard } from "./actions";
import { currentQuarterKey, todayIso, weekWarningActive } from "./date-utils";
import type { Quarter } from "@ultranet/shared-types";

export type TasksPageData = {
  quarters: Quarter[];
  board: QuarterBoard;
  /** "YYYY-MM-DD" שמחושב בשרת ומועבר ללקוח, כדי שהצביעה תהיה זהה בשני הצדדים */
  today: string;
  /** האם עבר מועד האזהרה השבועית לפי הגדרות המערכת */
  weekWarning: boolean;
};

/**
 * טעינה משותפת לכל מסכי המשימות: הרבעון הנבחר (`?q=`, וכברירת מחדל הפעיל האחרון),
 * הלוח המלא שלו בשליפה אחת, והנתונים התלויים-תאריך שמחושבים בשרת בלבד.
 */
export async function loadTasksPage(q?: string): Promise<TasksPageData> {
  await requireModuleAccess("duxus");
  const quarters = await listQuarters();
  const quarterKey = q || quarters.find((x) => x.status === "active")?.id || quarters[0]?.id || currentQuarterKey();
  const board = await loadQuarterBoard(quarterKey);
  return {
    quarters,
    board,
    today: todayIso(),
    weekWarning: weekWarningActive(board.settings.warningWeekday, board.settings.weekStartDay),
  };
}

/** הכותרת והלשוניות - זהות בכל ארבעת מסכי המשימות. */
export function TasksShell({ quarterKey, children }: { quarterKey: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Target className="h-5 w-5" />
        משימות ונהלים
      </h1>
      <DuxusTabs />
      <TasksTabs quarterKey={quarterKey} />
      {children}
    </div>
  );
}
