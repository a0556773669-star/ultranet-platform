/**
 * The unified accounting picture behind /dashboard/accounting/overview.
 *
 * TWO SEPARATE BOOKS, NEVER SUMMED TOGETHER - that's the whole anti-double-counting rule:
 *
 *  1. "שלי" - the owner's own ledger: exactly the rows the owner typed into n_ah_income /
 *     n_ah_expenses, nothing computed, nothing derived. This is the money that actually moved
 *     through the owner's hands.
 *  2. "הסניפים" - each branch's real operating book at 100%: what the branch took in and what
 *     it costs to run, regardless of whose pocket it passed through. Split per branch into
 *     ניידים (rentals) and חדרי מחשבים (computers).
 *
 * Cash that moved from a branch to the owner shows up in book 1 only once the owner logs it,
 * and stays in book 2 as branch income - the two are different questions, so adding them
 * would be meaningless, not just double counting. Every screen keeps them in separate columns.
 *
 * Inside book 2, each cost is counted from exactly one source: a branch expense the owner typed
 * by hand (n_fixed_expenses / n_var_expenses) wins, and the matching price-list line
 * (n_cost_rates) is suppressed for that branch/month and reported in `suppressed` so nothing
 * silently disappears.
 */
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import { getAdminFirestore } from "./firebase-admin";
import type {
  Branch,
  Laptop,
  Stick,
  Rental,
  BranchIncome,
  FixedExpense,
  VariableExpense,
  AccountingIncome,
  AccountingExpense,
  CollectionRoute,
  CostRate,
  BranchCostSetting,
  AdArea,
} from "@ultranet/shared-types";
import {
  ownerExpenseBurden,
  expenseNetToOwnerFromShares,
  isCollectedByOwner,
  incomeShareToOwner,
  type RentalIncomeLine,
} from "./branch-accounting";
import {
  loadCostRates,
  branchCostSettingId,
  expenseCoversRate,
  COMPUTER_RATE_KEY,
  GRAPHICS_RATE_KEY,
} from "./cost-rates";
import { ADS_RATE_KEY, adAreaForBranch, adAreaNote, splitAdArea } from "./ad-areas";
import { loadAdAreas } from "./ad-areas-data";

