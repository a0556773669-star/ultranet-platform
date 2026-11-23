import { getAdminFirestore } from "./firebase-admin";
import type { StoreCpuTier, StorePriceGuide, StoreSpec } from "@ultranet/shared-types";
import { accessoryRange, quotedRange, roundTen } from "./store-pricing";

export const PRICE_GUIDE_DOC = { collection: "n_store_settings", id: "price_guide" } as const;

export const EMPTY_GUIDE: StorePriceGuide = { laptopBase: {}, desktopBase: {}, ramAdd: {}, storageAdd: {}, accessoriesLow: {} };

export async function loadPriceGuide(): Promise<StorePriceGuide> {
  const snap = await getAdminFirestore().collection(PRICE_GUIDE_DOC.collection).doc(PRICE_GUIDE_DOC.id).get();
  if (!snap.exists) return EMPTY_GUIDE;
  const d = snap.data() as Partial<StorePriceGuide>;
  return {
    laptopBase: d.laptopBase ?? {},
    desktopBase: d.desktopBase ?? {},
    ramAdd: d.ramAdd ?? {},
    storageAdd: d.storageAdd ?? {},
    touchAdd: d.touchAdd,
    screen17Add: d.screen17Add,
    accessoriesLow: d.accessoriesLow ?? {},
    note: d.note,
    updatedAt: d.updatedAt,
  };
}

/** מחיר שוק נמוך מוערך למחשב (בלי אביזרים), או null כשאין במחירון בסיס לדגם. */
export function estimateMarketLow(spec: StoreSpec, guide: StorePriceGuide): number | null {
  const cpu: StoreCpuTier = spec.cpu ?? "i3";
  const base = (spec.kind === "laptop" ? guide.laptopBase : guide.desktopBase)[cpu];
  if (typeof base !== "number") return null;
  let total = base;
  if (spec.ramGb && spec.ramGb > 8) total += guide.ramAdd[String(spec.ramGb >= 32 ? 32 : 16) as "16" | "32"] ?? 0;
  if (spec.storageGb && spec.storageGb > 256) {
    const key = spec.storageGb >= 2000 ? "2000" : spec.storageGb >= 1000 ? "1000" : "512";
    total += guide.storageAdd[key] ?? 0;
  }
  if (spec.kind === "laptop") {
    if (spec.touch) total += guide.touchAdd ?? 0;
    if (spec.screenInches && spec.screenInches >= 17) total += guide.screen17Add ?? 0;
  }
  return total;
}

const ACCESSORY_KEYS: Record<string, string> = {
  מסך: "monitor",
  "מקלדת ועכבר": "keyboardMouse",
  מקלדת: "keyboard",
  עכבר: "mouse",
  סטיק: "stick",
  רמקולים: "speakers",
};

export type PriceEstimate = {
  fromILS: number;
  toILS: number;
  accessories: { name: string; fromILS: number; toILS: number }[];
};

/**
 * טווח הערכה לפי המחירון: מחיר שוק נמוך + מרווח (מחשב 300-500, אביזר לפי סוגו). null כשאין במחירון בסיס
 * לדגם - אז אין הערכה והצ'אט אומר שהמחיר יימסר אחרי בדיקה.
 */
export function estimateRange(spec: StoreSpec, guide: StorePriceGuide): PriceEstimate | null {
  const low = estimateMarketLow(spec, guide);
  if (low === null) return null;
  const r = quotedRange(low);
  const names = spec.extras?.length
    ? spec.extras.includes("מקלדת") && spec.extras.includes("עכבר")
      ? ["מקלדת ועכבר", ...spec.extras.filter((e) => e !== "מקלדת" && e !== "עכבר")]
      : spec.extras
    : [];
  const accessories: PriceEstimate["accessories"] = [];
  for (const name of names) {
    const accLow = guide.accessoriesLow[ACCESSORY_KEYS[name] ?? ""];
    if (typeof accLow !== "number") continue;
    const a = accessoryRange(name, accLow);
    accessories.push({ name, fromILS: roundTen(a.from), toILS: roundTen(a.to) });
  }
  return { fromILS: roundTen(r.from), toILS: roundTen(r.to), accessories };
}

/** תיאור קצר של המחירון למודל (מחירי שוק נמוכים בלבד, בלי מרווח) - כדי שיכבד תקציב לקוח בהצעות. */
export function guideForPrompt(guide: StorePriceGuide): string {
  const fmt = (o: Partial<Record<string, number>>) =>
    Object.entries(o)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") || "לא הוגדר";
  return `נייד (בסיס 8GB/256GB/15.6): ${fmt(guide.laptopBase)}
נייח (מחשב בלבד): ${fmt(guide.desktopBase)}
תוספת זיכרון: ${fmt(guide.ramAdd)} · תוספת אחסון: ${fmt(guide.storageAdd)} · מגע: ${guide.touchAdd ?? "לא הוגדר"}
(מחירי שוק נמוכים בשקלים. הלקוח מקבל טווח הערכה גבוה יותר - אל תציין מחירים בטקסט, המערכת מציגה אותם.)`;
}
