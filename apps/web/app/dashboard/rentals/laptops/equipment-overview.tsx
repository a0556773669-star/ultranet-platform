import { ChevronDown, Clock, LayoutGrid } from "lucide-react";
import type { BranchEquipmentSummary, IdleEquipmentRow } from "@/lib/equipment-overview";

const TH = "px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap text-[13px]";
const SUMMARY =
  "flex cursor-pointer list-none items-center gap-1.5 text-sm font-extrabold text-ink [&::-webkit-details-marker]:hidden";

/**
 * פריט 16: סיכום ציוד לפי סניף (מתקפל). מחשבים = רגיל + גרפיקה; סטיק שמשויך למחשב מוצג בעמודה
 * משלו ולא מוסיף מחשב. לקריאה בלבד.
 */
export function EquipmentSummary({
  rows,
  branchName,
  showBranches,
}: {
  rows: BranchEquipmentSummary[];
  branchName: (id: string) => string;
  showBranches: boolean;
}) {
  if (rows.length === 0) return null;
  const total = rows.reduce(
    (t, r) => ({
      regular: t.regular + r.regular,
      graphics: t.graphics + r.graphics,
      computers: t.computers + r.computers,
      linkedSticks: t.linkedSticks + r.linkedSticks,
      standaloneSticks: t.standaloneSticks + r.standaloneSticks,
      inRepair: t.inRepair + r.inRepair,
    }),
    { regular: 0, graphics: 0, computers: 0, linkedSticks: 0, standaloneSticks: 0, inRepair: 0 },
  );
  const cells = (r: Omit<BranchEquipmentSummary, "branchId">) => (
    <>
      <td className={`${TD} font-bold text-ink`}>{r.computers}</td>
      <td className={TD}>{r.regular}</td>
      <td className={TD}>{r.graphics}</td>
      <td className={TD}>{r.linkedSticks}</td>
      <td className={TD}>{r.standaloneSticks}</td>
      <td className={`${TD} ${r.inRepair > 0 ? "font-bold text-amber-700" : "text-muted"}`}>{r.inRepair}</td>
    </>
  );
  return (
    <details className="group mb-3 rounded-card border border-card-border bg-white p-3 shadow-card">
      <summary className={SUMMARY}>
        <LayoutGrid className="h-4 w-4" />
        סיכום ציוד
        <span className="text-xs font-semibold text-muted">
          {`${total.computers} מחשבים (${total.regular} רגילים · ${total.graphics} גרפיקה) · ${
            total.linkedSticks + total.standaloneSticks
          } סטיקים`}
          {total.inRepair > 0 ? ` · ` : ""}
        </span>
        {total.inRepair > 0 && <span className="text-xs font-bold text-amber-700">{`${total.inRepair} בתיקון`}</span>}
        <ChevronDown className="mr-auto h-4 w-4 transition group-open:rotate-180" />
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-card-border bg-[#f4f6f9]">
              {showBranches && <th className={TH}>סניף</th>}
              <th className={TH}>מחשבים</th>
              <th className={TH}>רגילים</th>
              <th className={TH}>גרפיקה</th>
              <th className={TH} title="סטיק שמשויך למחשב יוצא איתו — לא נספר כמחשב נוסף">
                סטיקים משויכים
              </th>
              <th className={TH}>סטיקים עצמאיים</th>
              <th className={TH}>בתיקון</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((r, idx) => (
              <tr key={r.branchId} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                {showBranches && <td className={`${TD} font-bold text-ink`}>{branchName(r.branchId)}</td>}
                {cells(r)}
              </tr>
            ))}
            {showBranches && rows.length > 1 && (
              <tr className="border-t border-card-border bg-[#f4f6f9] font-bold">
                <td className={`${TD} text-ink`}>סה&quot;כ</td>
                {cells(total)}
              </tr>
            )}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-muted">
          ציוד פעיל בלבד (לא נמכר ולא הוצא). מחשב בתיקון נספר גם בעמודת הסוג שלו. תצוגה בלבד — לא משפיע על חישובי רווח.
        </p>
      </div>
    </details>
  );
}

const IDLE_STATUS: Record<IdleEquipmentRow["status"], { label: string; cls: string }> = {
  "rented-before": { label: "", cls: "" },
  never: { label: "לא הושכר מאז שנוסף", cls: "bg-[#f4f6f9] text-ink" },
  "no-history": { label: "אין השכרה ברשומות — ייתכן שההיסטוריה חלקית", cls: "bg-amber-50 text-amber-800" },
};

/**
 * פריט 46: ציוד שלא הושכר זמן רב (מתקפל, סגור כברירת מחדל). מקור: `n_rentals`. לקריאה בלבד —
 * לא מסמן תקלה, לא מעביר ולא משנה מחיר.
 */
export function IdleEquipmentList({
  rows,
  branchName,
  showBranches,
  repairLaptopIds,
}: {
  rows: IdleEquipmentRow[];
  branchName: (id: string) => string;
  showBranches: boolean;
  repairLaptopIds: ReadonlySet<string>;
}) {
  return (
    <details className="group mt-4 rounded-card border border-card-border bg-white p-3 shadow-card">
      <summary className={SUMMARY}>
        <Clock className="h-4 w-4" />
        ציוד שלא הושכר זמן רב
        <span className="text-xs font-semibold text-muted">{`(${rows.length} פריטים שאינם מושכרים כרגע)`}</span>
        <ChevronDown className="mr-auto h-4 w-4 transition group-open:rotate-180" />
      </summary>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">כל הציוד מושכר כרגע.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-card-border bg-[#f4f6f9]">
                <th className={TH}>פריט</th>
                {showBranches && <th className={TH}>סניף</th>}
                <th className={TH}>השכרה אחרונה</th>
                <th className={TH}>ימים בלי השכרה</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r, idx) => (
                <tr key={`${r.kind}-${r.id}`} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                  <td className={`${TD} font-bold text-ink`}>
                    {r.name}
                    {r.kind === "laptop" && repairLaptopIds.has(r.id) && (
                      <span className="mr-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">
                        בתיקון
                      </span>
                    )}
                  </td>
                  {showBranches && <td className={`${TD} text-muted`}>{branchName(r.branchId)}</td>}
                  <td className={TD}>
                    {r.status === "rented-before" ? (
                      <span>
                        {`הוחזר ${r.lastEnd}`}
                        <span className="mr-1 text-[11px] text-muted">{`(מ-${r.lastStart})`}</span>
                      </span>
                    ) : (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${IDLE_STATUS[r.status].cls}`}>
                        {IDLE_STATUS[r.status].label}
                      </span>
                    )}
                  </td>
                  <td className={TD}>
                    {r.idleDays != null ? (
                      <>
                        {r.idleDays}
                        {r.status !== "rented-before" && (
                          <span className="mr-1 text-[11px] text-muted">{`(מאז שנוסף ${r.addedDate})`}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-muted">לא ידוע</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted">
            ממוין מהזמן הרב ביותר בלי השכרה. סטיק שמשויך למחשב לא מופיע — הוא יוצא יחד עם המחשב. תצוגה בלבד.
          </p>
        </div>
      )}
    </details>
  );
}
