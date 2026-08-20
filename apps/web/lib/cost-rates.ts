/**
 * The price list ("תעריפון") behind the per-branch operating-cost breakdown on
 * /dashboard/accounting/overview: what one computer / bag / stick / SIM / ad / printing run
 * costs, and who the cost falls on by default (owner / partner / 50-50).
 *
 * Reads n_cost_rates. When that collection is still empty the DEFAULTS below are returned
 * in-memory instead - a page render must never write to Firestore, so seeding is an explicit
 * owner action on /dashboard/accounting/rates ("שמירת התעריפון").
 */
import { getAdminFirestore } from "./firebase-admin";
import type { CostRate, BranchCostSetting } from "@ultranet/shared-types";

export const COST_RATES_COLLECTION = "n_cost_rates";
export const BRANCH_COST_SETTINGS_COLLECTION = "n_branch_cost_settings";

/** Deterministic doc id so saving a branch override is always an upsert, never a duplicate. */
export function branchCostSettingId(branchId: string, rateKey: string): string {
  return `${branchId}__${rateKey}`;
}

export const DEFAULT_COST_RATES: Omit<CostRate, "id">[] = [
  { key: "computer", label: "מחשב", unitCost: 1200, kind: "once", owedBy: "owner", qtySource: "laptops", order: 1 },
  { key: "bag", label: "תיק למחשב", unitCost: 50, kind: "once", owedBy: "owner", qtySource: "laptops", order: 2 },
  { key: "stick", label: "סטיק", unitCost: 120, kind: "once", owedBy: "owner", qtySource: "sticks", order: 3 },
  { key: "sim", label: "סינון וגלישה", unitCost: 70, kind: "monthly", owedBy: "shared", qtySource: "sims", order: 4 },
  { key: "ads", label: "פרסום", unitCost: 600, kind: "monthly", owedBy: "shared", qtySource: "one", order: 5 },
  { key: "print", label: "הדפסות (החתמה על תקנון)", unitCost: 20, kind: "monthly", owedBy: "owner", qtySource: "one", order: 6 },
];

/**
 * Words that mark an existing manual branch expense as "the same thing" as a rate category.
 * Used to suppress the rate line for that branch/month so a cost the owner already typed by
 * hand (n_fixed_expenses / n_var_expenses) is never counted a second time from the price list.
 * Falls back to the rate's own label for custom rates with no entry here.
 */
const MATCH_TOKENS: Record<string, string[]> = {
  computer: ["מחשב", "לפטופ", "נייד"],
  bag: ["תיק"],
  stick: ["סטיק", "סטיקים"],
  sim: ["סינון", "גלישה", "סים", "אינטרנט סלולרי"],
  ads: ["פרסום", "פרסומת", "שיווק", "מודעה"],
  print: ["הדפס", "תקנון", "צילומים"],
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

export async function loadCostRates(): Promise<CostRatesData> {
  const db = getAdminFirestore();
  const [ratesSnap, settingsSnap] = await Promise.all([
    db.collection(COST_RATES_COLLECTION).get(),
    db.collection(BRANCH_COST_SETTINGS_COLLECTION).get(),
  ]);

  const stored = ratesSnap.docs.map((d) => ({ ...(d.data() as Omit<CostRate, "id">), id: d.id }) as CostRate);
  const usingDefaults = stored.length === 0;
  const rates = (usingDefaults
    ? DEFAULT_COST_RATES.map((r) => ({ ...r, id: r.key }) as CostRate)
    : stored
  ).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  const settingsByBranchRate = new Map<string, BranchCostSetting>();
  for (const d of settingsSnap.docs) {
    const s = { ...(d.data() as Omit<BranchCostSetting, "id">), id: d.id } as BranchCostSetting;
    settingsByBranchRate.set(branchCostSettingId(s.branchId, s.rateKey), s);
  }

  return { rates, usingDefaults, settingsByBranchRate };
}
