/**
 * Loading the price list ("תעריפון") from Firestore.
 *
 * Split out of lib/cost-rates.ts so that module can stay pure: the branch cost-settings editor
 * (/dashboard/accounting/overview/branch-cost-settings.tsx) is a client component and imports
 * branchCostSettingId() from there, which used to drag firebase-admin into the client bundle
 * and fail `next build` with "Can't resolve 'http2'". Same split as ad-areas.ts /
 * ad-areas-data.ts and branch-accounting.ts / branch-accounting-data.ts.
 *
 * Reads n_cost_rates. When that collection is still empty the DEFAULTS are returned in-memory
 * instead - a page render must never write to Firestore, so seeding is an explicit owner action
 * on /dashboard/accounting/rates ("שמירת התעריפון").
 */
import { getAdminFirestore } from "./firebase-admin";
import type { CostRate, BranchCostSetting } from "@ultranet/shared-types";
import {
  BRANCH_COST_SETTINGS_COLLECTION,
  COST_RATES_COLLECTION,
  DEFAULT_COST_RATES,
  isRetiredRate,
  branchCostSettingId,
  type CostRatesData,
} from "./cost-rates";

export async function loadCostRates(): Promise<CostRatesData> {
  const db = getAdminFirestore();
  const [ratesSnap, settingsSnap] = await Promise.all([
    db.collection(COST_RATES_COLLECTION).get(),
    db.collection(BRANCH_COST_SETTINGS_COLLECTION).get(),
  ]);

  const stored = ratesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<CostRate, "id">), id: d.id }) as CostRate)
    .filter((r) => !isRetiredRate(r));
  // "usingDefaults" asks whether a price list was ever SAVED, so it counts the raw documents -
  // a saved list made entirely of now-retired equipment rates is still a saved list, and warning
  // the owner that nothing was saved would be false.
  const usingDefaults = ratesSnap.empty;
  const rates = (usingDefaults
    ? DEFAULT_COST_RATES.map((r) => ({ ...r, id: r.key }) as CostRate).filter((r) => !isRetiredRate(r))
    : stored
  ).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));

  const settingsByBranchRate = new Map<string, BranchCostSetting>();
  for (const d of settingsSnap.docs) {
    const s = { ...(d.data() as Omit<BranchCostSetting, "id">), id: d.id } as BranchCostSetting;
    settingsByBranchRate.set(branchCostSettingId(s.branchId, s.rateKey), s);
  }

  return { rates, usingDefaults, settingsByBranchRate };
}
