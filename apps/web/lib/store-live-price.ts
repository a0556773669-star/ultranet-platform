import { createHash } from "node:crypto";
import type {
  StoreListing,
  StorePriceGuide,
  StoreSpec,
} from "@ultranet/shared-types";
import { getAdminFirestore } from "./firebase-admin";
import { findCheapestListings } from "./store-listings";
import {
  estimateMarketLow,
  estimateRange,
  specKey,
  type PriceEstimate,
} from "./store-price-guide";

/**
 * **אימות מחיר חי** לפני שמציעים ללקוח מחיר. המחירון הלילי הוא חיבור של תוספות (בסיס + זיכרון + אחסון) ויכול
 * לפספס בהרבה (נראה בפועל: הצעה של 3,790 ללקוח מול מחיר שוק אמיתי של 4,140 למחשב בלבד). לכן, לפני שמחיר מוצג,
 * בודקים מודעות אמיתיות לתצורה המדויקת של האפשרות הראשונה (הזולה/המבוקשת), ושאר האפשרויות זזות באותו הפרש.
 *
 * עלות: חיפוש אחד (Haiku + חיפוש ברשת, כ-5-10 אגורות) לתצורה, **שמור 24 שעות** ב-`n_store_live_prices` - אותה תצורה
 * שנשאלת שוב באותו יום היא חינם. מוגבל בזמן (אם החיפוש לא חוזר - ממשיכים עם המחירון).
 */
const COLLECTION = "n_store_live_prices";
const TTL_MS = 24 * 3_600_000;
const SEARCH_TIMEOUT_MS = 32_000;
/** סטייה סבירה בין מחיר חי למחירון: בתוכה סומכים על המחיר החי. מחוצה לה - לוקחים את הגבוה (לא להציע מתחת לשוק) ומסמנים "לא ודאי". */
const TRUST_RATIO: [number, number] = [0.75, 1.35];

const docId = (key: string) => createHash("sha1").update(key).digest("hex");

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export type LiveQuote = {
  lowILS: number;
  listings: StoreListing[];
  cached: boolean;
};

async function cachedQuote(spec: StoreSpec): Promise<LiveQuote | null> {
  try {
    const snap = await getAdminFirestore()
      .collection(COLLECTION)
      .doc(docId(specKey(spec)))
      .get();
    const d = snap.data() as
      { lowILS?: number; at?: string; listings?: StoreListing[] } | undefined;
    if (
      d &&
      typeof d.lowILS === "number" &&
      d.at &&
      Date.now() - Date.parse(d.at) < TTL_MS
    )
      return { lowILS: d.lowILS, listings: d.listings ?? [], cached: true };
  } catch {
    // מטמון הוא בונוס
  }
  return null;
}

/** המחיר הנמוך האמין למחשב (בלי אביזרים) מחנויות ישראליות + המודעות שעליהן הוא מבוסס, או null. */
export async function liveQuote(spec: StoreSpec): Promise<LiveQuote | null> {
  const cached = await cachedQuote(spec);
  if (cached) return cached;
  const listings = await withTimeout(
    findCheapestListings(spec).catch(() => []),
    SEARCH_TIMEOUT_MS,
  );
  const prices = (listings ?? []).map((l) => l.priceILS).filter((n) => n > 500);
  if (!listings || !prices.length) return null;
  const low = Math.min(...prices);
  await getAdminFirestore()
    .collection(COLLECTION)
    .doc(docId(specKey(spec)))
    .set({
      key: specKey(spec),
      spec,
      lowILS: low,
      at: new Date().toISOString(),
      listings: listings.slice(0, 3),
    })
    .catch(() => {});
  return { lowILS: low, listings: listings.slice(0, 3), cached: false };
}

export async function liveMarketLow(spec: StoreSpec): Promise<number | null> {
  return (await liveQuote(spec))?.lowILS ?? null;
}

export type PricedOptions = {
  estimates: (PriceEstimate | null)[];
  /** המחיר אומת מול מודעות חיות (או מקורו מהמחירון בלבד) */
  source: "live" | "guide";
  /** מחיר חי וממחירון לא תואמים - נבחר הגבוה, והבעלים יאשר */
  uncertain: boolean;
};

/**
 * מתמחר את כל האפשרויות: האפשרות הראשונה מאומתת מול השוק, והאחרות לפי אותו הפרש מהמחירון.
 * נקרא גם בצ'אט וגם בשמירת הבקשה (שם המטמון כבר חם, ולכן המחיר זהה לזה שהוצג).
 */
export async function priceOptions(
  specs: StoreSpec[],
  guide: StorePriceGuide,
): Promise<PricedOptions> {
  const guideLows = specs.map((s) => estimateMarketLow(s, guide));
  const live = specs[0] ? await liveMarketLow(specs[0]) : null;
  let delta = 0;
  let source: PricedOptions["source"] = "guide";
  let uncertain = false;
  let firstLow: number | null = guideLows[0] ?? null;
  if (live !== null) {
    if (firstLow === null) {
      firstLow = live;
      source = "live";
    } else {
      const ratio = live / firstLow;
      if (ratio >= TRUST_RATIO[0] && ratio <= TRUST_RATIO[1]) {
        firstLow = live;
        source = "live";
      } else {
        firstLow = Math.max(live, firstLow);
        uncertain = true;
      }
      delta = firstLow - (guideLows[0] ?? firstLow);
    }
  }
  const estimates = specs.map((spec, i) => {
    if (i === 0) return estimateRange(spec, guide, firstLow ?? undefined);
    const g = guideLows[i];
    return estimateRange(
      spec,
      guide,
      g === null || g === undefined ? undefined : g + delta,
    );
  });
  return { estimates, source, uncertain };
}
