/**
 * שכבה 2 — נכסים. The layer the accounting model was missing.
 *
 * The founding rule this module exists to enforce (פרק ב׳):
 *   רכישה היא לא הוצאה. היא המרה של כסף לנכס.
 *
 * When 15,000 ₪ leaves the account for 20 units, the business is not 15,000 ₪ poorer - it holds
 * 20 units worth 15,000 ₪. So a purchase records ONE capital transaction (שכבה 1) and creates
 * the items (שכבה 2), and nothing else. Sending 8 of those items to a branch records no money
 * at all: the cost travels with the items. That is why all three questions can be true at once
 * with no double counting:
 *
 *   כמה יצא לי מהחשבון?     15,000 ₪   (שכבה 1)
 *   כמה הושקע ברמות?         9,600 ₪   (שכבה 2 — סכום עלויות הפריטים שנמצאים שם)
 *   כמה נכנס לרווחיות רמות?      0 ₪   (שכבה 3 — ציוד לעולם לא נכנס לספר התפעולי, כלל 7)
 *
 * Pure module on purpose (no firebase-admin import): the purchase form and the shipment screen
 * are client components and import the split/label helpers straight from here. Loading the
 * collections lives in ./assets-data.ts - same split as cost-rates.ts / cost-rates-data.ts.
 */
import type { Item, ItemKind, ItemLocation, ItemMoveReason, Purchase, PurchaseLine } from "@ultranet/shared-types";

export const PURCHASES_COLLECTION = "n_purchases";
export const ITEMS_COLLECTION = "n_items";
export const ITEM_MOVES_COLLECTION = "n_item_moves";

/**
 * The warehouse is a first-class location, not a missing value (כלל 4). Because equipment can
 * legitimately sit un-shipped, the balance always closes:
 *   Σ עלות פריטים בסניפים + מחסן  ===  Σ הרכש ההוני
 * An item with no location at all would break that sum silently; the integrity screen looks for
 * exactly that case.
 */
export const WAREHOUSE_LOCATION = "warehouse";
export const WAREHOUSE_LABEL = "מחסן מרכזי";

/**
 * Where a unit goes when it leaves the business (פרק יג׳). A terminal location, never a real
 * place - but a location all the same, so that כלל 5 ("an item is in exactly one place") still
 * holds after the exit, and the item's move history ends with a row saying where it went.
 */
export const SOLD_LOCATION = "sold";
export const SOLD_LABEL = "יצא מהעסק";

export const ITEM_KINDS: ItemKind[] = ["laptop", "stick", "bag", "sim", "other"];

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  laptop: "מחשב נייד",
  stick: "סטיק אינטרנט",
  bag: "תיק",
  sim: "כרטיס סים",
  other: "ציוד אחר",
};

export const ITEM_STATUS_LABEL: Record<Item["status"], string> = {
  active: "תקין ופעיל",
  repair: "בתיקון",
  sold: "נמכר",
  writeoff: "נגרט",
  lost: "אבד / נגנב",
};

/** The three ways a unit leaves the business. All are the same act with a different reason. */
export const EXIT_STATUSES: Item["status"][] = ["sold", "writeoff", "lost"];

export const EXIT_REASON_LABEL: Record<"sold" | "writeoff" | "lost", string> = {
  sold: "מכירה",
  writeoff: "גריטה / הוצאה משימוש",
  lost: "אבדן / גניבה",
};

export function itemHasExited(item: Pick<Item, "status">): boolean {
  return EXIT_STATUSES.includes(item.status);
}

export const ITEM_MOVE_REASON_LABEL: Record<ItemMoveReason, string> = {
  allocation: "משלוח לסניף",
  return: "החזרה למחסן",
  transfer: "העברה בין סניפים",
  repair: "יצא לתיקון",
  writeoff: "הוצאה משימוש",
  sale: "נמכר",
  branch_closed: "חזרה למחסן בסגירת סניף",
  initial: "רישום ראשוני",
};

/**
 * Items that still represent money the business holds. A sold or lost unit stops counting as
 * investment in the branch it sat in - it is no longer there - but its purchase transaction
 * stays in שכבה 1 forever, because that money really did leave the account.
 */
export function itemCountsAsHeld(item: Pick<Item, "status">): boolean {
  return !itemHasExited(item);
}

