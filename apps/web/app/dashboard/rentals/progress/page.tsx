import { Gauge } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { loadBranchProgressBoard, STAGES } from "@/lib/branch-progress";
import { ProgressBoard } from "./progress-board";

export const dynamic = "force-dynamic";

/**
 * מדד סניפים — איפה כל סניף השכרות אוחז בדרך מהפתיחה ועד 150 ₪ נטו למחשב, ואיפה כל הרשת יחד.
 * החישוב ב-`lib/branch-progress.ts`; כאן רק התצוגה. בעלים בלבד.
 */
export default async function BranchProgressPage() {
  await requireOwner();
  const board = await loadBranchProgressBoard();

  const total = board.rows.length;
  const doneStages = board.rows.reduce((s, r) => s + r.doneCount, 0);
  const overallPct = total > 0 ? Math.round((doneStages / (total * STAGES.length)) * 100) : 0;
  const finished = board.rows.filter((r) => r.currentStage === 8).length;
  // כמה סניפים השלימו כל שלב (לא בהכרח ברצף) — המשפך של הרשת.
  const perStage = STAGES.map((s) => ({
    ...s,
    count: board.rows.filter((r) => r.stages.find((x) => x.no === s.no)?.done).length,
  }));
  // איפה כל סניף "עומד": השלב הראשון שעוד פתוח.
  const standing = [...STAGES.map((s) => s.no as number), 8].map((no) => ({
    no,
    branches: board.rows.filter((r) => r.currentStage === no).map((r) => r.name),
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="flex items-center gap-1.5 text-[19px] font-extrabold text-ink">
          <Gauge className="h-5 w-5 text-teal" />
          מדד סניפים
        </h2>
        <p className="mt-0.5 text-[12.5px] text-muted">
          כל סניפי ההשכרות הפעילים, שבעה שלבים עד היעד. שלבים 1, 4 ו-7 מתעדכנים אוטומטית מהנתונים; את השאר מסמנים
          בלחיצה.
        </p>
      </div>

      <ProgressBoard
        rows={board.rows}
        stages={STAGES}
        target={board.target}
        summary={{ total, overallPct, finished, perStage, standing }}
      />
    </div>
  );
}
