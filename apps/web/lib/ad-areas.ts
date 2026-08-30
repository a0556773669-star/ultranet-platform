/**
 * אזורי פרסום - one advertising campaign shared by several branches in the same city.
 *
 * The rule the whole module implements, in the owner's own words:
 *   קמפיין של 1,200 ₪ לחודש בקרית ספר, שיש בה 3 סניפים ->
 *   הבעלים משלם 50% = 600 ₪, ושלושת הסניפים מתחלקים ב-600 הנותרים = 200 ₪ לכל סניף.
 *
 * In each branch's own operating book that lands as one line worth `monthlyCost / branchCount`
 * (400 ₪ in the example) - the branch's slice of the campaign - of which the owner carries
 * `ownerPct`% (200 ₪) and the branch/partner the rest (200 ₪). Summed over the area's branches
 * that is exactly the campaign again: 3 × 400 = 1,200, of which the owner 3 × 200 = 600.
 *
 * An area is the ONE automatic advertising line a branch can get; the price list no longer holds
 * a flat "פרסום" rate. A branch outside every area (or one that typed its own advertising
 * expense) is charged only what was entered by hand - see lib/accounting-overview.ts.
 *
 * Pure module on purpose (no firebase-admin import): the setup screen's live preview is a client
 * component and imports splitAdArea() straight from here. Loading n_ad_areas lives in
 * lib/ad-areas-data.ts, same split as branch-accounting.ts / branch-accounting-data.ts.
 */
import type { AdArea } from "@ultranet/shared-types";

export const AD_AREAS_COLLECTION = "n_ad_areas";
/** the cost-line key a campaign is charged under */
export const ADS_RATE_KEY = "ads";
/**
 * Advertising is no longer a price-list rate (it is a different amount every month - see
 * RETIRED_RATE_KEYS in lib/cost-rates.ts), so the check "does this branch already have an
 * advertising expense of its own?" runs against this fixed descriptor instead of a stored rate.
 */
export const ADS_RATE_MATCH = { key: ADS_RATE_KEY, label: "פרסום" } as const;
export const DEFAULT_AD_OWNER_PCT = 50;

export interface AdAreaSplit {
  monthlyCost: number;
  ownerPct: number;
  /** how many branches the non-owner part is divided between (never below 1) */
  branchCount: number;
  /** what the owner pays of the whole campaign, every month */
  ownerTotal: number;
  /** what the branches pay together, every month */
  branchesTotal: number;
  /** what ONE branch actually pays out of pocket */
  perBranch: number;
  /** one branch's slice of the campaign as it appears in that branch's book (perBranch + the owner's part of it) */
  perBranchLineTotal: number;
  /** the owner's part inside that one branch line */
  perBranchOwnerShare: number;
}

export type AdAreaInput = Pick<AdArea, "monthlyCost" | "ownerPct" | "branchIds"> &
  Partial<Pick<AdArea, "branchCount">>;

export function adAreaBranchCount(area: AdAreaInput): number {
  const declared = area.branchCount ?? area.branchIds.length;
  return Math.max(1, Math.floor(declared) || 1);
}

export function splitAdArea(area: AdAreaInput): AdAreaSplit {
  const monthlyCost = Math.max(0, area.monthlyCost || 0);
  const ownerPct = Math.min(100, Math.max(0, area.ownerPct ?? DEFAULT_AD_OWNER_PCT));
  const branchCount = adAreaBranchCount(area);
  const ownerTotal = (monthlyCost * ownerPct) / 100;
  const branchesTotal = monthlyCost - ownerTotal;
  return {
    monthlyCost,
    ownerPct,
    branchCount,
    ownerTotal,
    branchesTotal,
    perBranch: branchesTotal / branchCount,
    perBranchLineTotal: monthlyCost / branchCount,
    perBranchOwnerShare: ownerTotal / branchCount,
  };
}

export function adAreaActiveInMonth(area: AdArea, month: string): boolean {
  if (area.startMonth && area.startMonth > month) return false;
  if (area.endMonth && area.endMonth < month) return false;
  return true;
}

/**
 * The area charging this branch in this month. A branch should only ever sit in one area;
 * if it somehow sits in two, the first one wins so the cost is never counted twice.
 */
export function adAreaForBranch(areas: AdArea[], branchId: string, month: string): AdArea | undefined {
  return areas.find((a) => a.branchIds?.includes(branchId) && adAreaActiveInMonth(a, month));
}

/** The one-line explanation shown next to the branch's advertising cost line. */
export function adAreaNote(area: AdArea, split: AdAreaSplit): string {
  return `אזור ${area.name}: ${Math.round(split.monthlyCost)} ₪ לחודש ל-${split.branchCount} סניפים · ${split.ownerPct}% על הבעלים`;
}
