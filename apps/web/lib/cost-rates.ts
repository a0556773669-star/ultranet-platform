/**
 * The price list ("תעריפון") behind the per-branch operating-cost breakdown on
 * /dashboard/accounting/overview: what one computer / bag / stick / SIM costs, and who the cost
 * falls on by default (owner / partner / 50-50). Only costs with a stable unit price live here -
 * anything that is a different amount every month is typed per branch (see RETIRED_RATE_KEYS).
 *
 * Pure module on purpose (no firebase-admin import): the branch cost-settings editor is a client
 * component and imports branchCostSettingId() straight from here. Loading n_cost_rates lives in
 * lib/cost-rates-data.ts - same split as ad-areas.ts / ad-areas-data.ts and
 * branch-accounting.ts / branch-accounting-data.ts. Pulling firebase-admin in here dragged it
 * into the client bundle and broke `next build` with "Can't resolve 'http2'/'fs'".
 */
import type { CostRate, BranchCostSetting } from "@ultranet/shared-types";

export const COST_RATES_COLLECTION = "n_cost_rates";
export const BRANCH_COST_SETTINGS_COLLECTION = "n_branch_cost_settings";

/** Deterministic doc id so saving a branch override is always an upsert, never a duplicate. */
export function branchCostSettingId(branchId: string, rateKey: string): string {
  return `${branchId}__${rateKey}`;
}

/** the plain-computer rate; its quantity is the branch's laptops MINUS the graphics ones */
export const COMPUTER_RATE_KEY = "computer";
/** graphics computers are counted per branch by hand (n_branch_cost_settings.qty) - nothing in
 *  n_laptops marks a computer as a graphics machine, so there's nothing to derive it from */
export const GRAPHICS_RATE_KEY = "computer_graphics";

export const DEFAULT_COST_RATES: Omit<CostRate, "id">[] = [
  { key: COMPUTER_RATE_KEY, label: "מחשב רגיל", unitCost: 1200, kind: "once", owedBy: "owner", qtySource: "laptops", order: 1 },
  { key: GRAPHICS_RATE_KEY, label: "מחשב גרפיקה", unitCost: 0, kind: "once", owedBy: "owner", qtySource: "manual", order: 2 },
  { key: "bag", label: "תיק למחשב", unitCost: 50, kind: "once", owedBy: "owner", qtySource: "laptops", order: 3 },
  { key: "stick", label: "סטיק", unitCost: 120, kind: "once", owedBy: "owner", qtySource: "sticks", order: 4 },
  { key: "sim", label: "סינון וגלישה", unitCost: 70, kind: "monthly", owedBy: "shared", qtySource: "sims", order: 5 },
];

/**
 * Rates that used to sit in the price list and were taken out of it.
 *
 * פרסום and הדפסת התקנון are a different amount every month, so a flat per-branch rate was
 * always either too high or too low. They are now typed by hand per branch and per month, like
 * any other expense (הוצאה קבועה / הוצאה חד-פעמית on the branch screen) - shared advertising
 * across a whole city still has its own screen (/dashboard/accounting/ads).
 *
 * Kept as a filter rather than a migration: a price list saved before this change still holds
 * the two documents in n_cost_rates, and they must stop producing cost lines without anyone
 * having to delete anything.
 */
export const RETIRED_RATE_KEYS = new Set(["ads", "print"]);

/**
 * Words that mark an existing manual branch expense as "the same thing" as a rate category.
 * Used to suppress the rate line for that branch/month so a cost the owner already typed by
 * hand (n_fixed_expenses / n_var_expenses) is never counted a second time from the price list.
 * Falls back to the rate's own label for custom rates with no entry here.
 */
const MATCH_TOKENS: Record<string, string[]> = {
  [GRAPHICS_RATE_KEY]: ["גרפיקה", "גרפי"],
  computer: ["מחשב", "לפטופ", "נייד"],
  bag: ["תיק"],
  stick: ["סטיק", "סטיקים"],
  sim: ["סינון", "גלישה", "סים", "אינטרנט סלולרי"],
  // no longer a price-list rate, but still the words that mark a hand-entered advertising
  // expense - an ad area must not charge a branch that already typed its own פרסום line.
  ads: ["פרסום", "פרסומת", "שיווק", "מודעה"],
};

export function rateMatchTokens(rate: Pick<CostRate, "key" | "label">): string[] {
  return MATCH_TOKENS[rate.key] ?? [rate.label];
}

/** true if a manually-entered expense name/category looks like it already covers this rate. */
export function expenseCoversRate(expenseText: string, rate: Pick<CostRate, "key" | "label">): boolean {
  const text = expenseText.trim();
  if (!text) return false;
  return rateMatchTokens(rate).some((token) => text.includes(token));
}

export interface CostRatesData {
  rates: CostRate[];
  /** true when nothing is stored yet and `rates` are the in-memory defaults */
  usingDefaults: boolean;
  /** key: `${branchId}__${rateKey}` */
  settingsByBranchRate: Map<string, BranchCostSetting>;
}
