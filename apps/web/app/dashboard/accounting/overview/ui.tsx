/**
 * Presentational pieces shared by the accounting overview and its per-branch drill-down.
 * All server components - month/mode selection is plain links, so the screen needs no client JS.
 */
import Link from "next/link";
import type { Branch } from "@ultranet/shared-types";
import type { BranchMonth, CostLine, OverviewMonthRow } from "@/lib/accounting-overview";
import { branchHasPartner, branchOwnerPct, branchPartnerLabel } from "@/lib/accounting-overview";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
export const money = (n: number) => `${nf.format(Math.round(n))} ₪`;
export const qty = (n: number) => nf.format(Math.round(n));
export const mLabel = (m: string) => `${m.slice(5)}/${m.slice(2, 4)}`;
export const nextMonthNum = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  if (!y || !mo) return "01";
  return String(mo === 12 ? 1 : mo + 1).padStart(2, "0");
};

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const HEAD = "flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted whitespace-nowrap border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] whitespace-nowrap";
const NUM = "text-left tabular-nums";
/** the owner's own column, tinted so it reads as one group down the table */
const MINE = "bg-[rgba(26,138,118,0.07)] font-extrabold";
const LAP = "bg-[rgba(37,99,235,0.05)] text-[#2563eb] font-bold";
const ROOM = "bg-[rgba(107,63,160,0.05)] text-[#6b3fa0] font-bold";
const SEP = "border-r border-card-border";

export function signClass(n: number) {
  return n >= 0 ? "text-emerald-600 font-extrabold" : "text-red-600 font-extrabold";
}

/* ------------------------------------------------------------------ */

