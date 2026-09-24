import { redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { loadBranchAccountingRawData } from "@/lib/branch-accounting-data";
import { laptopCostDate, laptopCostKind, laptopCostLines, rateAt, ratesOfKind } from "@/lib/laptop-costs";
import { isLaptopActive } from "@/lib/laptop-names";
import { CostRateCard } from "./cost-rate-card";
import { StampDatesButton } from "./stamp-dates-button";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const TH = "px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap text-[13px]";

/**
 * עלות להוספה — כמה עולה לי כל מחשב שנכנס לסניף השכרות (בעלים בלבד).
 *
 * כל מחשב שקיים או שנוסף נזקף אוטומטית כהשקעה שלי בסניף שלו, לפי המחיר שהיה בתוקף ביום
 * שנוסף. זה נכנס ל"ההוצאות שלי" ול"ששילמתי בפועל" בהנה"ח של ההשכרות — **לא** לספר הראשי
 * ולא להתחשבנות מול השותף. ראו `lib/laptop-costs.ts`.
 */
export default async function LaptopCostsPage() {
  const session = await requireModuleAccess("rentals");
  if (session.user?.role !== "owner") redirect("/dashboard/rentals");

  const raw = await loadBranchAccountingRawData();
  const rates = raw.laptopCostRates;
  const today = new Date().toISOString().slice(0, 10);
  const branches = raw.branches
    .filter((b) => b.branchType === "rentals" && !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));

  const allLaptops = branches.flatMap((b) => raw.laptopsByBranch.get(b.id) ?? []);
  const countOfKind = (kind: "standard" | "graphics") =>
    allLaptops.filter((l) => isLaptopActive(l) && laptopCostKind(l) === kind).length;

  const rows = branches.map((b) => {
    const laptops = raw.laptopsByBranch.get(b.id) ?? [];
    const lines = laptopCostLines(laptops, b, rates, raw.firstRentalByLaptop);
    return {
      branch: b,
      active: laptops.filter((l) => isLaptopActive(l)).length,
      total: laptops.length,
      graphics: laptops.filter((l) => isLaptopActive(l) && l.isGraphics).length,
      cost: lines.reduce((s, l) => s + l.amount, 0),
    };
  });
  const grand = rows.reduce((s, r) => s + r.cost, 0);

  const undated = allLaptops.filter(
    (l) => !laptopCostDate(l, branches.find((b) => b.id === l.branchId), raw.firstRentalByLaptop.get(l.id)),
  );

  const kinds = ["standard", "graphics"] as const;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Coins className="h-5 w-5" />
          עלות להוספה
        </h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          כמה עולה לי כל מחשב שנכנס לסניף. העלות נזקפת אוטומטית להשקעה שלי בסניף (הנה&quot;ח ההשכרות) —
          לא לספר הראשי ולא לחשבון מול השותף.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {kinds.map((kind) => {
          const versions = ratesOfKind(rates, kind).reverse();
          return (
            <CostRateCard
              key={kind}
              kind={kind}
              versions={versions}
              current={rateAt(rates, kind, today)}
              laptopCount={countOfKind(kind)}
            />
          );
        })}
      </div>

      {undated.length > 0 && (
        <div className="rounded-card border border-amber-300 bg-amber-50 p-4 text-[12.5px] leading-relaxed text-ink shadow-card">
          <b>{undated.length} מחשבים בלי שום תאריך</b> — אין להם תאריך הוספה, לסניף שלהם אין תאריך פתיחה,
          והם עוד לא הושכרו. לכן העלות שלהם עוד לא נזקפה (אין חודש לשים אותה בו):{" "}
          <span className="text-muted">{undated.map((l) => l.name).join(", ")}</span>
          <div className="mt-2">
            <StampDatesButton ids={undated.map((l) => l.id)} />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr className="border-b border-card-border bg-[#f4f6f9]">
                <th className={TH}>סניף</th>
                <th className={TH}>מחשבים פעילים</th>
                <th className={TH}>מתוכם גרפיקה</th>
                <th className={TH}>כולל שיצאו</th>
                <th className={TH}>עלות שנזקפה עד היום</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r, idx) => (
                <tr key={r.branch.id} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                  <td className={`${TD} font-bold text-ink`}>
                    {r.branch.name}
                    {r.branch.closedAt && <span className="mr-1.5 text-[10px] font-bold text-muted">(סגור)</span>}
                  </td>
                  <td className={TD}>{r.active}</td>
                  <td className={TD}>{r.graphics}</td>
                  <td className={`${TD} text-muted`}>{r.total}</td>
                  <td className={`${TD} font-bold text-red-600`}>{r.cost > 0 ? money(r.cost) : "-"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-card-border bg-[#f4f6f9]">
                <td className={`${TD} font-black text-ink`} colSpan={4}>
                  {'סה"כ'}
                </td>
                <td className={`${TD} font-black text-red-600`}>{money(grand)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="border-t border-card-border px-4 py-2.5 text-[11px] leading-relaxed text-muted">
          כל מחשב נזקף בחודש שנוסף לסניף, לפי המחיר של הסוג שלו (רגיל / גרפיקה) שהיה בתוקף ביום הזה. עדכון
          מחיר חל רק על מחשבים שנוספו מתאריך העדכון והלאה. מחשב שנמכר או הוצא נשאר בסכום — ההשקעה כבר נעשתה.
          מחשב ותיק בלי תאריך הוספה נזקף לחודש הפתיחה של הסניף (או להשכרה הראשונה שלו).
        </p>
      </div>
    </div>
  );
}
