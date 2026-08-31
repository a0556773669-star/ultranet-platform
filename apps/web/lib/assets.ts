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
  lost: "אבד",
  sold: "נמכר",
  writtenoff: "הושבת",
};

export const ITEM_MOVE_REASON_LABEL: Record<ItemMoveReason, string> = {
  allocation: "משלוח לסניף",
  return: "החזרה למחסן",
  transfer: "העברה בין סניפים",
  repair: "יצא לתיקון",
  writeoff: "הוצאה משימוש",
  initial: "רישום ראשוני",
};

/**
 * Items that still represent money the business holds. A sold or lost unit stops counting as
 * investment in the branch it sat in - it is no longer there - but its purchase transaction
 * stays in שכבה 1 forever, because that money really did leave the account.
 */
export function itemCountsAsHeld(item: Pick<Item, "status">): boolean {
  return item.status !== "sold" && item.status !== "lost";
}

export function locationLabel(location: ItemLocation, branchNames: Map<string, string>): string {
  if (location === WAREHOUSE_LOCATION) return WAREHOUSE_LABEL;
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
  /** months to break even at the current monthly rate; null when it never will at this rate */
  monthsToBreakEven: number | null;
}

/**
 * Three independent numbers and the ratio between them (פרק ז׳): how much was invested (שכבה 2),
 * how much the branch earns (שכבה 3), and how much of the investment has come back.
 *
 * None of them is subtracted from another anywhere in the system - that is exactly what keeps
 * equipment out of the operating book while still being fully visible.
 */
export function paybackStatus(invested: number, returned: number, monthlyRate: number): PaybackStatus {
  const inv = Math.max(0, invested);
  const ret = Math.max(0, returned);
  const remaining = Math.max(0, inv - ret);
  return {
    invested: inv,
    returned: ret,
    ratio: inv > 0 ? ret / inv : 0,
    remaining,
    monthsToBreakEven: remaining > 0 && monthlyRate > 0 ? Math.ceil(remaining / monthlyRate) : remaining > 0 ? null : 0,
  };
}
