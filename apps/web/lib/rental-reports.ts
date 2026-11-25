/**
 * דוחות השכרות — תפוסה, רווחיות, מחזור, מספר שוכרים וממוצע משך השכרה, לכל סניפי ההשכרות או לבחירה.
 *
 * רק סניפי `branchType === "rentals"` נכנסים לכאן; חדרי מחשבים ומשרד שיתופי לעולם לא.
 * והמחשבים הם מחשבים ניידים (`Rental.kind === "laptop"`) — סטיקים לא נספרים בתפוסה.
 *
 * ── הגדרות ──
 * - **תפוסה** = ימי השכרה ÷ ימי זמינות, על כל המחשבים בסניפים שנבחרו. יום זמינות = יום שבו המחשב כבר
 *   נוסף לסניף, עוד לא יצא ממנו, ולא היה בתיקון. **שבתות לא נספרות** (לא במונה ולא במכנה). חגים לא
 *   מוחרגים — אין במערכת לוח חגים.
 * - **מחזור (ברוטו)** = הכנסות שנגבו בפועל: השכרות ששולמו והוחזרו (לפי תאריך ההחזרה) + הכנסות ידניות
 *   של הבעלים — בדיוק אותן שורות שההנה"ח של הסניף סופרת.
 * - **רווחיות** — מגיעה מ-`computeBranchFinancials`, כלומר אחרי הוצאות הסניף וחלק השותף, **כפי שהם רשומים**
 *   (בלי הורדת מע"מ). `myProfit` = הרווח שלי (אחרי אחוזי שותף ואחוזי
 *   ברוטו שאני מעביר); `netProfit` = רווח הסניף כולו (חלקי + חלק השותף). רכש (מחשבים, ציוד) לא נספר.
 * - **רווח למחשב** = רווח ÷ מחשב-חודשים שקולים (Σ ימי זמינות של כל מחשב ÷ ימי החודש) — אותו מכנה של
 *   `lib/laptop-branch-tracking.ts`, כך שתקופה של כמה חודשים מתחשבת בכמה מחשבים היו בכל חודש.
 *
 * ההנה"ח של הסניף היא חודשית, ולכן הרווח לטווח שאינו חודשים שלמים **מחולק יחסית לימים** (ומסומן
 * "משוער" במסך). המחזור, התפוסה, השוכרים והמשך מדויקים לפי יום.
 *
 * עלות AI: אפס. הכל חישוב דטרמיניסטי מ-Firestore.
 */
import type { Branch, Laptop, LaptopRepair, Rental } from "@ultranet/shared-types";
import {
  computeBranchFinancials,
  loadBranchAccountingRawData,
  type BranchAccountingRawData,
} from "./branch-accounting-data";

const DAY_MS = 86_400_000;

export type ReportPreset = "today" | "3d" | "week" | "month" | "range" | "all";

export interface BranchOption {
  id: string;
  name: string;
}

export interface PeriodTotals {
  availableDays: number;
  rentedDays: number;
  /** 0..1; null = אין ימי זמינות בתקופה */
  occupancy: number | null;
  revenue: number;
  netProfit: number;
  myProfit: number;
  /** מחשב-חודשים שקולים — המכנה של הרווח למחשב */
  computerMonths: number;
  netPerComputer: number | null;
  myPerComputer: number | null;
  revenuePerComputer: number | null;
  /** לקוחות שונים שהתחילו השכרת מחשב בתקופה */
  renters: number;
  /** כמה השכרות מחשב התחילו בתקופה */
  rentals: number;
  /** ממוצע ימי השכרה (השכרה פעילה נספרת עד היום); null = אין השכרות */
  avgDays: number | null;
  durations: { label: string; count: number }[];
}

export interface SeriesPoint {
  label: string;
  availableDays: number;
  rentedDays: number;
  occupancy: number | null;
  revenue: number;
  netProfit: number;
  myProfit: number;
}

export type TrendDirection = "up" | "down" | "flat";
export interface Trend {
  direction: TrendDirection;
  /** תפוסה: הפרש בנקודות אחוז; מחזור ורווח: שינוי באחוזים */
  delta: number;
  basis: "previous" | "halves";
}

export interface ReportResult {
  from: string;
  to: string;
  branches: BranchOption[];
  selectedIds: string[];
  totals: PeriodTotals;
  /** התקופה שקדמה לטווח באותו אורך; null כשאין נתונים לפניה */
  previous: PeriodTotals | null;
  series: SeriesPoint[];
  bucket: "day" | "week" | "month";
  trends: { occupancy: Trend | null; revenue: Trend | null; netProfit: Trend | null; myProfit: Trend | null };
  perBranch: (PeriodTotals & { id: string; name: string })[];
  /** הרווח חולק יחסית לימים כי הטווח אינו חודשים שלמים */
  profitIsEstimate: boolean;
}

