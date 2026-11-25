import type { StoreCommissionCategory, StoreCommissionRule, StoreRequest } from "@ultranet/shared-types";

/**
 * עמלת סניף על עסקת חנות. הבעלים מגדיר לכל קטגוריית מוצר (`laptop`/`desktop`/`accessory`) סכום קבוע
 * או אחוז מהמחיר הסופי. העמלה נקבעת **בסגירת העסקה** ונשמרת על הבקשה (`commissionILS`), כך שעדכון
 * מאוחר של הכללים לא משנה עסקאות שכבר נסגרו.
 *
 * כלל ההתחשבנות (ראו `lib/branch-accounting-data.ts`): סניף שגבה את הכסף חייב לבעלים את הסכום שגבה,
 * פחות העמלה. עסקה שהבעלים גבה בעצמו לא מזכה בעמלה.
 */
/**
 * ברירות המחדל של העסקה (מהבעלים): 150 ₪ לכל מחשב, נייד או נייח, ו-20 ₪ לכל אביזר נוסף
 * (סטיק, מקלדת, עכבר, מסך). הן חלות על כל קטגוריה שאין לה כלל שמור ב-`n_store_commission_rules`;
 * כלל עם ערך 0 = בכוונה בלי עמלה. ובכל עסקה בנפרד הבעלים רשאי לעדכן (`commissionOverrideILS`).
 */
export const DEFAULT_COMMISSION_RULES: Record<StoreCommissionCategory, StoreCommissionRule> = {
  laptop: { id: "laptop", kind: "fixed", value: 150 },
  desktop: { id: "desktop", kind: "fixed", value: 150 },
  accessory: { id: "accessory", kind: "fixed", value: 20 },
};

/** כמה אביזרים בעסקה. "מקלדת ועכבר" שמתומחרים יחד נספרים כשניים. */
export function accessoryCount(names: string[] | undefined): number {
  return (names ?? [])
    .filter((name) => !name.startsWith("תיק")) // תיק נמכר בלי רווח - אין עליו עמלה
    .reduce((n, name) => n + (name.includes("מקלדת") && name.includes("עכבר") ? 2 : 1), 0);
}

export function commissionFor(
  rule: Pick<StoreCommissionRule, "kind" | "value"> | undefined,
  priceILS: number,
  units = 1,
): number {
  if (!rule || !(rule.value > 0)) return 0;
  if (rule.kind === "percent") return priceILS > 0 ? Math.round((priceILS * rule.value) / 100) : 0;
  return Math.round(rule.value * units);
}

export function computeDealCommission(
  request: Pick<StoreRequest, "spec" | "finalPriceILS" | "accessoriesFinalILS" | "accessories" | "commissionOverrideILS">,
  rules: Map<StoreCommissionCategory, StoreCommissionRule>,
): number {
  if (typeof request.commissionOverrideILS === "number") return request.commissionOverrideILS;
  const category: StoreCommissionCategory = request.spec.kind === "desktop" ? "desktop" : "laptop";
  const rule = (c: StoreCommissionCategory) => rules.get(c) ?? DEFAULT_COMMISSION_RULES[c];
  return (
    commissionFor(rule(category), request.finalPriceILS ?? 0) +
    commissionFor(rule("accessory"), request.accessoriesFinalILS ?? 0, accessoryCount(request.accessories?.map((a) => a.name)))
  );
}

export const COMMISSION_CATEGORY_LABEL: Record<StoreCommissionCategory, string> = {
  laptop: "מחשב נייד",
  desktop: "מחשב נייח",
  accessory: "אביזר נוסף (סטיק, מקלדת, עכבר, מסך) - לכל אביזר",
};

/**
 * מה נכנס להתחשבנות של הסניף מול הבעלים:
 * - הסניף גבה (`by: "branch"`): הסכום שגבה נכנס במלואו, והעמלה מופחתת ממנו.
 * - שולם אונליין לחשבון הבעלים (`by: "owner"` + `commissionToBranch`): לא נכנס סכום (הכסף כבר אצל הבעלים), והעמלה נזקפת
 *   לטובת הסניף - הבעלים חייב לו אותה (ההתחשבנות יורדת בעמלה).
 * - הבעלים גבה בעצמו בלי אונליין: אין עמלה ואין השפעה.
 */
export function dealSettlement(request: Pick<StoreRequest, "collection" | "commissionILS">) {
  const c = request.collection;
  if (c?.by === "branch") return { collected: c.amountILS || 0, commission: request.commissionILS ?? 0, month: c.month };
  if (c?.by === "owner" && c.commissionToBranch) return { collected: 0, commission: request.commissionILS ?? 0, month: c.month };
  return { collected: 0, commission: 0, month: "" };
}