export type OwedBy = "owner" | "partner" | "shared";
export type PaidBy = "owner" | "partner";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** The `count` months ending at (and including) `endMonth`, oldest first. */
export function monthsEndingAt(endMonth: string, count = 12): string[] {
  const [ey, em] = endMonth.split("-").map(Number);
  if (!ey || !em) return [];
  const out: string[] = [];
  let y = ey;
  let m = em;
  for (let i = 0; i < count; i++) {
    out.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export function branchOwnerPct(b: Branch): number {
  if (b.isMine) return 100;
  const pct = b.myPct ?? 100 - (b.partnerPct ?? 0);
  return Number.isFinite(pct) ? pct : 100;
}
export function branchHasPartner(b: Branch): boolean {
  return branchOwnerPct(b) < 100;
}
export function branchPartnerLabel(b: Branch): string {
  return b.partnerName?.trim() || "השותף";
}

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export interface Bucket {
  income: number;
  expense: number;
  profit: number;
}
const emptyBucket = (): Bucket => ({ income: 0, expense: 0, profit: 0 });

export interface MyEntry {
  id: string;
  date: string;
  label: string;
  category?: string;
  amount: number;
}

export interface MyMonth {
  month: string;
  income: MyEntry[];
  expenses: MyEntry[];
  incomeTotal: number;
  expenseTotal: number;
  profit: number;
}

export interface CostLine {
  key: string;
  label: string;
  qty: number;
  unitCost: number;
  total: number;
  owedBy: OwedBy;
  paidBy: PaidBy;
  kind: "once" | "monthly";
  /** where the number came from, so the screen can say so out loud */
  source: "rate" | "fixed" | "variable" | "area";
  qtyNote: string;
  /** overrides the "על מי ההוצאה" pill text for splits `owedBy` can't express (e.g. 70/30) */
  owedLabel?: string;
  ownerShare: number;
  partnerShare: number;
  /** positive = the partner owes this to the owner; negative = the owner owes the partner */
  netToOwner: number;
}

export interface SuppressedLine {
  rateLabel: string;
  reason: string;
}

export interface BranchMonth {
  branchId: string;
  month: string;
  income: number;
  expense: number;
  profit: number;
  margin: number;
  ownerIncome: number;
  ownerExpense: number;
  ownerProfit: number;
  /** net of the month's expense lines between owner and partner */
  expenseNet: number;
  /** what the partner transfers to the owner on the 1st (0 when there's no partner) */
  transferToOwner: number;
  lines: CostLine[];
  suppressed: SuppressedLine[];
}

export interface OverviewMonthRow {
  month: string;
  mine: Bucket;
  rentals: Bucket;
  rooms: Bucket;
  branches: Bucket;
  transferToOwner: number;
}

export interface OverviewData {
  months: string[];
  branches: Branch[];
  rates: CostRate[];
  usingDefaultRates: boolean;
  adAreas: AdArea[];
  myByMonth: Map<string, MyMonth>;
  branchMonths: Map<string, BranchMonth>;
  /** branchId -> cumulative one-time equipment lines (investment to date) */
  investmentByBranch: Map<string, CostLine[]>;
  /** branchId -> rateKey -> the quantity the system derives on its own, before any manual
   *  override; the per-branch settings form shows it as the placeholder */
  autoQtyByBranch: Map<string, Map<string, number>>;
  rows: OverviewMonthRow[];
}

const key = (branchId: string, month: string) => `${branchId}|${month}`;

/* ------------------------------------------------------------------ *
 * Splitting one expense between owner and partner
 * ------------------------------------------------------------------ */

function makeLine(
  input: Omit<CostLine, "ownerShare" | "partnerShare" | "netToOwner">,
  /** the owner's share, when it isn't the plain owner/partner/50-50 that `owedBy` encodes */
  ownerShareOverride?: number,
): CostLine {
  const ownerShare = ownerShareOverride ?? ownerExpenseBurden(input.total, input.owedBy);
  return {
    ...input,
    ownerShare,
    partnerShare: input.total - ownerShare,
    netToOwner: expenseNetToOwnerFromShares(input.total, ownerShare, input.paidBy),
  };
}

/* ------------------------------------------------------------------ *
 * Loader
 * ------------------------------------------------------------------ */

interface RawData {
  branches: Branch[];
  laptopsByBranch: Map<string, Laptop[]>;
  sticksByBranch: Map<string, Stick[]>;
  rentalsByBranch: Map<string, Rental[]>;
  branchIncomeByBranch: Map<string, BranchIncome[]>;
  fixedByBranch: Map<string, FixedExpense[]>;
  variableByBranch: Map<string, VariableExpense[]>;
  routesById: Map<string, CollectionRoute>;
  ahIncome: AccountingIncome[];
  ahExpenses: AccountingExpense[];
  rates: CostRate[];
  usingDefaultRates: boolean;
  settings: Map<string, BranchCostSetting>;
  adAreas: AdArea[];
}

function groupBy<T extends { branchId: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const arr = map.get(item.branchId) ?? [];
    arr.push(item);
    map.set(item.branchId, arr);
  }
  return map;
}

async function loadRaw(): Promise<RawData> {
  const db = getAdminFirestore();
  const [
    branchesSnap,
    laptopsSnap,
    sticksSnap,
    rentalsSnap,
    branchIncomeSnap,
    fixedSnap,
    variableSnap,
    routesSnap,
    ahIncomeSnap,
    ahExpensesSnap,
    ratesData,
    adAreas,
  ] = await Promise.all([
    db.collection("n_branches").get(),
    db.collection("n_laptops").get(),
    db.collection("n_sticks").get(),
    db.collection("n_rentals").get(),
    db.collection("n_branch_income").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    db.collection("n_collection_routes").get(),
    db.collection("n_ah_income").get(),
    db.collection("n_ah_expenses").get(),
    loadCostRates(),
    loadAdAreas(),
  ]);

  const doc = <T>(d: QueryDocumentSnapshot) => ({ ...(d.data() as Omit<T, "id">), id: d.id }) as T;

  const routesById = new Map<string, CollectionRoute>();
  for (const d of routesSnap.docs) routesById.set(d.id, doc<CollectionRoute>(d));

  return {
    branches: branchesSnap.docs.map((d) => doc<Branch>(d)),
    laptopsByBranch: groupBy(laptopsSnap.docs.map((d) => doc<Laptop>(d))),
    sticksByBranch: groupBy(sticksSnap.docs.map((d) => doc<Stick>(d))),
    rentalsByBranch: groupBy(rentalsSnap.docs.map((d) => doc<Rental>(d))),
    branchIncomeByBranch: groupBy(branchIncomeSnap.docs.map((d) => doc<BranchIncome>(d))),
    fixedByBranch: groupBy(fixedSnap.docs.map((d) => doc<FixedExpense>(d))),
    variableByBranch: groupBy(variableSnap.docs.map((d) => doc<VariableExpense>(d))),
    routesById,
    ahIncome: ahIncomeSnap.docs.map((d) => doc<AccountingIncome>(d)),
    ahExpenses: ahExpensesSnap.docs.map((d) => doc<AccountingExpense>(d)),
    rates: ratesData.rates,
    usingDefaultRates: ratesData.usingDefaults,
    settings: ratesData.settingsByBranchRate,
    adAreas,
  };
}

/* ------------------------------------------------------------------ *
 * Book 1 - the owner's own ledger ("שלי")
 * ------------------------------------------------------------------ */

const monthOf = (row: { month?: string; date?: string }) => row.month || (row.date ?? "").slice(0, 7);

function buildMyLedger(
  months: string[],
  income: AccountingIncome[],
  expenses: AccountingExpense[],
): Map<string, MyMonth> {
  const map = new Map<string, MyMonth>();
  for (const m of months) {
    map.set(m, { month: m, income: [], expenses: [], incomeTotal: 0, expenseTotal: 0, profit: 0 });
  }
  for (const i of income) {
    const bucket = map.get(monthOf(i));
    if (!bucket) continue;
    bucket.income.push({
      id: i.id,
      date: i.date,
      label: i.category || i.desc || "הכנסה",
      category: i.category,
      amount: i.amount || 0,
    });
    bucket.incomeTotal += i.amount || 0;
  }
  for (const e of expenses) {
    const bucket = map.get(monthOf(e));
    if (!bucket) continue;
    bucket.expenses.push({
      id: e.id,
      date: e.date,
      label: e.category || e.desc || "הוצאה",
      category: e.category,
      amount: e.amount || 0,
    });
    bucket.expenseTotal += e.amount || 0;
  }
  for (const bucket of map.values()) {
    bucket.profit = bucket.incomeTotal - bucket.expenseTotal;
    bucket.income.sort((a, b) => b.amount - a.amount);
    bucket.expenses.sort((a, b) => b.amount - a.amount);
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * Book 2 - a branch's own operating book
 * ------------------------------------------------------------------ */

/** First month the branch has any life in it - so a monthly rate isn't billed before it opened. */
function branchStartMonth(b: Branch, raw: RawData): string | null {
  if (b.founded) return b.founded.slice(0, 7);
  const candidates: string[] = [];
  for (const r of raw.rentalsByBranch.get(b.id) ?? []) {
    if (r.returnDate) candidates.push(r.returnDate.slice(0, 7));
  }
  for (const i of raw.branchIncomeByBranch.get(b.id) ?? []) candidates.push(monthOf(i));
  for (const e of raw.fixedByBranch.get(b.id) ?? []) if (e.startDate) candidates.push(e.startDate.slice(0, 7));
  for (const e of raw.variableByBranch.get(b.id) ?? []) candidates.push(monthOf(e));
  const valid = candidates.filter((m) => /^\d{4}-\d{2}$/.test(m)).sort();
  return valid[0] ?? null;
}

function branchIncomeLines(b: Branch, raw: RawData, month: string): RentalIncomeLine[] {
  const lines: RentalIncomeLine[] = [];
  if (b.branchType === "rentals") {
    for (const r of raw.rentalsByBranch.get(b.id) ?? []) {
      // same rule as lib/branch-accounting-data.ts: only money actually collected counts
      if (r.status !== "returned" || !r.returnDate || !r.paid) continue;
      if (r.returnDate.slice(0, 7) !== month) continue;
      const route = r.collectionRouteId ? raw.routesById.get(r.collectionRouteId) ?? null : null;
      lines.push({
        amount: r.finalPrice ?? r.calcPrice ?? 0,
        collectedByOwner: isCollectedByOwner(r.paymentMethod, route),
      });
    }
  }
  for (const i of raw.branchIncomeByBranch.get(b.id) ?? []) {
    if (monthOf(i) !== month) continue;
    lines.push({ amount: i.amount || 0, collectedByOwner: i.collectedByOwner ?? false });
  }
  return lines;
}

/** Text of every hand-entered expense of this branch in this month, for duplicate detection. */
function manualExpenseTexts(b: Branch, raw: RawData, month: string): string[] {
  const texts: string[] = [];
  for (const e of raw.fixedByBranch.get(b.id) ?? []) {
    if (!e.startDate || e.startDate.slice(0, 7) > month) continue;
    if (e.endDate && e.endDate.slice(0, 7) < month) continue;
    texts.push(`${e.name ?? ""} ${e.category ?? ""}`);
  }
  for (const e of raw.variableByBranch.get(b.id) ?? []) {
    if (monthOf(e) !== month) continue;
    texts.push(`${e.desc ?? ""} ${e.category ?? ""}`);
  }
  return texts;
}

function resolveQty(
  rate: CostRate,
  b: Branch,
  raw: RawData,
  setting: BranchCostSetting | undefined,
): { qty: number; note: string } {
  if (setting?.qty != null) return { qty: setting.qty, note: "כמות שהוגדרה ידנית לסניף" };
  const laptops = raw.laptopsByBranch.get(b.id) ?? [];
  const sticks = raw.sticksByBranch.get(b.id) ?? [];
  switch (rate.qtySource) {
    case "laptops": {
      // Graphics machines are counted by hand for this branch, and they sit inside the same
      // n_laptops list - so the plain-computer line has to leave them out or the fleet gets
      // charged twice. Bags stay on the full count: a graphics machine gets a bag too.
      const graphics = raw.settings.get(branchCostSettingId(b.id, GRAPHICS_RATE_KEY))?.qty ?? 0;
      if (rate.key === COMPUTER_RATE_KEY && graphics > 0) {
        return {
          qty: Math.max(0, laptops.length - graphics),
          note: `לפי מספר המחשבים בסניף (${laptops.length}) פחות ${graphics} מחשבי גרפיקה`,
        };
      }
      return { qty: laptops.length, note: "לפי מספר המחשבים הרשומים בסניף" };
    }
    case "sticks":
      return { qty: sticks.length, note: "לפי מספר הסטיקים הרשומים בסניף" };
    case "sims": {
      const fromLaptops = laptops.filter((l) => l.simNumber?.trim()).length;
      const fromSticks = sticks.filter((s) => s.sim?.trim()).length;
      return { qty: fromLaptops + fromSticks, note: "לפי מספר הסימים (מחשבים + סטיקים)" };
    }
    case "one":
      return { qty: 1, note: "קבוע לחודש" };
    default:
      return { qty: 0, note: "כמות ידנית - לא הוגדרה" };
  }
}

function resolveRateLine(
  rate: CostRate,
  b: Branch,
  raw: RawData,
  qty: number,
  qtyNote: string,
  kind: "once" | "monthly",
  label: string,
): CostLine | null {
  if (qty <= 0) return null;
  const setting = raw.settings.get(branchCostSettingId(b.id, rate.key));
  if (setting?.enabled === false) return null;
  const unitCost = setting?.unitCost ?? rate.unitCost;
  if (!unitCost) return null;
  const hasPartner = branchHasPartner(b);
  const owedBy: OwedBy = hasPartner ? setting?.owedBy ?? rate.owedBy : "owner";
  const paidBy: PaidBy = hasPartner ? setting?.paidBy ?? "owner" : "owner";
  return makeLine({
    key: rate.key,
    label,
    qty,
    unitCost,
    total: qty * unitCost,
    owedBy,
    paidBy,
    kind,
    source: "rate",
    qtyNote,
  });
}

function computeBranchMonth(b: Branch, raw: RawData, month: string): BranchMonth {
  const hasPartner = branchHasPartner(b);
  const ownerPct = branchOwnerPct(b);
  const lines: CostLine[] = [];
  const suppressed: SuppressedLine[] = [];

  // --- hand-entered branch expenses: always counted, they are the source of truth ---
  for (const e of raw.fixedByBranch.get(b.id) ?? []) {
    if (!e.startDate || e.startDate.slice(0, 7) > month) continue;
    if (e.endDate && e.endDate.slice(0, 7) < month) continue;
    const amount = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
    if (!amount) continue;
    lines.push(
      makeLine({
        key: "fixed",
        label: e.name || "הוצאה קבועה",
        qty: 1,
        unitCost: amount,
        total: amount,
        owedBy: hasPartner ? ((e.owedBy as OwedBy) ?? "owner") : "owner",
        paidBy: hasPartner ? ((e.paidBy as PaidBy) ?? "owner") : "owner",
        kind: "monthly",
        source: "fixed",
        qtyNote: e.category || "הוצאה קבועה שהוזנה ידנית",
      }),
    );
  }
  for (const e of raw.variableByBranch.get(b.id) ?? []) {
    if (monthOf(e) !== month) continue;
    const amount = e.amount || 0;
    if (!amount) continue;
    lines.push(
      makeLine({
        key: "variable",
        label: e.desc || "הוצאה חד פעמית",
        qty: 1,
        unitCost: amount,
        total: amount,
        owedBy: hasPartner ? ((e.owedBy as OwedBy) ?? "owner") : "owner",
        paidBy: hasPartner ? ((e.paidBy as PaidBy) ?? "owner") : "owner",
        kind: "once",
        source: "variable",
        qtyNote: e.category || "הוצאה חד פעמית שהוזנה ידנית",
      }),
    );
  }

  const texts = manualExpenseTexts(b, raw, month);
  const start = branchStartMonth(b, raw);
  const branchOpen = !start || start <= month;

  // --- shared advertising campaign: one campaign for a whole city, split between its branches.
  // It takes the place of the flat per-branch "פרסום" rate, unless the branch already has a
  // hand-entered advertising expense of its own - then that one wins, like any other rate. ---
  const adsRate = raw.rates.find((r) => r.key === ADS_RATE_KEY);
  const area = adAreaForBranch(raw.adAreas, b.id, month);
  const manualAds = adsRate ? texts.some((t) => expenseCoversRate(t, adsRate)) : false;
  const adsFromArea = Boolean(area) && !manualAds && branchOpen;
  if (area && adsFromArea) {
    const split = splitAdArea(area);
    if (split.perBranchLineTotal > 0) {
      lines.push(
        makeLine(
          {
            key: ADS_RATE_KEY,
            label: `פרסום — ${area.name}`,
            qty: 1,
            unitCost: split.perBranchLineTotal,
            total: split.perBranchLineTotal,
            owedBy: hasPartner ? "shared" : "owner",
            paidBy: hasPartner ? area.paidBy ?? "owner" : "owner",
            kind: "monthly",
            source: "area",
            qtyNote: adAreaNote(area, split),
            owedLabel: hasPartner ? `${split.ownerPct}% / ${100 - split.ownerPct}%` : undefined,
          },
          hasPartner ? split.perBranchOwnerShare : split.perBranchLineTotal,
        ),
      );
    }
  }

  // --- price-list lines, but only where nothing hand-entered already covers them ---
  for (const rate of raw.rates) {
    if (adsFromArea && rate.key === ADS_RATE_KEY) {
      suppressed.push({
        rateLabel: rate.label,
        reason: `מחושב לפי אזור הפרסום "${area!.name}" ולא לפי התעריפון`,
      });
      continue;
    }
    const covering = texts.find((t) => expenseCoversRate(t, rate));
    if (covering) {
      suppressed.push({
        rateLabel: rate.label,
        reason: `כבר קיימת הוצאה ידנית בסניף: "${covering.trim()}"`,
      });
      continue;
    }
    if (rate.kind === "monthly") {
      if (!branchOpen) continue;
      const setting = raw.settings.get(branchCostSettingId(b.id, rate.key));
      const { qty, note } = resolveQty(rate, b, raw, setting);
      const line = resolveRateLine(rate, b, raw, qty, note, "monthly", rate.label);
      if (line) lines.push(line);
    } else if (rate.qtySource === "laptops") {
      // one-time equipment only hits a month when a computer was actually added that month
      const added = (raw.laptopsByBranch.get(b.id) ?? []).filter(
        (l) => l.addedDate && l.addedDate.slice(0, 7) === month,
      ).length;
      const line = resolveRateLine(
        rate,
        b,
        raw,
        added,
        "מחשבים שנוספו לסניף החודש",
        "once",
        `${rate.label} (נרכש החודש)`,
      );
      if (line) lines.push(line);
    }
    // "once" rates with no date on the item (sticks) never hit a month - investment table only
  }

  const incomeLines = branchIncomeLines(b, raw, month);
  const income = incomeLines.reduce((s, l) => s + l.amount, 0);
  const expense = lines.reduce((s, l) => s + l.total, 0);
  const ownerExpense = lines.reduce((s, l) => s + l.ownerShare, 0);
  const expenseNet = lines.reduce((s, l) => s + l.netToOwner, 0);
  const ownerIncome = (income * ownerPct) / 100;

  return {
    branchId: b.id,
    month,
    income,
    expense,
    profit: income - expense,
    margin: income ? (income - expense) / income : 0,
    ownerIncome,
    ownerExpense,
    ownerProfit: ownerIncome - ownerExpense,
    expenseNet,
    transferToOwner: hasPartner ? incomeShareToOwner(incomeLines, ownerPct) + expenseNet : 0,
    lines,
    suppressed,
  };
}

/** Cumulative one-time equipment cost of a branch, independent of any month. */
function computeInvestment(b: Branch, raw: RawData): CostLine[] {
  const out: CostLine[] = [];
  for (const rate of raw.rates) {
    if (rate.kind !== "once") continue;
    const setting = raw.settings.get(branchCostSettingId(b.id, rate.key));
    const { qty, note } = resolveQty(rate, b, raw, setting);
    const line = resolveRateLine(rate, b, raw, qty, note, "once", rate.label);
    if (line) out.push(line);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Public entry point
 * ------------------------------------------------------------------ */

export async function loadAccountingOverview(endMonth: string, monthCount = 12): Promise<OverviewData> {
  const raw = await loadRaw();
  const months = monthsEndingAt(endMonth, monthCount);

  const branches = raw.branches
    .filter((b) => !b.deleted && (b.branchType === "rentals" || b.branchType === "computers"))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const myByMonth = buildMyLedger(months, raw.ahIncome, raw.ahExpenses);

  const branchMonths = new Map<string, BranchMonth>();
  for (const b of branches) {
    for (const m of months) {
      branchMonths.set(key(b.id, m), computeBranchMonth(b, raw, m));
    }
  }

  const investmentByBranch = new Map<string, CostLine[]>();
  const autoQtyByBranch = new Map<string, Map<string, number>>();
  for (const b of branches) {
    investmentByBranch.set(b.id, computeInvestment(b, raw));
    const perRate = new Map<string, number>();
    // deliberately passing no setting: this is the derived value the override would replace
    for (const rate of raw.rates) perRate.set(rate.key, resolveQty(rate, b, raw, undefined).qty);
    autoQtyByBranch.set(b.id, perRate);
  }

  const rows: OverviewMonthRow[] = months.map((m) => {
    const my = myByMonth.get(m)!;
    const rentals = emptyBucket();
    const rooms = emptyBucket();
    let transferToOwner = 0;
    for (const b of branches) {
      const s = branchMonths.get(key(b.id, m))!;
      const bucket = b.branchType === "rentals" ? rentals : rooms;
      bucket.income += s.income;
      bucket.expense += s.expense;
      transferToOwner += s.transferToOwner;
    }
    rentals.profit = rentals.income - rentals.expense;
    rooms.profit = rooms.income - rooms.expense;
    return {
      month: m,
      mine: { income: my.incomeTotal, expense: my.expenseTotal, profit: my.profit },
      rentals,
      rooms,
      branches: {
        income: rentals.income + rooms.income,
        expense: rentals.expense + rooms.expense,
        profit: rentals.profit + rooms.profit,
      },
      transferToOwner,
    };
  });

  return {
    months,
    branches,
    rates: raw.rates,
    usingDefaultRates: raw.usingDefaultRates,
    adAreas: raw.adAreas,
    myByMonth,
    branchMonths,
    investmentByBranch,
    autoQtyByBranch,
    rows,
  };
}

export function branchMonthOf(data: OverviewData, branchId: string, month: string): BranchMonth | undefined {
  return data.branchMonths.get(key(branchId, month));
}

/** Every month a branch has a row for, oldest first (used by the per-branch report). */
export function branchSeries(data: OverviewData, branchId: string): BranchMonth[] {
  return data.months
    .map((m) => data.branchMonths.get(key(branchId, m)))
    .filter((s): s is BranchMonth => Boolean(s));
}