/* ───────────────────────── ימים ───────────────────────── */

export function todayIsrael(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
}

function dayIndex(date: string): number {
  return Math.floor(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

function dayString(idx: number): string {
  return new Date(idx * DAY_MS).toISOString().slice(0, 10);
}

function isSaturday(idx: number): boolean {
  return new Date(idx * DAY_MS).getUTCDay() === 6;
}

function daysInMonthOf(idx: number): number {
  const d = new Date(idx * DAY_MS);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

/** מכנה החודש ליחס יומי: החודש הנוכחי עוד לא נגמר — הנה"ח שלו היא "עד היום", ולכן מחלקים בימים שעברו. */
function monthDivisor(idx: number, today: number): number {
  return monthOf(idx) === monthOf(today) ? Number(dayString(today).slice(8, 10)) : daysInMonthOf(idx);
}

function monthOf(idx: number): string {
  return dayString(idx).slice(0, 7);
}

/** מתרגם בחירת תקופה מהכתובת לטווח תאריכים [from, to] (כולל). */
export function resolveRange(
  preset: ReportPreset,
  opts: { month?: string; from?: string; to?: string; allStart: string },
  today = todayIsrael(),
): { from: string; to: string } {
  const t = dayIndex(today);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "3d":
      return { from: dayString(t - 2), to: today };
    case "week":
      // השבוע = מיום ראשון האחרון ועד היום
      return { from: dayString(t - new Date(t * DAY_MS).getUTCDay()), to: today };
    case "month": {
      const m = opts.month && /^\d{4}-\d{2}$/.test(opts.month) ? opts.month : today.slice(0, 7);
      const [y, mo] = m.split("-").map(Number) as [number, number];
      const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
      const to = `${m}-${String(last).padStart(2, "0")}`;
      return { from: `${m}-01`, to: to > today ? today : to };
    }
    case "range": {
      const f = opts.from && iso.test(opts.from) ? opts.from : today.slice(0, 7) + "-01";
      const e = opts.to && iso.test(opts.to) ? opts.to : today;
      return f <= e ? { from: f, to: e > today ? today : e } : { from: e, to: f > today ? today : f };
    }
    case "all":
    default:
      return { from: opts.allStart, to: today };
  }
}

/* ───────────────────────── נתונים ───────────────────────── */

export function reportBranches(raw: BranchAccountingRawData): Branch[] {
  return raw.branches.filter((b) => b.branchType === "rentals" && !b.deleted && !b.closedAt);
}

function firstActiveMonth(branch: Branch): string | null {
  const r = branch.openedAt || branch.founded;
  return r ? r.slice(0, 7) : null;
}

/** היום הראשון שבו מחשב נחשב זכאי: הוספה, ובהיעדרה ההשכרה הראשונה שלו, ובהיעדרה — `fallback`. */
function laptopStart(l: Laptop, raw: BranchAccountingRawData, fallback: number): number {
  if (l.addedDate) return dayIndex(l.addedDate);
  const first = raw.firstRentalByLaptop.get(l.id);
  return first ? dayIndex(first) : fallback;
}

/** תחילת כל הפעילות בסניפים הנבחרים: ההוספה/ההשכרה הראשונה של המחשבים, או פתיחת הסניף. */
export function earliestActivity(raw: BranchAccountingRawData, branches: Branch[], today = todayIsrael()): string {
  let min = dayIndex(today);
  for (const b of branches) {
    const opened = b.openedAt || b.founded;
    if (opened) min = Math.min(min, dayIndex(opened));
    for (const l of raw.laptopsByBranch.get(b.id) ?? []) {
      if (l.addedDate) min = Math.min(min, dayIndex(l.addedDate));
      else {
        const f = raw.firstRentalByLaptop.get(l.id);
        if (f) min = Math.min(min, dayIndex(f));
      }
    }
  }
  return dayString(min);
}

interface BranchDays {
  available: number[];
  rented: number[];
  revenue: number[];
  net: number[];
  mine: number[];
  /** מחשבים שקולים של אותו יום, מנורמל: זמינים ÷ ימי החודש */
  equiv: number[];
}

/** סורק את החלון [start, end] (אינדקסי יום) ובונה מערך לכל יום לכל סניף. */
function buildBranchDays(raw: BranchAccountingRawData, branch: Branch, start: number, end: number, today: number): BranchDays {
  const n = end - start + 1;
  const out: BranchDays = {
    available: new Array(n).fill(0),
    rented: new Array(n).fill(0),
    revenue: new Array(n).fill(0),
    net: new Array(n).fill(0),
    mine: new Array(n).fill(0),
    equiv: new Array(n).fill(0),
  };
  const laptops = (raw.laptopsByBranch.get(branch.id) ?? []) as Laptop[];
  const repairs = (raw.repairsByBranch.get(branch.id) ?? []) as LaptopRepair[];
  const rentals = (raw.rentalsByBranch.get(branch.id) ?? []) as Rental[];

  const repairsBy = new Map<string, [number, number][]>();
  for (const r of repairs) {
    const list = repairsBy.get(r.laptopId) ?? [];
    list.push([dayIndex(r.from), r.to ? dayIndex(r.to) : Number.POSITIVE_INFINITY]);
    repairsBy.set(r.laptopId, list);
  }
  const rentalsBy = new Map<string, [number, number][]>();
  for (const r of rentals) {
    if (r.kind !== "laptop" || !r.startDate) continue;
    const s = dayIndex(r.startDate);
    const back = r.returnDate ?? r.endDate;
    const e = r.status === "active" || !back ? today + 1 : Math.max(dayIndex(back), s + 1);
    const list = rentalsBy.get(r.itemId) ?? [];
    list.push([s, e]);
    rentalsBy.set(r.itemId, list);
  }

  for (const l of laptops) {
    const from = laptopStart(l, raw, start);
    const to = l.endedAt ? dayIndex(l.endedAt) : Number.POSITIVE_INFINITY;
    const rep = repairsBy.get(l.id) ?? [];
    const rent = rentalsBy.get(l.id) ?? [];
    for (let d = Math.max(start, from); d <= Math.min(end, to - 1, today); d++) {
      if (rep.some(([a, b]) => d >= a && d < b)) continue;
      const i = d - start;
      out.equiv[i]! += 1 / monthDivisor(d, today);
      if (isSaturday(d)) continue;
      out.available[i]! += 1;
      if (rent.some(([a, b]) => d >= a && d < b)) out.rented[i]! += 1;
    }
  }

  // מחזור: אותן שורות כמו ההנה"ח — השכרה ששולמה והוחזרה (לפי יום ההחזרה) + הכנסה ידנית.
  const addRevenue = (date: string, amount: number) => {
    const d = dayIndex(date);
    if (d >= start && d <= end) out.revenue[d - start]! += amount;
  };
  for (const r of rentals) {
    if (r.status === "returned" && r.returnDate && r.paid) addRevenue(r.returnDate, r.finalPrice ?? r.calcPrice ?? 0);
  }
  for (const i of raw.branchIncomeByBranch.get(branch.id) ?? []) addRevenue(i.date, i.amount || 0);

  // רווח: חודשי מההנה"ח, מחולק יחסית לימי החודש.
  const opened = firstActiveMonth(branch);
  const closedRaw = branch.closedAt || branch.deletedAt;
  const closed = closedRaw ? closedRaw.slice(0, 7) : null;
  const cache = new Map<string, { net: number; mine: number } | null>();
  for (let d = start; d <= end; d++) {
    const m = monthOf(d);
    let f = cache.get(m);
    if (f === undefined) {
      const existed = !branch.notStarted && (!opened || opened <= m) && (!closed || m <= closed);
      if (!existed) f = null;
      else {
        const fin = computeBranchFinancials(branch, raw, m);
        // רווח הסניף כולו = חלקי התפעולי + התוצאה של השותף (הכנסה פחות הוצאה בחלקו)
        f = {
          mine: fin.ownerOperatingProfitThisMonth,
          net: fin.ownerOperatingProfitThisMonth + fin.balanceThisMonth,
        };
      }
      cache.set(m, f);
    }
    if (!f) continue;
    const dim = monthDivisor(d, today);
    out.net[d - start]! += f.net / dim;
    out.mine[d - start]! += f.mine / dim;
  }
  return out;
}

/** משך השכרה בימים: יום אחד לפחות; פעילה — עד היום. */
function durationDays(r: Rental, today: number): number {
  const s = dayIndex(r.startDate);
  const back = r.returnDate ?? r.endDate;
  const e = r.status === "active" || !back ? today : dayIndex(back);
  return Math.max(1, e - s);
}

function rentalStats(rentals: Rental[], start: number, end: number, today: number) {
  const inRange = rentals.filter((r) => {
    if (r.kind !== "laptop" || !r.startDate) return false;
    const s = dayIndex(r.startDate);
    return s >= start && s <= end;
  });
  const buckets = [
    { label: "יום", max: 1, count: 0 },
    { label: "2–3 ימים", max: 3, count: 0 },
    { label: "4–7 ימים", max: 7, count: 0 },
    { label: "יותר משבוע", max: Infinity, count: 0 },
  ];
  let total = 0;
  for (const r of inRange) {
    const d = durationDays(r, today);
    total += d;
    buckets.find((b) => d <= b.max)!.count++;
  }
  return {
    clients: new Set(inRange.map((r) => r.clientId)),
    rentals: inRange.length,
    totalDays: total,
    buckets: buckets.map(({ label, count }) => ({ label, count })),
  };
}

/* ───────────────────────── סיכום ───────────────────────── */

interface Slice {
  days: BranchDays;
  rentals: Rental[];
}

function summarize(slices: Slice[], lo: number, hi: number, offset: number, today: number): PeriodTotals {
  // lo/hi — אינדקסי יום מוחלטים; offset — האינדקס המוחלט של תא 0 במערכי הימים
  let available = 0, rented = 0, revenue = 0, net = 0, mine = 0, equiv = 0;
  const clients = new Set<string>();
  let rentals = 0, totalDays = 0;
  const durations = [0, 0, 0, 0];
  const labels = ["יום", "2–3 ימים", "4–7 ימים", "יותר משבוע"];
  for (const s of slices) {
    for (let d = lo; d <= hi; d++) {
      const i = d - offset;
      available += s.days.available[i]!;
      rented += s.days.rented[i]!;
      revenue += s.days.revenue[i]!;
      net += s.days.net[i]!;
      mine += s.days.mine[i]!;
      equiv += s.days.equiv[i]!;
    }
    const st = rentalStats(s.rentals, lo, hi, today);
    st.clients.forEach((c) => clients.add(c));
    rentals += st.rentals;
    totalDays += st.totalDays;
    st.buckets.forEach((b, i) => (durations[i]! += b.count));
  }
  return {
    availableDays: available,
    rentedDays: rented,
    occupancy: available > 0 ? rented / available : null,
    revenue,
    netProfit: net,
    myProfit: mine,
    computerMonths: equiv,
    netPerComputer: equiv > 0 ? net / equiv : null,
    myPerComputer: equiv > 0 ? mine / equiv : null,
    revenuePerComputer: equiv > 0 ? revenue / equiv : null,
    renters: clients.size,
    rentals,
    avgDays: rentals > 0 ? totalDays / rentals : null,
    durations: labels.map((label, i) => ({ label, count: durations[i]! })),
  };
}

function pct(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100;
  return ((to - from) / Math.abs(from)) * 100;
}

function trendOf(dir: number, flatBelow: number, delta: number, basis: Trend["basis"]): Trend {
  return { direction: Math.abs(dir) < flatBelow ? "flat" : dir > 0 ? "up" : "down", delta, basis };
}

function computeTrends(totals: PeriodTotals, previous: PeriodTotals | null, series: SeriesPoint[]) {
  const occ = (a: number | null, b: number | null): Trend | null =>
    a === null || b === null ? null : trendOf(b - a, 0.005, (b - a) * 100, previous ? "previous" : "halves");
  const money = (a: number, b: number): Trend =>
    trendOf(pct(a, b), 1, pct(a, b), previous ? "previous" : "halves");

  if (previous) {
    return {
      occupancy: occ(previous.occupancy, totals.occupancy),
      revenue: money(previous.revenue, totals.revenue),
      netProfit: money(previous.netProfit, totals.netProfit),
      myProfit: money(previous.myProfit, totals.myProfit),
    };
  }
  if (series.length < 2) return { occupancy: null, revenue: null, netProfit: null, myProfit: null };
  const mid = Math.floor(series.length / 2);
  const a = series.slice(0, mid);
  const b = series.slice(series.length - mid);
  const sum = (xs: SeriesPoint[], k: "revenue" | "netProfit" | "myProfit") => xs.reduce((s, x) => s + x[k], 0);
  const ratio = (xs: SeriesPoint[]) => {
    const av = xs.reduce((s, x) => s + x.availableDays, 0);
    return av > 0 ? xs.reduce((s, x) => s + x.rentedDays, 0) / av : null;
  };
  return {
    occupancy: occ(ratio(a), ratio(b)),
    revenue: money(sum(a, "revenue"), sum(b, "revenue")),
    netProfit: money(sum(a, "netProfit"), sum(b, "netProfit")),
    myProfit: money(sum(a, "myProfit"), sum(b, "myProfit")),
  };
}

function buildSeries(slices: Slice[], lo: number, hi: number, offset: number): { series: SeriesPoint[]; bucket: ReportResult["bucket"] } {
  const len = hi - lo + 1;
  const bucket: ReportResult["bucket"] = len <= 14 ? "day" : len <= 70 ? "week" : "month";
  const keyOf = (d: number) => (bucket === "day" ? d : bucket === "week" ? Math.floor((d - lo) / 7) : Number(monthOf(d).replace("-", "")));
  const labelOf = (d: number) => {
    const s = dayString(d);
    return bucket === "month" ? `${s.slice(5, 7)}/${s.slice(2, 4)}` : `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  };
  const points = new Map<number, SeriesPoint>();
  for (let d = lo; d <= hi; d++) {
    const k = keyOf(d);
    let p = points.get(k);
    if (!p) {
      p = { label: labelOf(d), availableDays: 0, rentedDays: 0, occupancy: null, revenue: 0, netProfit: 0, myProfit: 0 };
      points.set(k, p);
    }
    for (const s of slices) {
      const i = d - offset;
      p.availableDays += s.days.available[i]!;
      p.rentedDays += s.days.rented[i]!;
      p.revenue += s.days.revenue[i]!;
      p.netProfit += s.days.net[i]!;
      p.myProfit += s.days.mine[i]!;
    }
  }
  const series = [...points.values()].map((p) => ({ ...p, occupancy: p.availableDays > 0 ? p.rentedDays / p.availableDays : null }));
  return { series, bucket };
}

/* ───────────────────────── נקודת כניסה ───────────────────────── */

export interface ReportQuery {
  preset: ReportPreset;
  month?: string;
  from?: string;
  to?: string;
  /** מזהי סניפים; ריק = כל סניפי ההשכרות */
  branchIds: string[];
}

export async function loadRentalReport(query: ReportQuery): Promise<ReportResult & { allStart: string }> {
  const raw = await loadBranchAccountingRawData();
  const today = todayIsrael();
  const all = reportBranches(raw).sort((a, b) => a.name.localeCompare(b.name, "he"));
  const allowed = new Set(all.map((b) => b.id));
  const selectedIds = query.branchIds.filter((id) => allowed.has(id));
  const chosen = selectedIds.length > 0 ? all.filter((b) => selectedIds.includes(b.id)) : all;

  const allStart = earliestActivity(raw, chosen, today);
  const { from, to } = resolveRange(query.preset, { month: query.month, from: query.from, to: query.to, allStart }, today);
  const lo = dayIndex(from);
  const hi = dayIndex(to);
  const len = hi - lo + 1;
  const todayIdx = dayIndex(today);
  // התקופה הקודמת — באותו אורך, מיד לפני. נבנית רק אם יש בה פעילות אפשרית (אחרי תחילת הפעילות).
  const prevLo = lo - len;
  const prevHi = lo - 1;
  const hasPrev = prevHi >= dayIndex(allStart);

  const winStart = hasPrev ? prevLo : lo;
  const slices: (Slice & { branch: Branch })[] = chosen.map((branch) => ({
    branch,
    days: buildBranchDays(raw, branch, winStart, hi, todayIdx),
    rentals: (raw.rentalsByBranch.get(branch.id) ?? []) as Rental[],
  }));

  const totals = summarize(slices, lo, hi, winStart, todayIdx);
  const previous = hasPrev ? summarize(slices, Math.max(prevLo, dayIndex(allStart)), prevHi, winStart, todayIdx) : null;
  const { series, bucket } = buildSeries(slices, lo, hi, winStart);
  const perBranch = slices.map((s) => ({
    id: s.branch.id,
    name: s.branch.name,
    ...summarize([s], lo, hi, winStart, todayIdx),
  }));

  const wholeMonths = from.endsWith("-01") && (to === today || dayString(hi + 1).endsWith("-01"));
  return {
    from,
    to,
    branches: all.map((b) => ({ id: b.id, name: b.name })),
    selectedIds,
    totals,
    previous,
    series,
    bucket,
    trends: computeTrends(totals, previous, series),
    perBranch,
    profitIsEstimate: !wholeMonths,
    allStart,
  };
}