export function locationLabel(location: ItemLocation, branchNames: Map<string, string>): string {
  if (location === WAREHOUSE_LOCATION) return WAREHOUSE_LABEL;
  if (location === SOLD_LOCATION) return SOLD_LABEL;
  if (!location) return "רכישה";
  return branchNames.get(location) ?? "מיקום לא ידוע";
}

export function itemLabel(item: Pick<Item, "kind" | "label">): string {
  return item.label?.trim() || ITEM_KIND_LABEL[item.kind];
}

/* ------------------------------------------------------------------ *
 * The purchase invariant
 * ------------------------------------------------------------------ */

export function lineTotal(line: Pick<PurchaseLine, "qty" | "unitCost">): number {
  return Math.max(0, Math.round(line.qty) || 0) * Math.max(0, line.unitCost || 0);
}

export function purchaseLinesTotal(lines: Pick<PurchaseLine, "qty" | "unitCost">[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0);
}

export function purchaseUnitCount(lines: Pick<PurchaseLine, "qty">[]): number {
  return lines.reduce((sum, l) => sum + Math.max(0, Math.round(l.qty) || 0), 0);
}

/** Units one invoice may create in a single atomic write. See validatePurchase. */
export const MAX_UNITS_PER_PURCHASE = 240;

export interface PurchaseValidation {
  ok: boolean;
  linesTotal: number;
  unitCount: number;
  /** Hebrew reason the purchase can't be saved, when `ok` is false */
  error?: string;
}

/**
 * The one check that replaces every "mirror"/suppression mechanism the old model needed:
 * the sum of the item costs must equal the invoice total, to the shekel. If it does, then after
 * shipping, branches + warehouse necessarily add back up to what left the account - there is
 * no arithmetic left for a second entry to disagree with.
 */
export function validatePurchase(
  total: number,
  lines: Pick<PurchaseLine, "qty" | "unitCost">[],
): PurchaseValidation {
  const linesTotal = purchaseLinesTotal(lines);
  const unitCount = purchaseUnitCount(lines);
  const base = { linesTotal, unitCount };

  if (lines.length === 0) return { ...base, ok: false, error: "נא להזין לפחות שורה אחת לחשבונית" };
  if (unitCount === 0) return { ...base, ok: false, error: "נא להזין כמות לפחות בשורה אחת" };
  // A purchase is written as one atomic batch (invoice + transaction + two writes per unit), and
  // a Firestore batch holds 500. Splitting a real invoice into two saves is the honest way past
  // that, and keeps the "one invoice, one transaction" guarantee intact.
  if (unitCount > MAX_UNITS_PER_PURCHASE) {
    return {
      ...base,
      ok: false,
      error: `חשבונית אחת יכולה להכיל עד ${MAX_UNITS_PER_PURCHASE} יחידות (הוזנו ${unitCount}). נא לפצל אותה לשתי רכישות.`,
    };
  }
  if (!Number.isFinite(total) || total <= 0) {
    return { ...base, ok: false, error: "נא להזין את סכום החשבונית" };
  }
  if (Math.abs(linesTotal - total) > 0.5) {
    return {
      ...base,
      ok: false,
      error: `סכום השורות (${Math.round(linesTotal).toLocaleString("he-IL")} ₪) לא שווה לסכום החשבונית (${Math.round(
        total,
      ).toLocaleString("he-IL")} ₪)`,
    };
  }
  return { ...base, ok: true };
}

/**
 * Expands the invoice lines into the individual units to be created, one object per physical
 * item. Each carries its OWN unit cost - that per-unit number is the single field that makes
 * real per-branch investment possible, and the reason the flat price-list estimate can retire.
 */
