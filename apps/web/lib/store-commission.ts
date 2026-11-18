import type { StoreCommissionCategory, StoreCommissionRule, StoreRequest } from "@ultranet/shared-types";

/**
 * עמלת סניף על עסקת חנות. הבעלים מגדיר לכל קטגוריית מוצר (`laptop`/`desktop`/`accessory`) סכום קבוע
 * או אחוז מהמחיר הסופי. העמלה נקבעת **בסגירת העסקה** ונשמרת על הבקשה (`commissionILS`), כך שעדכון
 * מאוחר של הכללים לא משנה עסקאות שכבר נסגרו.
 *
 * כלל ההתחשבנות (ראו `lib/branch-accounting-data.ts`): סניף שגבה את הכסף חייב לבעלים את הסכום שגבה,
 * פחות העמלה. עסקה שהבעלים גבה בעצמו לא מזכה בעמלה.
 */
export function commissionFor(rule: Pick<StoreCommissionRule, "kind" | "value"> | undefined, priceILS: number): number {
  if (!rule || !(rule.value > 0) || !(priceILS > 0)) return 0;
  return rule.kind === "percent" ? Math.round((priceILS * rule.value) / 100) : Math.round(rule.value);
}

export function computeDealCommission(
  request: Pick<StoreRequest, "spec" | "finalPriceILS" | "accessoriesFinalILS">,
  rules: Map<StoreCommissionCategory, StoreCommissionRule>,
): number {
  const category: StoreCommissionCategory = request.spec.kind === "desktop" ? "desktop" : "laptop";
  return (
    commissionFor(rules.get(category), request.finalPriceILS ?? 0) +
    commissionFor(rules.get("accessory"), request.accessoriesFinalILS ?? 0)
  );
}

export const COMMISSION_CATEGORY_LABEL: Record<StoreCommissionCategory, string> = {
  laptop: "מחשב נייד",
  desktop: "מחשב נייח",
  accessory: "ציוד נלווה (מסך, מקלדת ועכבר...)",
};

/** סך מה שהסניף גבה ומה שהוא צבר בעמלות, לפי חודש - לקריאה מהנה"ח ומסך העמלות. */
export function dealSettlement(request: Pick<StoreRequest, "collection" | "commissionILS">) {
  if (request.collection?.by !== "branch") return { collected: 0, commission: 0, month: "" };
  return {
    collected: request.collection.amountILS || 0,
    commission: request.commissionILS ?? 0,
    month: request.collection.month,
  };
}
