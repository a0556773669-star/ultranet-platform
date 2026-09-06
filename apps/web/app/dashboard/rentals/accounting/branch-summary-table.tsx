const TH = "px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-2.5 py-2 whitespace-nowrap";

export interface BranchSummaryRow {
  branchId: string;
  branchName: string;
  closed: boolean;
  /** החלק שלי בעלות ההוצאות של הסניף עד היום */
  myExpensesToDate: number;
  /** מה שיצא לי מהכיס בפועל עד היום (גם על שורות שהחוב עליהן לא כולו שלי) */
  cashPaidToDate: number;
  /** החלק שלי בהכנסות הסניף עד היום */
  myIncomeToDate: number;
  profitToDate: number;
  /** ההתחשבנות של החודש הנבחר: חיובי = נכנס אליי, שלילי = יוצא ממני */
  incomingThisMonth: number;
}

function money(n: number) {
  return `${Math.round(Math.abs(n)).toLocaleString("he-IL")} ₪`;
}

function Signed({ value }: { value: number }) {
  if (Math.abs(value) < 1) return <span className="text-muted">-</span>;
  return (
    <span className={`font-bold ${value > 0 ? "text-emerald-700" : "text-red-600"}`}>
      {value > 0 ? "+" : "−"}
      {money(value)}
    </span>
  );
}

/**
 * שורה אחת לסניף, חמש עמודות. אין כאן טפסים בכוונה: המסך הזה נשאל, לא נכתב.
 */
export function BranchSummaryTable({ rows, month }: { rows: BranchSummaryRow[]; month: string }) {
  const totals = rows.reduce(
    (acc, r) => ({
      myExpensesToDate: acc.myExpensesToDate + r.myExpensesToDate,
      cashPaidToDate: acc.cashPaidToDate + r.cashPaidToDate,
      myIncomeToDate: acc.myIncomeToDate + r.myIncomeToDate,
      profitToDate: acc.profitToDate + r.profitToDate,
      incomingThisMonth: acc.incomingThisMonth + r.incomingThisMonth,
    }),
    { myExpensesToDate: 0, cashPaidToDate: 0, myIncomeToDate: 0, profitToDate: 0, incomingThisMonth: 0 },
  );

  return (
    <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-right text-[13px]">
          <thead>
            <tr className="border-b border-card-border bg-[#f4f6f9]">
              <th className={TH}>סניף</th>
              <th className={TH}>ההוצאות שלי עד היום</th>
              <th className={TH}>ששילמתי בפועל עד היום</th>
              <th className={TH}>ההכנסות שלי עד היום</th>
              <th className={TH}>רווח עד היום</th>
              <th className={TH}>נכנס החודש ({month})</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2.5 py-6 text-center text-sm text-muted">
                  אין סניפים להצגה
                </td>
              </tr>
            )}
            {rows.map((r, idx) => (
              <tr
                key={r.branchId}
                className={`${idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"} ${r.closed ? "opacity-60" : ""}`}
              >
                <td className={`${TD} font-bold text-ink`}>
                  {r.branchName}
                  {r.closed && <span className="mr-1.5 text-[10px] font-bold text-muted">(נסגר)</span>}
                </td>
                <td className={`${TD} font-semibold text-red-600`}>
                  {r.myExpensesToDate > 0 ? money(r.myExpensesToDate) : "-"}
                </td>
                <td className={`${TD} text-ink`}>{r.cashPaidToDate > 0 ? money(r.cashPaidToDate) : "-"}</td>
                <td className={`${TD} font-semibold text-emerald-700`}>
                  {r.myIncomeToDate > 0 ? money(r.myIncomeToDate) : "-"}
                </td>
                <td className={TD}>
                  <Signed value={r.profitToDate} />
                </td>
                <td className={TD}>
                  <Signed value={r.incomingThisMonth} />
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-card-border bg-[#f4f6f9] tabular-nums">
                <td className={`${TD} font-black text-ink`}>{'סה"כ'}</td>
                <td className={`${TD} font-black text-red-600`}>{money(totals.myExpensesToDate)}</td>
                <td className={`${TD} font-black text-ink`}>{money(totals.cashPaidToDate)}</td>
                <td className={`${TD} font-black text-emerald-700`}>{money(totals.myIncomeToDate)}</td>
                <td className={TD}>
                  <Signed value={totals.profitToDate} />
                </td>
                <td className={TD}>
                  <Signed value={totals.incomingThisMonth} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="border-t border-card-border px-4 py-2.5 text-[11px] leading-relaxed text-muted">
        <b>ההוצאות שלי</b> = החלק שלי בעלות, לפי &quot;על מי החוב&quot; של כל שורה. <b>ששילמתי בפועל</b> = כל
        שורה שאני שילמתי, במלוא הסכום — כולל מה ששילמתי עבור הסניף ואמור לחזור אליי.{" "}
        <b>נכנס החודש</b>: ירוק = מגיע אליי, אדום = אני מעביר.
      </p>
    </div>
  );
}
