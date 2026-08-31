import Link from "next/link";
import { Scale } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getOwnerName } from "@/lib/owner-name";
import { WAREHOUSE_LOCATION, paybackStatus } from "@/lib/assets";
import {
  FLOW_HELP,
  FLOW_LABEL,
  TURNOVER_HELP,
  TURNOVER_LABEL,
  buildBottomLine,
  buildFlow,
  buildTurnover,
  currentMonth,
  allActiveMonths,
  flowTotals,
  loadLayeredData,
  totalsByNode,
} from "@/lib/business-ledger";
import { monthsEndingAt } from "@/lib/accounting-overview";
import { AccountingTabs } from "../accounting-tabs";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] text-[12.5px]";

const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function BottomLinePage({
  searchParams,
}: {
  searchParams?: { month?: string; scope?: string };
}) {
  const session = await requireOwner();
  const month = searchParams?.month && MONTH_RE.test(searchParams.month) ? searchParams.month : currentMonth();
  // "מתחילת הדרך" is the honest default question for a business whose spending predates any
  // 12-month window; the monthly view answers "how did this month go".
  const allTime = searchParams?.scope !== "month";

  const [{ model, assets }, ownerName] = await Promise.all([
    loadLayeredData(),
    getOwnerName(session.user?.name),
  ]);

  const months = monthsEndingAt(month, 12);
  // "מתחילת הדרך" counts every month the books have life in, so a recurring charge is counted
  // once per month it was active rather than once in total.
  const scopeMonths = allTime ? allActiveMonths(model.transactions, month) : new Set([month]);

  const liveBranches = model.branches
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const nodeTotals = totalsByNode(model.transactions, scopeMonths);

  // How much of the capital has come back: the OWNER's cumulative share of the operating profit,
  // across every branch. His share and not the full profit, because the equipment is his capital
  // alone (כלל 7) - the partner's half of a branch's profit does not repay it. Three independent
  // numbers compared, never subtracted from one another (פרק ז׳).
  const capitalReturned = liveBranches.reduce(
    (sum, b) => sum + Math.max(0, nodeTotals.get(b.id)?.ownerProfit ?? 0),
    0,
  );

  const bottom = buildBottomLine(model.transactions, scopeMonths, assets, capitalReturned);
  const flow = flowTotals(model.transactions);
  const flowMonths = buildFlow(model.transactions, months);
  const turnoverMonths = buildTurnover(model.transactions, months);

  const waterfall = [
    { label: `${TURNOVER_LABEL} כל היחידות`, value: bottom.turnover, tone: "in" as const },
    { label: "פחות הוצאות תפעול", value: -bottom.operatingExpense, tone: "out" as const },
    { label: "רווח תפעולי", value: bottom.operatingProfit, tone: "sub" as const },
    { label: "פחות חלק השותפים", value: -bottom.partnersShare, tone: "out" as const },
    { label: `הרווח של ${ownerName} מהתפעול`, value: bottom.ownerOperatingProfit, tone: "sub" as const },
    ...(bottom.hqIncome > 0
      ? [{ label: "ועוד הכנסות מטה (אשראי מהעסק)", value: bottom.hqIncome, tone: "in" as const }]
      : []),
    { label: "פחות הוצאות מטה", value: -bottom.hqExpense, tone: "out" as const },
    { label: `הרווח הנקי של ${ownerName}`, value: bottom.ownerNetProfit, tone: "final" as const },
  ];

  // The branch cards of פרק ז׳: investment, profit, and how much has already come back.
  const branchCards = liveBranches
    .map((b) => {
      const inv = assets.investmentByLocation.get(b.id);
      const t = nodeTotals.get(b.id);
      const returned = Math.max(0, t?.ownerProfit ?? 0);
      const monthsRun = Math.max(1, scopeMonths.size);
      return {
        branch: b,
        invested: inv?.total ?? 0,
        laptops: inv?.countByKind.laptop ?? 0,
        sticks: inv?.countByKind.stick ?? 0,
        net: t?.profit ?? 0,
        payback: paybackStatus(inv?.total ?? 0, returned, returned / monthsRun),
      };
    })
    .filter((c) => c.invested > 0 || c.net !== 0)
    .sort((a, b) => b.payback.ratio - a.payback.ratio);

  const scopeHref = (s: string) => `/dashboard/accounting/bottom-line?month=${month}&scope=${s}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Scale className="h-5 w-5" />
            השורה התחתונה
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            שורת מאזן אחת לכל אולטרנט — והמזכר ההוני מתחתיה
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/bottom-line" />
      </div>

      <div className="mb-3.5 flex gap-1 rounded-xl border border-card-border bg-white p-1">
        {[
          { key: "all", label: "מתחילת הדרך" },
          { key: "month", label: `החודש (${month.slice(5)}/${month.slice(0, 4)})` },
        ].map((s) => (
          <Link
            key={s.key}
            href={scopeHref(s.key)}
            className={
              (s.key === "all") === allTime
                ? "rounded-lg bg-teal-bg px-3 py-1.5 text-[13px] font-bold text-teal-dark"
                : "rounded-lg px-3 py-1.5 text-[13px] font-bold text-muted transition hover:bg-gray-100"
            }
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* --- the waterfall ------------------------------------------------- */}
      <section className={`${CARD} mb-3.5 overflow-hidden`}>
        <div className="border-b border-card-border px-4 py-3">
          <h2 className="text-[15px] font-extrabold text-ink">שורת המאזן של אולטרנט</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            הוצאות והכנסות מטה נפרדות מאלה של הסניפים לפי הצומת שעליה הן תלויות — לא לפי ניחוש
            קטגוריה. <b className="text-ink">שים לב:</b> שורת &quot;אשראי מהעסק&quot; נספרת כאן
            כהכנסה נפרדת ולא כחלק מהמחזור. אם בפועל היא הכסף שמגיע עבור הכנסות שכבר רשומות בספר של
            סניף — הסיווג הנכון שלה הוא <b className="text-ink">העברה</b>, וכך היא תפסיק להיספר
            כהכנסה בכלל (כלל 8).
          </p>
        </div>
        <table className="w-full border-collapse">
          <tbody>
            {waterfall.map((r) => (
              <tr
                key={r.label}
                className={
                  r.tone === "final" ? "bg-[#eefaf4]" : r.tone === "sub" ? "bg-[#fafbfc]" : ""
                }
              >
                <td
                  className={`${TD} ${
                    r.tone === "final" ? "font-black text-ink" : r.tone === "sub" ? "font-extrabold text-ink" : ""
                  }`}
                >
                  {r.label}
                </td>
                <td
                  className={`${TD} text-left tabular-nums ${
                    r.tone === "final"
                      ? "text-[19px] font-black text-[#0f6e56]"
                      : r.tone === "sub"
                        ? "font-extrabold text-ink"
                        : r.tone === "out"
                          ? "font-bold text-red-600"
                          : "font-bold text-emerald-600"
                  }`}
                >
                  {money(r.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* --- the capital memo, below the bottom line ---------------------- */}
        <div className="border-t-2 border-dashed border-card-border bg-[#f9f7fd] px-4 py-3">
          <p className="text-[12px] font-extrabold text-[#6b46c1]">מזכר הוני — מתחת לשורה התחתונה</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "השקעה מצטברת בציוד", value: bottom.capitalInvested },
              { label: "מתוכה כבר הוחזרה", value: bottom.capitalReturned },
              { label: "נותרו להחזר", value: bottom.capitalRemaining },
              { label: "המחסן מחזיק", value: bottom.warehouseHolding },
            ].map((c) => (
              <div key={c.label}>
                <p className="text-[11px] font-extrabold text-muted">{c.label}</p>
                <p className="mt-px text-[17px] font-black tabular-nums text-[#6b46c1]">{money(c.value)}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
            ההשקעה ההונית מופיעה במלואה — כל שקל, עם חשבונית. היא פשוט מופיעה מתחת לשורה התחתונה ולא
            בתוכה, כי היא לא הוצאה אלא הון. שני הרצונות — שכל הוצאה תהיה מתועדת, ושלא תהיה כפולה —
            מתקיימים במלואם בלי לוותר על אף אחד מהם.
          </p>
        </div>
      </section>

      {/* --- the two books, side by side and never summed ------------------- */}
      <section className={`${CARD} mb-3.5 overflow-hidden`}>
        <div className="border-b border-card-border px-4 py-3">
          <h2 className="text-[15px] font-extrabold text-ink">שני הספרים — {FLOW_LABEL} מול {TURNOVER_LABEL}</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            <b className="text-ink">{FLOW_LABEL}</b> — {FLOW_HELP}. <b className="text-ink">{TURNOVER_LABEL}</b> —{" "}
            {TURNOVER_HELP}. אותו שקל, שתי שאלות. חיבור שלהם לא עונה על אף אחת מהן, ולכן אין בשום
            מסך &quot;סה&quot;כ&quot; שמחבר ביניהם.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>חודש</th>
                <th className={TH}>{FLOW_LABEL} — נכנס</th>
                <th className={TH}>{FLOW_LABEL} — יצא</th>
                <th className={TH}>{FLOW_LABEL} — יתרה</th>
                <th className={TH}>ציוד (הוני)</th>
                <th className={TH}>{TURNOVER_LABEL} — הכנסות</th>
                <th className={TH}>{TURNOVER_LABEL} — הוצאות</th>
                <th className={TH}>{TURNOVER_LABEL} — רווח</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const f = flowMonths.get(m)!;
                const t = turnoverMonths.get(m)!;
                return (
                  <tr key={m} className={m === month ? "bg-teal-bg/30" : ""}>
                    <td className={`${TD} whitespace-nowrap tabular-nums font-bold text-ink`}>
                      {m.slice(5)}/{m.slice(0, 4)}
                    </td>
                    <td className={`${TD} tabular-nums text-emerald-600`}>{money(f.income)}</td>
                    <td className={`${TD} tabular-nums text-red-600`}>{money(f.expense)}</td>
                    <td className={`${TD} tabular-nums font-bold text-ink`}>{money(f.profit)}</td>
                    <td className={`${TD} tabular-nums text-[#6b46c1]`}>{f.capital ? money(f.capital) : "—"}</td>
                    <td className={`${TD} tabular-nums text-emerald-600`}>{money(t.income)}</td>
                    <td className={`${TD} tabular-nums text-red-600`}>{money(t.expense)}</td>
                    <td className={`${TD} tabular-nums font-bold text-ink`}>{money(t.profit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-card-border px-4 py-2.5 text-[12px] text-muted">
          {FLOW_LABEL} מתחילת הדרך: נכנס {money(flow.income)} · יצא {money(flow.expense)} · יתרה{" "}
          <b className="text-ink">{money(flow.balance)}</b> · ציוד {money(flow.capital)} · העברות שהתקבלו{" "}
          {money(flow.transfersIn)} (סילוק חוב, לא הכנסה).
        </p>
      </section>

      {/* --- the branch cards, sorted by payback --------------------------- */}
      <section className={`${CARD} overflow-hidden`}>
        <div className="border-b border-card-border px-4 py-3">
          <h2 className="text-[15px] font-extrabold text-ink">כל הסניפים — ממוין לפי החזר השקעה</h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
            שלושה מספרים בלתי-תלויים: כמה הושקע (שכבה 2), כמה הסניף מרוויח (שכבה 3), וכמה מההשקעה
            כבר חזרה. אף אחד מהם לא מנוכה מהשני — ולכן סניף שמרוויח הכי הרבה יכול בכל זאת להיות הכי
            רחוק מלהחזיר את עצמו. <b className="text-ink">המדד לפעולה הוא צפי האיזון בחודשים</b>, לא
            האחוז: האחוז הוא יחס בין שני מספרים שזזים, והזנת ציוד נוסף מורידה אותו בלי שקרה שום דבר רע.
          </p>
        </div>
        {branchCards.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">
            אין עדיין נתונים.{" "}
            <Link href="/dashboard/accounting/purchases" className="font-bold text-teal underline">
              הזנת רכישה
            </Link>{" "}
            תיתן השקעה אמיתית פר סניף, ומשם אחוז ההחזר נגזר לבד.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>סניף</th>
                  <th className={TH}>מחשבים</th>
                  <th className={TH}>סטיקים</th>
                  <th className={TH}>השקעה</th>
                  <th className={TH}>נטו תפעולי</th>
                  <th className={TH}>חלקי מצטבר</th>
                  <th className={TH}>החזר השקעה</th>
                  <th className={TH}>יתרה להחזר</th>
                  <th className={TH}>צפי איזון</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {branchCards.map((c) => (
                  <tr key={c.branch.id} className="transition hover:bg-[#fafbfc]">
                    <td className={`${TD} font-bold`}>
                      <Link href={`/dashboard/accounting/overview/${c.branch.id}`} className="text-teal hover:underline">
                        {c.branch.name}
                      </Link>
                    </td>
                    <td className={`${TD} tabular-nums`}>{c.laptops || "—"}</td>
                    <td className={`${TD} tabular-nums`}>{c.sticks || "—"}</td>
                    <td className={`${TD} tabular-nums`}>{c.invested ? money(c.invested) : "—"}</td>
                    <td className={`${TD} tabular-nums font-bold ${c.net >= 0 ? "text-ink" : "text-red-600"}`}>
                      {money(c.net)}
                    </td>
                    <td className={`${TD} tabular-nums text-muted`}>{money(c.payback.returned)}</td>
                    <td className={TD}>
                      {c.invested > 0 ? (
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#eef1f6]">
                            <span
                              className="block h-full rounded-full"
                              style={{
                                width: `${Math.min(100, Math.round(c.payback.ratio * 100))}%`,
                                background: c.payback.ratio >= 1 ? "#0f6e56" : "#1a8a76",
                              }}
                            />
                          </span>
                          <b className="tabular-nums text-ink">{pct(c.payback.ratio)}</b>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className={`${TD} tabular-nums`}>
                      {c.payback.remaining > 0 ? money(c.payback.remaining) : "—"}
                    </td>
                    <td className={`${TD} font-bold text-ink`}>
                      {c.payback.remaining === 0
                        ? "הוחזר"
                        : c.payback.monthsToBreakEven == null
                          ? "לא בקצב הנוכחי"
                          : `עוד כ-${c.payback.monthsToBreakEven} חודשים`}
                    </td>
                    <td className={`${TD} text-[11px] text-muted`}>
                      {c.payback.unsettled ? "טרם התייצב — נוסף הון החודש" : ""}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#f4f6f9]">
                  <td className={`${TD} font-black text-ink`}>סה&quot;כ</td>
                  <td className={TD} colSpan={2} />
                  <td className={`${TD} font-black tabular-nums text-ink`}>
                    {money(branchCards.reduce((s, c) => s + c.invested, 0))}
                  </td>
                  <td className={`${TD} font-black tabular-nums text-ink`}>
                    {money(branchCards.reduce((s, c) => s + c.net, 0))}
                  </td>
                  <td className={TD} colSpan={5} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-card-border px-4 py-2.5 text-[12px] text-muted">
          נוסף על הסניפים, המחסן מחזיק ציוד בשווי{" "}
          <b className="text-ink">{money(assets.investmentByLocation.get(WAREHOUSE_LOCATION)?.total ?? 0)}</b> שעדיין
          לא הוקצה לאף סניף — וזה מיקום לגיטימי, ולכן המאזן סוגר.
        </p>
      </section>
    </div>
  );
}
