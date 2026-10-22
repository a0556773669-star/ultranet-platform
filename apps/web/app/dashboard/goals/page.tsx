import Link from "next/link";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { currentMonth, loadGoalsBoard } from "@/lib/goals";
import { importGoalsAction } from "./actions";
import { GoalsBoard } from "./goals-board";

export const dynamic = "force-dynamic";

function shift(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const idx = (y ?? 1970) * 12 + ((m ?? 1) - 1) + delta;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

function monthTitle(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
}

/**
 * יעדים — יעד המחזור החודשי של כל סניף וקו עסקי מול מה שנכנס בפועל באתר. היעדים מיובאים מקובץ
 * אקסל (בלי חיבור חי לגיליון); הביצוע מחושב בכל טעינה, ראו `lib/goals.ts`. בעלים בלבד.
 */
export default async function GoalsPage({
  searchParams,
}: {
  searchParams?: { month?: string; imported?: string; importError?: string };
}) {
  await requireOwner();
  const now = currentMonth();
  const month = searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : now;
  const board = await loadGoalsBoard(month);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Flag className="h-5 w-5 text-teal" />
            יעדים
          </h1>
          <p className="mt-0.5 max-w-2xl text-[12.5px] text-muted">
            יעד המחזור החודשי של כל סניף מול מה שנכנס בפועל באתר. היעדים נטענים מקובץ האקסל; הביצוע מתעדכן
            אוטומטית מהנתונים בכל כניסה.
          </p>
        </div>
        <form
          action={importGoalsAction}
          className="flex items-center gap-2 rounded-[10px] border border-card-border bg-white px-3 py-1.5"
        >
          <input type="file" name="file" accept=".xlsx,.xls" required className="text-xs" />
          <button type="submit" className="text-xs font-bold text-teal hover:underline">
            {board.rows.length ? "עדכון יעדים מאקסל" : "טעינת יעדים מאקסל"}
          </button>
        </form>
      </div>

      {searchParams?.importError && (
        <div className="rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {searchParams.importError === "missing"
            ? "יש לבחור קובץ אקסל לפני הטעינה."
            : 'לא נמצאה בקובץ טבלה עם עמודת "מחזור". הקובץ צריך להיות באותו מבנה כמו קובץ היעדים.'}
        </div>
      )}
      {searchParams?.imported && (
        <div className="rounded-card border border-teal-200 bg-teal-50 p-3 text-sm font-semibold text-teal-700">
          נטענו {searchParams.imported} שורות יעד. בדוק שכל שורה מחוברת לסניף הנכון (עמודת &quot;נמדד מול&quot;).
        </div>
      )}

      <div className="flex items-center gap-2">
        <Link href={`/dashboard/goals?month=${shift(month, -1)}`} className="btn-outline inline-flex items-center px-2 py-1">
          <ChevronRight className="h-4 w-4" />
        </Link>
        <span className="min-w-[120px] text-center text-sm font-extrabold text-ink">{monthTitle(month)}</span>
        <Link
          href={`/dashboard/goals?month=${shift(month, 1)}`}
          className={`btn-outline inline-flex items-center px-2 py-1 ${month >= now ? "pointer-events-none opacity-40" : ""}`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        {month !== now && (
          <Link href="/dashboard/goals" className="text-xs font-bold text-teal hover:underline">
            לחודש הנוכחי
          </Link>
        )}
      </div>

      {board.rows.length === 0 ? (
        <div className="rounded-card border border-card-border bg-white p-8 text-center text-sm text-muted">
          עוד לא נטענו יעדים. בחר את קובץ האקסל של היעדים למעלה ולחץ &quot;טעינת יעדים מאקסל&quot;.
        </div>
      ) : (
        <GoalsBoard board={board} isCurrent={month === now} />
      )}
    </div>
  );
}
