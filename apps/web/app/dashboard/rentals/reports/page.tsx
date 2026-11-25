import { LineChart, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { loadRentalReport, todayIsrael, type PeriodTotals, type ReportPreset, type Trend } from "@/lib/rental-reports";
import { ReportFilters } from "./report-filters";
import { TrendChart } from "./trend-chart";

export const dynamic = "force-dynamic";

const PRESETS: ReportPreset[] = ["today", "3d", "week", "month", "range", "all"];
const GREEN = "#16a34a";
const RED = "#dc2626";
const TEAL = "#0f766e";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number | null) => (n === null ? "—" : `${nf.format(Math.round(n))} ₪`);
const percent = (n: number | null) => (n === null ? "—" : `${(n * 100).toFixed(1)}%`);
const num1 = (n: number | null) => (n === null ? "—" : n.toFixed(1));

function dmy(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/** תג מגמה — עולה/יורד/יציב, ומול מה הושווה. */
function TrendBadge({ trend, unit }: { trend: Trend | null; unit: "pp" | "pct" }) {
  if (!trend) return <span className="text-xs text-muted">אין עם מה להשוות</span>;
  const Icon = trend.direction === "up" ? TrendingUp : trend.direction === "down" ? TrendingDown : Minus;
  const color = trend.direction === "up" ? GREEN : trend.direction === "down" ? RED : "#64748b";
  const word = trend.direction === "up" ? "בעלייה" : trend.direction === "down" ? "בירידה" : "יציב";
  const sign = trend.delta > 0 ? "+" : "";
  const amount = unit === "pp" ? `${sign}${trend.delta.toFixed(1)} נק׳` : `${sign}${Math.round(trend.delta)}%`;
  return (
    <div className="flex flex-col items-end gap-0.5" style={{ color }}>
      <span className="flex items-center gap-1 text-sm font-extrabold">
        <Icon className="h-4 w-4" />
        {word}
        {trend.direction !== "flat" && <span className="font-bold">({amount})</span>}
      </span>
      <span className="text-[11px] font-normal text-muted">
        {trend.basis === "previous" ? "לעומת התקופה הקודמת" : "חצי שני לעומת חצי ראשון"}
      </span>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-[#f7f9fb] px-3 py-2">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="text-[19px] font-extrabold text-ink">{value}</div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  await requireOwner();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? (sp[k] as string[])[0] : (sp[k] as string | undefined));
  const preset: ReportPreset = PRESETS.includes(one("p") as ReportPreset) ? (one("p") as ReportPreset) : "month";
  const month = one("m") ?? todayIsrael().slice(0, 7);

  // הסינון מהכתובת נחתך בתוך `loadRentalReport` לסניפי השכרות בלבד — כתובת ערוכה לא מרחיבה.
  const report = await loadRentalReport({
    preset,
    month,
    from: one("from"),
    to: one("to"),
    branchIds: (one("b") ?? "").split(",").filter(Boolean),
  });

  const t = report.totals;
  const tiny = report.series.length < 2;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-1.5 text-[19px] font-extrabold text-ink">
          <LineChart className="h-5 w-5 text-teal" />
          דוחות השכרות
        </h2>
        <p className="mt-0.5 text-[12.5px] text-muted">
          סניפי השכרת ניידים בלבד. {dmy(report.from)}
          {report.from !== report.to && ` – ${dmy(report.to)}`} ·{" "}
          {report.selectedIds.length === 0 ? "כל הסניפים" : `${report.selectedIds.length} סניפים`}
        </p>
      </div>

      <ReportFilters
        branches={report.branches}
        selected={report.selectedIds}
        preset={preset}
        month={month}
        from={report.from}
        to={report.to}
      />

      {/* ── תפוסה ── */}
      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-extrabold text-ink">אחוזי תפוסה</h3>
            <p className="text-[12px] text-muted">ימי השכרה מתוך ימי זמינות של כל המחשבים (בלי שבתות ובלי ימי תיקון)</p>
          </div>
          <TrendBadge trend={report.trends.occupancy} unit="pp" />
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="grid grid-cols-2 gap-2 self-start">
            <Stat label="תפוסה" value={percent(t.occupancy)} />
            <Stat label="ימי השכרה" value={nf.format(t.rentedDays)} hint={`מתוך ${nf.format(t.availableDays)} ימי זמינות`} />
          </div>
          {tiny ? (
            <p className="self-center text-center text-xs text-muted">גרף מגמה מופיע מטווח של יומיים ומעלה</p>
          ) : (
            <TrendChart
              points={report.series}
              pick={(p) => (p.occupancy === null ? null : p.occupancy * 100)}
              format={(n) => `${n.toFixed(0)}%`}
              color={TEAL}
            />
          )}
        </div>
      </section>

      {/* ── רווחיות ── */}
      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-extrabold text-ink">רווחיות</h3>
            <p className="text-[12px] text-muted">
              הכנסות פחות הוצאות הסניפים, בלי רכש (מחשבים וציוד).
              {report.profitIsEstimate && " הטווח אינו חודשים שלמים — הרווח משוער לפי חלוקה לימים."}
            </p>
          </div>
          <TrendBadge trend={report.trends.netProfit} unit="pct" />
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="grid grid-cols-2 gap-2 self-start">
            <Stat label="רווח נטו" value={money(t.netProfit)} />
            <Stat label="הרווח שלי" value={money(t.myProfit)} hint="אחרי אחוזי שותף" />
            <Stat label="נטו למחשב" value={money(t.netPerComputer)} />
            <Stat label="שלי למחשב" value={money(t.myPerComputer)} />
          </div>
          {tiny ? (
            <p className="self-center text-center text-xs text-muted">גרף מגמה מופיע מטווח של יומיים ומעלה</p>
          ) : (
            <TrendChart points={report.series} pick={(p) => p.netProfit} format={(n) => money(n)} color={GREEN} />
          )}
        </div>
      </section>

      {/* ── מחזור ── */}
      <section className="card flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[16px] font-extrabold text-ink">מחזור (הכנסות ברוטו)</h3>
            <p className="text-[12px] text-muted">מה שנגבה בפועל מהשכרות — לפני הוצאות</p>
          </div>
          <TrendBadge trend={report.trends.revenue} unit="pct" />
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="grid grid-cols-2 gap-2 self-start">
            <Stat label="מחזור" value={money(t.revenue)} />
            <Stat label="מחזור למחשב" value={money(t.revenuePerComputer)} />
          </div>
          {tiny ? (
            <p className="self-center text-center text-xs text-muted">גרף מגמה מופיע מטווח של יומיים ומעלה</p>
          ) : (
            <TrendChart points={report.series} pick={(p) => p.revenue} format={(n) => money(n)} color="#2563eb" />
          )}
        </div>
      </section>

      {/* ── שוכרים ומשך ── */}
      <section className="card flex flex-col gap-3">
        <div>
          <h3 className="text-[16px] font-extrabold text-ink">שוכרים ומשך השכרה</h3>
          <p className="text-[12px] text-muted">השכרות מחשב שהתחילו בתקופה (השכרה שעוד פעילה נספרת עד היום)</p>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="grid grid-cols-2 gap-2 self-start">
            <Stat label="אנשים ששכרו" value={nf.format(t.renters)} />
            <Stat label="השכרות" value={nf.format(t.rentals)} />
            <Stat label="ממוצע ימים להשכרה" value={num1(t.avgDays)} />
          </div>
          <DurationBars totals={t} />
        </div>
      </section>

      {/* ── לפי סניף ── */}
      <section className="card overflow-x-auto">
        <h3 className="mb-2 text-[16px] font-extrabold text-ink">פירוט לפי סניף</h3>
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-card-border text-right text-xs text-muted">
              <th className="py-1.5 font-bold">סניף</th>
              <th className="font-bold">תפוסה</th>
              <th className="font-bold">מחזור</th>
              <th className="font-bold">רווח נטו</th>
              <th className="font-bold">שלי</th>
              <th className="font-bold">נטו למחשב</th>
              <th className="font-bold">שוכרים</th>
              <th className="font-bold">ממוצע ימים</th>
            </tr>
          </thead>
          <tbody>
            {report.perBranch.map((b) => {
              return (
                <tr key={b.id} className="border-b border-card-border/60 last:border-0">
                  <td className="py-1.5 font-bold text-ink">{b.name}</td>
                  <td>{percent(b.occupancy)}</td>
                  <td>{money(b.revenue)}</td>
                  <td>{money(b.netProfit)}</td>
                  <td>{money(b.myProfit)}</td>
                  <td className="font-bold">{money(b.netPerComputer)}</td>
                  <td>{nf.format(b.renters)}</td>
                  <td>{num1(b.avgDays)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function DurationBars({ totals }: { totals: PeriodTotals }) {
  const max = Math.max(1, ...totals.durations.map((d) => d.count));
  return (
    <div className="flex flex-col gap-1.5 self-center">
      {totals.durations.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-[12.5px]">
          <span className="w-24 shrink-0 text-muted">{d.label}</span>
          <div className="h-3 flex-1 rounded bg-[#eef2f6]">
            <div className="h-3 rounded bg-teal" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="w-8 text-left font-bold text-ink">{d.count}</span>
        </div>
      ))}
    </div>
  );
}
