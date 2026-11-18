import { getAdminFirestore } from "./firebase-admin";
import { DEFAULT_COMMISSION_RULES } from "./store-commission";
import type { StoreCommissionCategory, StoreCommissionRule } from "@ultranet/shared-types";

export const COMMISSION_RULES_COLLECTION = "n_store_commission_rules";
export const COMMISSION_CATEGORIES: StoreCommissionCategory[] = ["laptop", "desktop", "accessory"];

export async function loadCommissionRules(): Promise<Map<StoreCommissionCategory, StoreCommissionRule>> {
  const snap = await getAdminFirestore().collection(COMMISSION_RULES_COLLECTION).get();
  const out = new Map<StoreCommissionCategory, StoreCommissionRule>();
  for (const d of snap.docs) {
    const data = d.data() as Partial<StoreCommissionRule>;
    if (!COMMISSION_CATEGORIES.includes(d.id as StoreCommissionCategory)) continue;
    if ((data.kind !== "fixed" && data.kind !== "percent") || typeof data.value !== "number") continue;
    out.set(d.id as StoreCommissionCategory, { id: d.id as StoreCommissionCategory, kind: data.kind, value: data.value });
  }
  return out;
}

/** הכללים בפועל: שמורים, ואחרת ברירת המחדל - לתצוגה במסך העמלות. */
export async function loadEffectiveRules(): Promise<Map<StoreCommissionCategory, StoreCommissionRule>> {
  const saved = await loadCommissionRules();
  const out = new Map<StoreCommissionCategory, StoreCommissionRule>();
  for (const c of COMMISSION_CATEGORIES) out.set(c, saved.get(c) ?? DEFAULT_COMMISSION_RULES[c]);
  return out;
}

/** החודש הנוכחי (YYYY-MM) לפי שעון ישראל - לא UTC, כדי שעסקה בלילה לא תיפול לחודש הלא נכון. */
export function currentIsraelMonth(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" }).slice(0, 7);
}