export function MonthPills({
  months,
  current,
  hrefFor,
}: {
  months: string[];
  current: string;
  hrefFor: (month: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="ml-1 text-xs font-bold text-muted">חודש</span>
      {[...months].reverse().map((m) => (
        <Link
          key={m}
          href={hrefFor(m)}
          className={
            m === current
              ? "rounded-lg bg-teal-bg px-2.5 py-1 text-[12.5px] font-extrabold text-teal-dark"
              : "rounded-lg px-2.5 py-1 text-[12.5px] font-bold text-muted transition hover:bg-gray-100"
          }
        >
          {mLabel(m)}
        </Link>
      ))}
    </div>
  );
}

export interface KpiCard {
  label: string;
  value: number;
  prev?: number;
  color: string;
  rail: string;
  footLabel: string;
  foot: number;
}

function Delta({ value, prev }: { value: number; prev?: number }) {
  if (prev == null || prev === 0) {
    return <span className="rounded-full bg-[#f4f6f9] px-1.5 py-px text-[11px] font-extrabold text-muted">—</span>;
  }
  const pct = Math.round(((value - prev) / Math.abs(prev)) * 100);
  if (pct === 0) {
    return <span className="rounded-full bg-[#f4f6f9] px-1.5 py-px text-[11px] font-extrabold text-muted">0%</span>;
  }
  const up = pct > 0;
  return (
    <span
      className={`rounded-full px-1.5 py-px text-[11px] font-extrabold ${
        up ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
      }`}
    >
      {up ? "↑" : "↓"} {Math.abs(pct)}%
    </span>
  );
}

/** The compact one-line summary strip at the top of every accounting screen. */
export function KpiRow({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      {cards.map((k) => (
        <article key={k.label} className={`${CARD} relative overflow-hidden py-2.5 pl-3.5 pr-3`}>
          <span className="absolute right-0 top-0 h-full w-[3px]" style={{ background: k.rail }} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-muted">{k.label}</span>
            <Delta value={k.value} prev={k.prev} />
          </div>
          <div className="mt-px flex items-baseline justify-between gap-2.5">
            <p className="text-[21px] font-black leading-tight tabular-nums" style={{ color: k.color }}>
              {money(k.value)}
            </p>
            <span className="flex items-baseline gap-1 whitespace-nowrap">
              <span className="text-[10.5px] font-bold text-muted">{k.footLabel}</span>
              <b className="text-xs font-extrabold tabular-nums text-muted">{money(k.foot)}</b>
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

/* ------------------------------- charts ------------------------------- */

const shortNum = (n: number) =>
  Math.abs(n) >= 1000 ? `${nf.format(Math.round(n / 100) / 10)}K` : nf.format(Math.round(n));

function BarsSvg({
  series,
  lapProfit,
}: {
  series: { month: string; income: number; expense: number }[];
  lapProfit?: number[];
}) {
  const W = 400;
  const H = 200;
  const padT = 16;
  const padB = 22;
  const padR = 34;
  const padL = 10;
  const plotH = H - padT - padB;
  const max = Math.max(...series.map((s) => Math.max(s.income, s.expense)), 1);
  const bw = (W - padR - padL) / Math.max(1, series.length);
  const y = (v: number) => padT + plotH - (v / max) * plotH;

  const gridLines = [0, 1, 2, 3].map((g) => {
    const gy = padT + (plotH / 3) * g;
    return { gy, label: shortNum(max * (1 - g / 3)) };
  });

  let lapPath = "";
  let lapArea = "";
  let lapPts: [number, number][] = [];
  if (lapProfit) {
    lapPts = series.map((_, i) => [padL + i * bw + bw / 2, y(Math.max(0, lapProfit[i] ?? 0))]);
    lapPath = lapPts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
    const first = lapPts[0];
    const last = lapPts[lapPts.length - 1];
    if (first && last) {
      lapArea = `${lapPath}L${last[0].toFixed(1)},${(padT + plotH).toFixed(1)}L${first[0].toFixed(1)},${(padT + plotH).toFixed(1)}Z`;
    }
  }
  const lapLast = lapPts[lapPts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="הכנסות מול הוצאות לפי חודש">
      {gridLines.map((g) => (
        <g key={g.gy}>
          <line x1={padL} y1={g.gy} x2={W - padR} y2={g.gy} stroke="#eef1f6" />
          <text x={W - padR + 4} y={g.gy + 3} fontSize="8.5" fill="#9aa6b5">
            {g.label}
          </text>
        </g>
      ))}
      {series.map((s, i) => {
        const x = padL + i * bw;
        const w = Math.max(3, bw / 2 - 2.5);
        return (
          <g key={s.month}>
            <rect x={x + bw / 2 - w - 1} y={y(s.income)} width={w} height={padT + plotH - y(s.income)} rx="2" fill="#059669" />
            <rect x={x + bw / 2 + 1} y={y(s.expense)} width={w} height={padT + plotH - y(s.expense)} rx="2" fill="#dc2626" opacity="0.85" />
            {(i % 2 === 0 || i === series.length - 1) && (
              <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize="8.5" fill="#5a6a7e">
                {mLabel(s.month)}
              </text>
            )}
          </g>
        );
      })}
      {lapArea && <path d={lapArea} fill="#2563eb" opacity="0.1" />}
      {lapPath && <path d={lapPath} fill="none" stroke="#2563eb" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />}
      {lapLast && <circle cx={lapLast[0]} cy={lapLast[1]} r="4.5" fill="#fff" stroke="#2563eb" strokeWidth="2.4" />}
    </svg>
  );
}

function CumSvg({ values, months }: { values: number[]; months: string[] }) {
  const W = 400;
  const H = 118;
  const padT = 20;
  const padB = 20;
  const padR = 34;
  const padL = 10;
  const plotH = H - padT - padB;
  let run = 0;
  const cum = values.map((v) => (run += v));
  const lo = Math.min(0, ...cum);
  const hi = Math.max(0, ...cum);
  const range = hi - lo || 1;
  const y = (v: number) => padT + plotH - ((v - lo) / range) * plotH;
  const step = (W - padR - padL) / Math.max(1, cum.length - 1);
  const x = (i: number) => padL + i * step;
  const path = cum.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${path}L${x(cum.length - 1).toFixed(1)},${y(lo).toFixed(1)}L${x(0).toFixed(1)},${y(lo).toFixed(1)}Z`;
  const last = cum[cum.length - 1] ?? 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="יתרה מצטברת">
      <defs>
        <linearGradient id="cumfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a8a76" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#1a8a76" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1={padL} y1={y(0)} x2={W - padR} y2={y(0)} stroke="#dde3ec" strokeDasharray="3 3" />
      <path d={area} fill="url(#cumfill)" />
      <path d={path} fill="none" stroke="#1a8a76" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(cum.length - 1)} cy={y(last)} r="5" fill="#fff" stroke="#1a8a76" strokeWidth="3" />
      <text x={x(cum.length - 1) - 6} y={y(last) - 10} textAnchor="end" fontSize="11" fontWeight="800" fill="#0f6e56">
        {shortNum(last)} ₪
      </text>
      <text x={padL} y={H - 6} fontSize="8.5" fill="#9aa6b5">
        {mLabel(months[0] ?? "")}
      </text>
      <text x={W - padR} y={H - 6} textAnchor="end" fontSize="8.5" fill="#9aa6b5">
        {mLabel(months[months.length - 1] ?? "")}
      </text>
    </svg>
  );
}

export function FlowCard({
  title,
  series,
  lapProfit,
  cumValues,
  cumLabel,
  footLeftLabel,
  footLeftValue,
  footRightLabel,
  footRightValue,
  note,
}: {
  title: string;
  series: { month: string; income: number; expense: number }[];
  lapProfit?: number[];
  cumValues: number[];
  cumLabel: string;
  footLeftLabel: string;
  footLeftValue: number;
  footRightLabel: string;
  footRightValue: number;
  note?: string;
}) {
  return (
    <section className={CARD}>
      <div className={HEAD}>
        <h2 className="text-[15px] font-extrabold text-ink">{title}</h2>
        <div className="flex flex-wrap gap-2.5 text-[11px] font-bold text-muted">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-emerald-600" />
            הכנסות
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-[3px] bg-red-600" />
            הוצאות
          </span>
          {lapProfit && (
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-[3px] w-3.5 rounded-sm bg-[#2563eb]" />
              רווח ניידים
            </span>
          )}
        </div>
      </div>
      <div className="px-2 pt-3">
        <BarsSvg series={series} lapProfit={lapProfit} />
      </div>
      {note && <p className="px-4 pb-2 pt-0.5 text-[11.5px] leading-relaxed text-muted">{note}</p>}
      <div className="border-t border-card-border px-2 pt-2.5">
        <p className="px-2 pb-0.5 text-[10.5px] font-extrabold tracking-wider text-muted">{cumLabel}</p>
        <CumSvg values={cumValues} months={series.map((s) => s.month)} />
      </div>
      <div className="grid grid-cols-2 gap-2.5 border-t border-card-border bg-[#f4f6f9] px-4 py-2.5">
        <div className="flex flex-col">
          <span className="text-[10.5px] font-extrabold text-muted">{footLeftLabel}</span>
          <span className={`text-[17px] tabular-nums ${signClass(footLeftValue)}`}>{money(footLeftValue)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10.5px] font-extrabold text-muted">{footRightLabel}</span>
          <span className={`text-[17px] tabular-nums ${signClass(footRightValue)}`}>{money(footRightValue)}</span>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- report table ---------------------------- */

export function ModeTabs({ monthlyHref, cumHref, cum }: { monthlyHref: string; cumHref: string; cum: boolean }) {
  const on = "rounded-md bg-teal-bg px-2.5 py-1 text-xs font-bold text-teal-dark";
  const off = "rounded-md px-2.5 py-1 text-xs font-bold text-muted hover:bg-[#f4f6f9]";
  return (
    <div className="flex gap-0.5">
      <Link href={monthlyHref} className={cum ? off : on}>
        חודשי
      </Link>
      <Link href={cumHref} className={cum ? on : off}>
        מצטבר
      </Link>
    </div>
  );
}

export function OverviewReportTable({
  rows,
  current,
  cum,
  modeTabs,
}: {
  rows: OverviewMonthRow[];
  current: string;
  cum: boolean;
  modeTabs: JSX.Element;
}) {
  const acc = { mi: 0, me: 0, li: 0, le: 0, ri: 0, re: 0 };
  let runMine = 0;
  const body = rows.map((r) => {
    acc.mi += r.mine.income;
    acc.me += r.mine.expense;
    acc.li += r.rentals.income;
    acc.le += r.rentals.expense;
    acc.ri += r.rooms.income;
    acc.re += r.rooms.expense;
    runMine += r.mine.profit;
    const v = cum
      ? {
          mine: { income: acc.mi, expense: acc.me },
          rentals: { income: acc.li, expense: acc.le },
          rooms: { income: acc.ri, expense: acc.re },
        }
      : r;
    return { month: r.month, v, runMine, isCurrent: r.month === current };
  });
  const T = rows.reduce(
    (a, r) => ({
      mi: a.mi + r.mine.income,
      me: a.me + r.mine.expense,
      li: a.li + r.rentals.income,
      le: a.le + r.rentals.expense,
      ri: a.ri + r.rooms.income,
      re: a.re + r.rooms.expense,
    }),
    { mi: 0, me: 0, li: 0, le: 0, ri: 0, re: 0 },
  );

  return (
    <section className={CARD}>
      <div className={HEAD}>
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">דוח הכנסות והוצאות</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            בכל קבוצה: <b className="text-teal-dark">שלי</b> · <b className="text-[#2563eb]">ניידים</b> ·{" "}
            <b className="text-[#6b3fa0]">חדרי מחשבים</b>
          </p>
        </div>
        {modeTabs}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th rowSpan={2} className={TH}>
                חודש
              </th>
              <th colSpan={3} className={`${TH} bg-emerald-50 text-center text-[11px] text-emerald-600`}>
                הכנסות
              </th>
              <th colSpan={3} className={`${TH} bg-red-50 text-center text-[11px] text-red-600`}>
                הוצאות
              </th>
              <th colSpan={3} className={`${TH} bg-teal-bg text-center text-[11px] text-teal-dark`}>
                רווח
              </th>
              <th rowSpan={2} className={`${TH} ${NUM}`}>
                יתרה מצטברת שלי
              </th>
            </tr>
            <tr>
              <th className={`${TH} ${NUM}`}>שלי</th>
              <th className={`${TH} ${NUM} ${SEP}`}>ניידים</th>
              <th className={`${TH} ${NUM}`}>חדרים</th>
              <th className={`${TH} ${NUM} ${SEP}`}>שלי</th>
              <th className={`${TH} ${NUM} ${SEP}`}>ניידים</th>
              <th className={`${TH} ${NUM}`}>חדרים</th>
              <th className={`${TH} ${NUM} ${SEP}`}>שלי</th>
              <th className={`${TH} ${NUM} ${SEP}`}>ניידים</th>
              <th className={`${TH} ${NUM}`}>חדרים</th>
            </tr>
          </thead>
          <tbody>
            {body.map((b) => (
              <tr key={b.month} className={b.isCurrent ? "bg-teal-bg" : ""}>
                <td className={`${TD} font-extrabold`}>{mLabel(b.month)}</td>
                <td className={`${TD} ${NUM} ${MINE}`}>{money(b.v.mine.income)}</td>
                <td className={`${TD} ${NUM} ${LAP} ${SEP}`}>{money(b.v.rentals.income)}</td>
                <td className={`${TD} ${NUM} ${ROOM}`}>{money(b.v.rooms.income)}</td>
                <td className={`${TD} ${NUM} ${MINE} ${SEP}`}>{money(b.v.mine.expense)}</td>
                <td className={`${TD} ${NUM} ${LAP} ${SEP}`}>{money(b.v.rentals.expense)}</td>
                <td className={`${TD} ${NUM} ${ROOM}`}>{money(b.v.rooms.expense)}</td>
                <td className={`${TD} ${NUM} ${MINE} ${SEP}`}>{money(b.v.mine.income - b.v.mine.expense)}</td>
                <td className={`${TD} ${NUM} ${LAP} ${SEP}`}>{money(b.v.rentals.income - b.v.rentals.expense)}</td>
                <td className={`${TD} ${NUM} ${ROOM}`}>{money(b.v.rooms.income - b.v.rooms.expense)}</td>
                <td className={`${TD} ${NUM} ${SEP} text-muted`}>{money(b.runMine)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-card-border bg-[#f4f6f9] font-black">
              <td className="px-2.5 py-2.5">סה&quot;כ התקופה</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${MINE}`}>{money(T.mi)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${LAP} ${SEP}`}>{money(T.li)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${ROOM}`}>{money(T.ri)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${MINE} ${SEP}`}>{money(T.me)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${LAP} ${SEP}`}>{money(T.le)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${ROOM}`}>{money(T.re)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${MINE} ${SEP}`}>{money(T.mi - T.me)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${LAP} ${SEP}`}>{money(T.li - T.le)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${ROOM}`}>{money(T.ri - T.re)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${SEP}`}>{money(T.mi - T.me)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-4 pb-3.5 pt-2.5 text-[11.5px] leading-relaxed text-muted">
        <b className="text-teal-dark">שלי</b> = רק מה שהזנתי ידנית בהנה&quot;ח (אשראי, מזומן, ניידים, רו&quot;ח,
        ביטוח לאומי...). <b className="text-[#2563eb]">ניידים</b> + <b className="text-[#6b3fa0]">חדרים</b> = הספרים
        של הסניפים עצמם, בסכומים מלאים. <b className="text-ink">שני הספרים לא מתחברים זה לזה</b> — ולכן אין כפילות:
        כסף שעבר מהסניף לכיס שלי נספר ב&quot;שלי&quot; רק כשהזנתי אותו.
      </p>
    </section>
  );
}

/* ---------------------------- branches table ---------------------------- */

export function BranchesTable({
  month,
  entries,
  hrefFor,
}: {
  month: string;
  entries: { branch: Branch; stats: BranchMonth }[];
  hrefFor: (branchId: string) => string;
}) {
  const sorted = [...entries].sort((a, b) => b.stats.profit - a.stats.profit);
  const maxProfit = Math.max(...sorted.map((e) => Math.abs(e.stats.profit)), 1);
  const T = sorted.reduce(
    (a, e) => ({
      income: a.income + e.stats.income,
      expense: a.expense + e.stats.expense,
      profit: a.profit + e.stats.profit,
      owner: a.owner + e.stats.ownerProfit,
      transfer: a.transfer + e.stats.transferToOwner,
    }),
    { income: 0, expense: 0, profit: 0, owner: 0, transfer: 0 },
  );

  return (
    <section className={CARD}>
      <div className={HEAD}>
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">סניפים — {mLabel(month)}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            כל הסניפים כולל חדרי מחשבים, מדורגים לפי רווח. לחיצה על &quot;פירוט&quot; פותחת את הסניף.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className={TH} />
              <th className={`${TH} min-w-[150px] whitespace-normal`}>סניף</th>
              <th className={TH}>סוג</th>
              <th className={`${TH} ${NUM}`}>הכנסות</th>
              <th className={`${TH} ${NUM}`}>הוצאות</th>
              <th className={`${TH} ${NUM}`}>רווח</th>
              <th className={TH}>רווחיות</th>
              <th className={`${TH} ${NUM}`}>הרווח שלי</th>
              <th className={`${TH} ${NUM}`}>להעביר אליי</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-6 text-center text-sm text-muted">
                  אין סניפים פעילים
                </td>
              </tr>
            )}
            {sorted.map((e, i) => {
              const b = e.branch;
              const s = e.stats;
              const w = Math.round((Math.abs(s.profit) / maxProfit) * 100);
              return (
                <tr key={b.id} className={i % 2 ? "bg-[#fafbfd]" : ""}>
                  <td className={TD}>
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-black ${
                        i === 0 ? "bg-teal-bg text-teal-dark" : "bg-[#f4f6f9] text-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className={`${TD} whitespace-normal`}>
                    <b className="text-ink">
                      {b.location ? `${b.location} — ` : ""}
                      {b.name}
                    </b>
                    <br />
                    <span className="text-[10.5px] text-muted">
                      {branchHasPartner(b)
                        ? `${branchPartnerLabel(b)} ${100 - branchOwnerPct(b)}%`
                        : "100% שלי"}
                    </span>
                  </td>
                  <td className={TD}>
                    {b.branchType === "rentals" ? (
                      <span className="rounded-full bg-[#e8effc] px-2 py-0.5 text-[10.5px] font-extrabold text-[#1d4fb8]">
                        ניידים
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#f1ecfa] px-2 py-0.5 text-[10.5px] font-extrabold text-[#6b3fa0]">
                        חדר מחשבים
                      </span>
                    )}
                  </td>
                  <td className={`${TD} ${NUM} font-extrabold text-emerald-600`}>{money(s.income)}</td>
                  <td className={`${TD} ${NUM} font-extrabold text-red-600`}>{money(s.expense)}</td>
                  <td className={`${TD} ${NUM} ${signClass(s.profit)}`}>{money(s.profit)}</td>
                  <td className={TD}>
                    <div className="h-1.5 min-w-[54px] overflow-hidden rounded-sm bg-[#eef1f6]">
                      <i
                        className="block h-full rounded-sm"
                        style={{ width: `${w}%`, background: s.profit >= 0 ? "#059669" : "#dc2626" }}
                      />
                    </div>
                    <span className="text-[10.5px] text-muted">{Math.round(s.margin * 100)}% שולי רווח</span>
                  </td>
                  <td className={`${TD} ${NUM} ${MINE}`}>{money(s.ownerProfit)}</td>
                  <td className={`${TD} ${NUM}`}>
                    {branchHasPartner(b) ? (
                      <b className="text-teal-dark">{money(s.transferToOwner)}</b>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className={TD}>
                    <Link
                      href={hrefFor(b.id)}
                      className="rounded-lg border border-card-border bg-white px-2 py-1 text-[11.5px] font-bold text-ink transition hover:border-teal hover:text-teal"
                    >
                      פירוט ›
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-card-border bg-[#f4f6f9] font-black">
              <td className="px-2.5 py-2.5" />
              <td className="px-2.5 py-2.5">סה&quot;כ כל הסניפים</td>
              <td className="px-2.5 py-2.5" />
              <td className={`px-2.5 py-2.5 ${NUM}`}>{money(T.income)}</td>
              <td className={`px-2.5 py-2.5 ${NUM}`}>{money(T.expense)}</td>
              <td className={`px-2.5 py-2.5 ${NUM} ${signClass(T.profit)}`}>{money(T.profit)}</td>
              <td className="px-2.5 py-2.5" />
              <td className={`px-2.5 py-2.5 ${NUM} ${MINE}`}>{money(T.owner)}</td>
              <td className={`px-2.5 py-2.5 ${NUM}`}>{money(T.transfer)}</td>
              <td className="px-2.5 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

/* ---------------------------- branch mini cards ---------------------------- */

export function BranchMiniCards({
  month,
  entries,
  hrefFor,
  activeId,
}: {
  month: string;
  entries: { branch: Branch; stats: BranchMonth }[];
  hrefFor: (branchId: string) => string;
  activeId?: string;
}) {
  const groups: { label: string; items: typeof entries }[] = [
    { label: "השכרות מחשבים ניידים", items: entries.filter((e) => e.branch.branchType === "rentals") },
    { label: "חדרי מחשבים", items: entries.filter((e) => e.branch.branchType === "computers") },
  ];
  return (
    <section className={CARD}>
      <div className={HEAD}>
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">מעבר מהיר לסניף</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{mLabel(month)}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 p-3">
        {groups.map((g) => (
          <div key={g.label} className="flex flex-col gap-2.5">
            <p className="px-1 pt-1 text-[10.5px] font-extrabold tracking-wider text-muted">{g.label}</p>
            {g.items.length === 0 && <p className="px-1 text-xs text-muted">אין סניפים</p>}
            {g.items.map(({ branch: b, stats: s }) => (
              <Link
                key={b.id}
                href={hrefFor(b.id)}
                className={`block rounded-xl border p-3 transition hover:border-teal hover:shadow-[0_2px_10px_rgba(26,138,118,0.13)] ${
                  b.id === activeId ? "border-teal bg-[#f6fbfa]" : "border-card-border bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13.5px] font-black text-ink">
                      {b.location ? `${b.location} — ` : ""}
                      {b.name}
                    </div>
                    <div className="mt-px text-[11px] text-muted">
                      {branchHasPartner(b)
                        ? `שותף: ${branchPartnerLabel(b)} (${100 - branchOwnerPct(b)}%)`
                        : "100% שלי"}
                    </div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-dashed border-card-border pt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted">הכנסות</span>
                    <span className="text-[13px] font-black tabular-nums text-emerald-600">{money(s.income)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted">הוצאות</span>
                    <span className="text-[13px] font-black tabular-nums text-red-600">{money(s.expense)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted">רווח</span>
                    <span className="text-[13px] font-black tabular-nums text-teal-dark">{money(s.profit)}</span>
                  </div>
                </div>
                <div
                  className={`mt-2 flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 ${
                    branchHasPartner(b) ? "bg-teal-bg" : "bg-[#f4f6f9]"
                  }`}
                >
                  <span
                    className={`text-[10.5px] font-extrabold ${
                      branchHasPartner(b) ? "text-teal-dark" : "text-muted"
                    }`}
                  >
                    {branchHasPartner(b) ? `להעביר אליי ב-1/${nextMonthNum(month)}` : "אין העברה — הסניף כולו שלי"}
                  </span>
                  <span
                    className={`text-sm font-black tabular-nums ${
                      branchHasPartner(b) ? "text-teal-dark" : "text-muted"
                    }`}
                  >
                    {branchHasPartner(b) ? money(s.transferToOwner) : "—"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------- cost table ------------------------------- */

const OWED_PILL: Record<string, { text: string; cls: string }> = {
  owner: { text: "עליי (100%)", cls: "bg-teal-bg text-teal-dark" },
  partner: { text: "על השותף (100%)", cls: "bg-[#fdf1e7] text-[#a15c1b]" },
  shared: { text: "50% / 50%", cls: "bg-[#eef0fb] text-[#45499b]" },
};

function Settle({ net, partnerName, ownerName }: { net: number; partnerName: string; ownerName: string }) {
  if (Math.abs(net) < 1) return <span className="text-muted">מאוזן</span>;
  return net > 0 ? (
    <span className="font-extrabold text-emerald-600">
      {partnerName} → {ownerName} {money(net)}
    </span>
  ) : (
    <span className="font-extrabold text-red-600">
      {ownerName} → {partnerName} {money(-net)}
    </span>
  );
}

export function CostTable({
  title,
  subtitle,
  lines,
  branch,
  ownerName,
}: {
  title: string;
  subtitle: string;
  lines: CostLine[];
  branch: Branch;
  ownerName: string;
}) {
  if (lines.length === 0) return null;
  const partnerName = branchPartnerLabel(branch);
  const hasPartner = branchHasPartner(branch);
  const T = lines.reduce(
    (a, l) => ({
      total: a.total + l.total,
      owner: a.owner + l.ownerShare,
      partner: a.partner + l.partnerShare,
      net: a.net + l.netToOwner,
    }),
    { total: 0, owner: 0, partner: 0, net: 0 },
  );

  return (
    <section className={CARD}>
      <div className={HEAD}>
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">{title}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className={`${TH} min-w-[150px] whitespace-normal`}>קטגוריה</th>
              <th className={`${TH} ${NUM}`}>כמות</th>
              <th className={`${TH} ${NUM}`}>ליחידה</th>
              <th className={`${TH} ${NUM}`}>סה&quot;כ</th>
              <th className={TH}>על מי ההוצאה</th>
              <th className={TH}>שילם בפועל</th>
              <th className={`${TH} ${NUM}`}>החלק שלי</th>
              <th className={`${TH} ${NUM}`}>חלק השותף</th>
              <th className={TH}>קיזוז</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const pill = OWED_PILL[l.owedBy] ?? OWED_PILL.owner!;
              const owed = l.owedLabel ? { ...pill, text: l.owedLabel } : pill;
              return (
                <tr key={`${l.key}-${l.label}-${i}`} className={i % 2 ? "bg-[#fafbfd]" : ""}>
                  <td className={`${TD} whitespace-normal`}>
                    <b className="text-ink">{l.label}</b>
                    <br />
                    <span className="text-[10.5px] text-muted">{l.qtyNote}</span>
                  </td>
                  <td className={`${TD} ${NUM}`}>{qty(l.qty)}</td>
                  <td className={`${TD} ${NUM} text-muted`}>{money(l.unitCost)}</td>
                  <td className={`${TD} ${NUM} font-extrabold`}>{money(l.total)}</td>
                  <td className={TD}>
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${owed.cls}`}>
                      {owed.text}
                    </span>
                  </td>
                  <td className={TD}>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                        l.paidBy === "partner" ? "bg-[#fdf1e7] text-[#a15c1b]" : "bg-teal-bg text-teal-dark"
                      }`}
                    >
                      {l.paidBy === "partner" ? partnerName : ownerName}
                    </span>
                  </td>
                  <td className={`${TD} ${NUM} ${MINE}`}>{money(l.ownerShare)}</td>
                  <td className={`${TD} ${NUM}`}>{money(l.partnerShare)}</td>
                  <td className={TD}>
                    {hasPartner ? (
                      <Settle net={l.netToOwner} partnerName={partnerName} ownerName={ownerName} />
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-card-border bg-[#f4f6f9] font-black">
              <td className="px-2.5 py-2.5">סיכום</td>
              <td className="px-2.5 py-2.5" />
              <td className="px-2.5 py-2.5" />
              <td className={`px-2.5 py-2.5 ${NUM}`}>{money(T.total)}</td>
              <td className="px-2.5 py-2.5" />
              <td className="px-2.5 py-2.5" />
              <td className={`px-2.5 py-2.5 ${NUM} ${MINE}`}>{money(T.owner)}</td>
              <td className={`px-2.5 py-2.5 ${NUM}`}>{money(T.partner)}</td>
              <td className="px-2.5 py-2.5">
                {hasPartner ? (
                  <Settle net={T.net} partnerName={partnerName} ownerName={ownerName} />
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
