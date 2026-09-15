import Link from "next/link";
import { Layers, ArrowLeft } from "lucide-react";
import type { Branch, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { SHARED_EXPENSE_BRANCH_ID } from "@/lib/computer-room-accounting";
import { sharedExpenseBranchIds } from "@/lib/expense-shared-scope";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * "מאיפה הגיעה ההוצאה הזו?" - הכרטיס שעונה על זה בתוך מסך הסניף.
 *
 * סניף שנפתח היום יורש מיד את ההוצאות המשותפות של המודול, וזה היה בלתי נראה: המספר הופיע
 * בהנה"ח ולא הייתה שום דרך להגיע מהסניף אל ההוצאה שיצרה אותו. כאן מופיעה כל הוצאה משותפת
 * שחלה על הסניף, המחלק שלה, וכמה היא מוסיפה לסניף הזה - עם קישור לספר המשותף לעריכה או
 * להוצאת הסניף מהחלוקה.
 */
export function SharedExpensesForBranch({
  branchId,
  branches,
  sharedFixed,
  sharedVariable,
}: {
  branchId: string;
  /** כל סניפי חדרי המחשבים הפעילים - המחלק של הוצאה שחלה על "כל הסניפים" */
  branches: Branch[];
  sharedFixed: FixedExpense[];
  sharedVariable: VariableExpense[];
}) {
  const allIds = branches.map((b) => b.id);
  const rows = [
    ...sharedFixed.map((e) => {
      const scope = sharedExpenseBranchIds(e, allIds);
      const monthly = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
      return {
        id: e.id,
        label: e.name,
        scope,
        explicit: (e.branchIds?.length ?? 0) > 0,
        ended: Boolean(e.endDate),
        detail: `${money(monthly)} לחודש ÷ ${scope.length} סניפים${e.endDate ? ` · הסתיימה ב-${e.endDate}` : ""}`,
        share: scope.length > 0 ? monthly / scope.length : 0,
        shareSuffix: "לחודש",
      };
    }),
    ...sharedVariable.map((e) => {
      const scope = sharedExpenseBranchIds(e, allIds);
      return {
        id: e.id,
        label: e.desc,
        scope,
        explicit: (e.branchIds?.length ?? 0) > 0,
        ended: false,
        detail: `${money(e.amount || 0)} ÷ ${scope.length} סניפים · ${e.date}`,
        share: scope.length > 0 ? (e.amount || 0) / scope.length : 0,
        shareSuffix: "",
      };
    }),
  ].filter((r) => r.scope.includes(branchId));

  return (
    <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Layers className="h-4 w-4" />
          הוצאות משותפות שחלות גם על הסניף הזה ({rows.length})
        </h3>
        <Link
          href={`/dashboard/expenses/${SHARED_EXPENSE_BRANCH_ID}`}
          className="flex items-center gap-1.5 text-xs font-bold text-teal hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          לספר ההוצאות של כל הסניפים
        </Link>
      </div>
      <p className="mb-2.5 text-[11.5px] leading-relaxed text-muted">
        אלה לא הוצאות של הסניף — הן נרשמו פעם אחת על כמה סניפים, והסניף נושא בחלק שלו בהנה&quot;ח.
        סניף חדש נכנס אוטומטית לכל הוצאה שסומנה &quot;כל הסניפים&quot;; כדי להוציא אותו ממנה, פתח את
        ההוצאה בספר המשותף ובחר בה סניפים מסוימים.
      </p>
      {rows.length === 0 && <p className="text-sm text-muted">אין הוצאות משותפות שחלות על הסניף הזה</p>}
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border border-card-border bg-[#f9fafb] p-3 ${
              r.ended ? "opacity-70" : ""
            }`}
          >
            <div>
              <p className="text-sm font-bold text-ink">
                {r.label}
                <span className="mr-1.5 rounded-full bg-[#eef2f6] px-2 py-0.5 text-[10.5px] font-bold text-muted">
                  {r.explicit ? "סניפים נבחרים" : "כל הסניפים"}
                </span>
              </p>
              <p className="text-xs text-muted">{r.detail}</p>
            </div>
            <p className="text-sm font-extrabold text-red-600">
              {money(r.share)} {r.shareSuffix}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