export function itemsFromPurchaseLines(
  lines: PurchaseLine[],
  meta: { purchaseId: string; acquiredAt: string; location?: ItemLocation },
): Omit<Item, "id">[] {
  const out: Omit<Item, "id">[] = [];
  for (const line of lines) {
    const qty = Math.max(0, Math.round(line.qty) || 0);
    for (let i = 0; i < qty; i++) {
      const item: Omit<Item, "id"> = {
        kind: line.kind,
        unitCost: line.unitCost,
        purchaseId: meta.purchaseId,
        acquiredAt: meta.acquiredAt,
        // Every unit starts in the warehouse: it exists and it cost money before anyone decided
        // where it goes, and "nowhere" is not a location the balance can survive (כלל 5).
        location: meta.location ?? WAREHOUSE_LOCATION,
        status: "active",
      };
      if (line.label?.trim()) item.label = line.label.trim();
      out.push(item);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Investment per location
 * ------------------------------------------------------------------ */

export interface LocationInvestment {
  location: ItemLocation;
  /** Σ unitCost of the items currently held here */
  total: number;
  itemCount: number;
  /** how many units of each kind sit here - what a partner may see, without the values */
  countByKind: Record<ItemKind, number>;
  /** Σ unitCost per kind - owner-only */
  totalByKind: Record<ItemKind, number>;
}

function emptyKindMap<T extends number>(value: T): Record<ItemKind, T> {
  return { laptop: value, stick: value, bag: value, sim: value, other: value };
}

export function emptyInvestment(location: ItemLocation): LocationInvestment {
  return {
    location,
    total: 0,
    itemCount: 0,
    countByKind: emptyKindMap(0),
    totalByKind: emptyKindMap(0),
  };
}

/**
 * Investment by location, straight from where the items actually are.
 *
 * No dates, no depreciation, no allocation keys: an item is in exactly one place, so summing its
 * cost into that place cannot count it twice, and cannot miss it either.
 */
export function investmentByLocation(items: Item[]): Map<ItemLocation, LocationInvestment> {
  const map = new Map<ItemLocation, LocationInvestment>();
  for (const item of items) {
    if (!itemCountsAsHeld(item)) continue;
    const location = item.location || WAREHOUSE_LOCATION;
    const bucket = map.get(location) ?? emptyInvestment(location);
    const cost = item.unitCost || 0;
    bucket.total += cost;
    bucket.itemCount += 1;
    bucket.countByKind[item.kind] += 1;
    bucket.totalByKind[item.kind] += cost;
    map.set(location, bucket);
  }
  return map;
}

/** Σ of everything ever bought, held or not - the capital side of the memo line in פרק י״ג. */
export function totalPurchased(purchases: Purchase[]): number {
  return purchases.reduce((sum, p) => sum + (p.total || 0), 0);
}

/* ------------------------------------------------------------------ *
 * החזר השקעה — the number the old model could not produce
 * ------------------------------------------------------------------ */

export interface PaybackStatus {
  invested: number;
  /** the owner's cumulative share of the branch's operating profit */
  returned: number;
  /** 0-1+; 1 means the branch has paid for its own equipment */
  ratio: number;
  /** what is still outstanding; 0 once the branch has paid itself back */
  remaining: number;
  /**
   * THE headline number (פרק טו׳). Months to break even at the current rate; null when it never
   * will at this rate, 0 once it already has.
   *
   * The percentage is deliberately demoted to a supporting figure, because it is a ratio of two
   * numbers that both move: adding two computers to a branch drops it from 32% to 23% overnight
   * without anything bad having happened. Months-to-break-even is derived from the actual monthly
   * rate and says something true - "this branch needs another 7 months" - in a way the reader
   * cannot misread as decline.
   */
  monthsToBreakEven: number | null;
  /** the monthly rate the forecast was computed from, so a screen can show its basis */
  monthlyRate: number;
  /**
   * true when capital was added too recently for the monthly rate to reflect it yet. The forecast
   * is shown as "טרם התייצב": the equipment is already in the denominator, but the months it has
   * to earn in are not yet in the average, so the number would read worse than reality.
   */
  unsettled: boolean;
}

/**
 * Three independent numbers and the ratio between them (פרק ז׳): how much was invested (שכבה 2),
 * how much the branch earns (שכבה 3), and how much of the investment has come back.
 *
 * None of them is subtracted from another anywhere in the system - that is exactly what keeps
 * equipment out of the operating book while still being fully visible.
 */
export function paybackStatus(
  invested: number,
  returned: number,
  monthlyRate: number,
  options: { unsettled?: boolean } = {},
): PaybackStatus {
  const inv = Math.max(0, invested);
  const ret = Math.max(0, returned);
  const remaining = Math.max(0, inv - ret);
  return {
    invested: inv,
    returned: ret,
    ratio: inv > 0 ? ret / inv : 0,
    remaining,
    monthsToBreakEven:
      remaining > 0 && monthlyRate > 0 ? Math.ceil(remaining / monthlyRate) : remaining > 0 ? null : 0,
    monthlyRate,
    unsettled: options.unsettled === true,
  };
}

/* ------------------------------------------------------------------ *
 * פרק יג׳ — יציאת פריטים: מכירה, גריטה, אבדן
 * ------------------------------------------------------------------ */

/**
 * The mirror image of a purchase.
 *
 *   רכישה ממירה כסף לנכס. מכירה ממירה נכס לכסף.
 *
 * Same layer, same mechanism, opposite direction - which is why there is no second model to
 * learn here. And the axiom that follows is the same one, restated:
 *
 *   **תמורה ממכירת ציוד היא לא הכנסה. היא החזר הון.**
 *
 * It never enters turnover, never splits with a partner, and never touches any branch's
 * profitability - for exactly the reason the purchase was not an expense.
 */

/**
 * Splits the sale proceeds across the units sold, in proportion to what each one cost.
 *
 * Proportional to cost rather than evenly: selling a 1,500 ₪ laptop together with a 100 ₪ bag
 * for 1,000 ₪ did not realise 500 ₪ on the bag. The result is rounded to whole shekels with the
 * remainder on the first line, the same technique the transaction split uses, so the parts always
 * add back up to the amount actually received.
 */
export function splitSaleProceeds(
  items: Pick<Item, "id" | "unitCost">[],
  proceeds: number,
): Map<string, number> {
  const out = new Map<string, number>();
  if (items.length === 0) return out;

  const total = Math.round(Math.max(0, proceeds));
  const costBase = items.reduce((sum, i) => sum + (i.unitCost || 0), 0);

  // With no cost basis at all (fully written-down units), fall back to an even split - there is
  // nothing to be proportional to.
  const shares = items.map((i) =>
    costBase > 0 ? (total * (i.unitCost || 0)) / costBase : total / items.length,
  );
  const rounded = shares.map((v) => Math.round(v));
  const drift = total - rounded.reduce((a, b) => a + b, 0);
  if (drift !== 0 && rounded.length > 0) rounded[0] = (rounded[0] ?? 0) + drift;

  items.forEach((item, i) => out.set(item.id, rounded[i] ?? 0));
  return out;
}

export interface CapitalResult {
  /** Σ unitCost of the units that left */
  cost: number;
  /** Σ soldPrice of the units that left */
  proceeds: number;
  /** proceeds - cost; negative is a capital loss */
  gain: number;
}

/**
 * Capital gain or loss on the units that have left. A business-wide figure, never a branch one:
 * the equipment is the owner's capital, so what it realised is his result and not the branch's -
 * the branch's book never carried the cost in the first place (כלל 7).
 */
export function capitalResult(items: Item[]): CapitalResult {
  let cost = 0;
  let proceeds = 0;
  for (const item of items) {
    if (!itemHasExited(item)) continue;
    cost += item.unitCost || 0;
    proceeds += item.soldPrice || 0;
  }
  return { cost, proceeds, gain: proceeds - cost };
}

/**
 * How much capital came back OUT of one branch through sales of units that were sitting there.
 *
 * Reads `lastBranchId`, not `location`: once a unit is sold its location is the terminal `sold`
 * sentinel, and without remembering where it came from the proceeds could not be attributed at
 * all. That is the whole reason the field is mandatory.
 */
export function capitalReturnedFromBranch(items: Item[], branchId: string): number {
  return items
    .filter((i) => itemHasExited(i) && i.lastBranchId === branchId)
    .reduce((sum, i) => sum + (i.soldPrice || 0), 0);
}

/* ------------------------------------------------------------------ *
 * פרק טו׳ — כל מספר נכון לתאריך
 * ------------------------------------------------------------------ */

/**
 * האקסיומה השלישית: היסטוריה לא נערכת. מוסיפים לה.
 *
 * Adding computers is a new dated movement, not a correction of the old number. An expense that
 * ended gets an end date, not a deletion. A price that changed opens a new version, it does not
 * overwrite the previous one. A branch that closed gets a closing date and does not disappear.
 *
 * The consequence for this module: investment is NOT a single number. It is a step function, and
 * every screen that shows it for a past month has to replay the moves up to that month rather
 * than reporting today's snapshot. A branch that opened with 5 computers and got 2 more last week
 * did not have 7 computers two months ago, and any conclusion drawn from pretending it did is
 * wrong.
 *
 * MOVES ARE THE SOURCE OF TRUTH FOR LOCATION.
 * `Item.location` is only a cache of the latest move. The moment the two can drift apart, every
 * historical figure in the system becomes a guess - which is why every write of `location` must
 * carry its matching move in the same batch (see moveItems / the sale action), and why the
 * integrity screen checks the two against each other.
 */

/** Last calendar day of a YYYY-MM, as a date string safe for lexicographic comparison. */
export function endOfMonth(month: string): string {
  return `${month}-31`;
}

export interface ItemMoveLike {
  itemId: string;
  from: ItemLocation;
  to: ItemLocation;
  date: string;
}

/**
 * Where each item was at the end of `month`, by replaying its moves up to that date.
 *
 * Returns a map of itemId -> location. An item with no move on or before the date did not exist
 * in the business yet and is simply absent - which is exactly right: it must not count towards
 * any earlier month's investment.
 */
export function locationsAtMonth(moves: ItemMoveLike[], month: string): Map<string, ItemLocation> {
  const cutoff = endOfMonth(month);
  const latest = new Map<string, { date: string; to: ItemLocation }>();
  for (const move of moves) {
    if (!move.date || move.date > cutoff) continue;
    const current = latest.get(move.itemId);
    // `>=` so that several moves on the same day resolve to the last one read, matching the order
    // they were committed in.
    if (!current || move.date >= current.date) latest.set(move.itemId, { date: move.date, to: move.to });
  }
  const out = new Map<string, ItemLocation>();
  for (const [itemId, { to }] of latest) out.set(itemId, to);
  return out;
}

/**
 * Investment in one branch at the end of a given month - the historically correct figure.
 *
 * This is what replaces the "current snapshot" formula: `Σ unitCost where location = branchId`
 * answers only "right now", and using it for a past month silently backdates every computer that
 * has ever been added.
 */
export function investmentAtMonth(
  moves: ItemMoveLike[],
  items: Pick<Item, "id" | "unitCost">[],
  branchId: string,
  month: string,
): number {
  const locations = locationsAtMonth(moves, month);
  let total = 0;
  for (const item of items) {
    if (locations.get(item.id) === branchId) total += item.unitCost || 0;
  }
  return total;
}

export interface InvestmentPoint {
  month: string;
  /** investment held at this branch at the end of the month */
  invested: number;
  /** how much of that arrived during this month - the height of the step */
  added: number;
}

/**
 * The investment step series for a branch, one point per month.
 *
 * The picture this produces is the point of the chapter: investment jumps on the day equipment
 * was entered and stays flat in between, while cumulative profit rises continuously. Storing only
 * today's number makes the earlier months look retroactively as if they already held all of it.
 */
export function investmentSeries(
  moves: ItemMoveLike[],
  items: Pick<Item, "id" | "unitCost">[],
  branchId: string,
  months: string[],
): InvestmentPoint[] {
  // One pass over the moves per month would be O(months × moves); instead the moves are walked
  // once in date order and the branch's holding is carried forward. This runs on every branch
  // page load, and a busy warehouse has a lot of moves.
  const cost = new Map(items.map((i) => [i.id, i.unitCost || 0]));
  const sorted = [...moves].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const atBranch = new Set<string>();

  let cursor = 0;
  let invested = 0;
  let previous: number | null = null;

  return months.map((month) => {
    const cutoff = endOfMonth(month);
    while (cursor < sorted.length && (sorted[cursor]!.date ?? "") <= cutoff) {
      const move = sorted[cursor]!;
      const value = cost.get(move.itemId);
      if (value !== undefined) {
        // Arriving and leaving are both just set membership - which is what makes the balance
        // impossible to drift: an item is in exactly one place (כלל 5).
        if (move.to === branchId && !atBranch.has(move.itemId)) {
          atBranch.add(move.itemId);
          invested += value;
        } else if (move.to !== branchId && atBranch.has(move.itemId)) {
          atBranch.delete(move.itemId);
          invested -= value;
        }
      }
      cursor += 1;
    }
    const added = previous == null ? invested : Math.max(0, invested - previous);
    previous = invested;
    return { month, invested, added };
  });
}

/** The most recent month in which capital was added to this branch, and how much. */
export function lastCapitalAddition(series: InvestmentPoint[]): InvestmentPoint | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const point = series[i];
    if (point && point.added > 0) return point;
  }
  return null;
}
