import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import type { StorePriceGuide, StoreSpec } from "@ultranet/shared-types";
import { getAdminFirestore } from "./firebase-admin";
import { anthropicConfigured, createAnthropic } from "./anthropic-client";
import { DEFAULT_MIN_GENERATION } from "./store-wizard";
import { accessoryRange, quotedRange, roundTen } from "./store-pricing";
import { estimateRange, type PriceEstimate } from "./store-price-guide";

/**
 * מחיר שוק חי, עם מאגר יומי. הכלל (מהבעלים): סוקרים חנויות ישראליות, **מתעלמים ממחירים חריגים**
 * (אם כולם מוכרים ב-2,000 ומישהו ב-1,500 - הוא לא אמין), לוקחים **ממוצע נמוך של המחשב המינימלי בלי מערכת
 * הפעלה ובלי תוכנות**, ומוסיפים 300-500 ₪. התוצאה נשמרת ל-`n_store_price_cache` לאותו יום (שעון ישראל), כך
 * שמפרט שכבר נבדק היום - בכל סניף - לא נבדק שוב ולא עולה שוב.
 *
 * Haiku 5.5 + חיפוש ברשת. כשהחיפוש נכשל - נופלים למחירון הגיבוי (`n_store_settings/price_guide`), ואם גם הוא
 * חסר - אין הערכה והסניף אומר שהמחיר יימסר אחרי בדיקה.
 */
const MODEL = "claude-haiku-5-5";
const CACHE_COLLECTION = "n_store_price_cache";
const MAX_PAUSE_TURNS = 3;

export type MarketItem = { key: string; description: string };
export type MarketLow = { lowAverageILS: number; prices: { store: string; priceILS: number }[] };

export function israelDate(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
}

export function computerKey(spec: StoreSpec): string {
  return [
    "pc",
    spec.kind,
    spec.cpu ?? "i3",
    spec.ramGb ?? 8,
    spec.storageGb ?? 256,
    spec.kind === "laptop" ? (spec.screenInches ?? 15.6) : "-",
    spec.kind === "laptop" ? (spec.touch ? "touch" : "notouch") : "-",
    spec.minGeneration ?? DEFAULT_MIN_GENERATION,
  ].join("|");
}

export function computerDescription(spec: StoreSpec): string {
  const parts = [
    spec.kind === "laptop" ? "מחשב נייד" : "מחשב נייח (המחשב בלבד, בלי מסך)",
    `מעבד אינטל ${spec.cpu ?? "i3"} דור ${spec.minGeneration ?? DEFAULT_MIN_GENERATION} ומעלה`,
    `${spec.ramGb ?? 8}GB זיכרון`,
    `${spec.storageGb ?? 256}GB SSD`,
  ];
  if (spec.kind === "laptop") {
    parts.push(`מסך ${spec.screenInches ?? 15.6} אינץ'`, spec.touch ? "עם מסך מגע" : "בלי מסך מגע");
  }
  return parts.join(", ");
}

const ACCESSORY_DESC: Record<string, string> = {
  מסך: "מסך מחשב 24 אינץ' פשוט",
  "מקלדת ועכבר": "סט מקלדת ועכבר אלחוטיים פשוטים",
  מקלדת: "מקלדת פשוטה",
  עכבר: "עכבר אלחוטי פשוט",
  סטיק: "דיסק און קי 64GB",
  רמקולים: "רמקולים פשוטים למחשב",
};

export function accessoryKey(name: string): string {
  return `acc|${name}`;
}

export function accessoryNames(spec: StoreSpec): string[] {
  const extras = spec.extras ?? [];
  return extras.includes("מקלדת") && extras.includes("עכבר")
    ? ["מקלדת ועכבר", ...extras.filter((e) => e !== "מקלדת" && e !== "עכבר")]
    : extras;
}

const docId = (key: string, date: string) => createHash("sha1").update(`${date}__${key}`).digest("hex");

export async function readCache(keys: string[]): Promise<Map<string, MarketLow>> {
  const out = new Map<string, MarketLow>();
  if (!keys.length) return out;
  const db = getAdminFirestore();
  const date = israelDate();
  const refs = keys.map((k) => db.collection(CACHE_COLLECTION).doc(docId(k, date)));
  const snaps = await db.getAll(...refs);
  snaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const d = snap.data() as { lowAverageILS?: number; prices?: MarketLow["prices"] };
    if (typeof d.lowAverageILS === "number") out.set(keys[i]!, { lowAverageILS: d.lowAverageILS, prices: d.prices ?? [] });
  });
  return out;
}

async function writeCache(key: string, value: MarketLow): Promise<void> {
  await getAdminFirestore()
    .collection(CACHE_COLLECTION)
    .doc(docId(key, israelDate()))
    .set({ key, date: israelDate(), ...value, createdAt: new Date().toISOString() });
}

function lookupPrompt(items: MarketItem[]): string {
  return `אני מוכר מחשבים בישראל. בדוק באינטרנט מחירי שוק עדכניים בחנויות ישראליות מוכרות למוצרים הבאים (מוצר חדש, מחיר בשקלים):

${items.map((i) => `[${i.key}] ${i.description}`).join("\n")}

כללים:
- מחפשים את **המחשב המינימלי שעומד במפרט, בלי מערכת הפעלה ובלי תוכנות** (המחיר הנמוך הרגיל בשוק למפרט הזה).
- מתעלמים ממחירים חריגים: אם רוב החנויות מוכרות בסביבות מחיר מסוים ומישהו מוכר הרבה יותר זול (או יקר) - הוא לא אמין.
- lowAverageILS = ממוצע המחירים **הנמוכים** התקינים אחרי סינון החריגים.
- אם אין לך מידע אמין למוצר - lowAverageILS: null.
החזר אך ורק אובייקט JSON, בלי טקסט נוסף ובלי בלוק קוד:
{"results":[{"key":"<המפתח בסוגריים המרובעים>","lowAverageILS":number|null,"prices":[{"store":"שם החנות","priceILS":number}]}]}`;
}

/** מחפש ברשת מחיר שוק נמוך לפריטים שאין להם מאגר מהיום, ושומר למאגר. מחזיר רק מה שנמצא. */
export async function lookupMarketLows(items: MarketItem[]): Promise<Map<string, MarketLow>> {
  const out = new Map<string, MarketLow>();
  if (!items.length || !anthropicConfigured()) return out;
  const client = createAnthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: lookupPrompt(items) }];
  for (let turn = 0; turn <= MAX_PAUSE_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: Math.min(10, 2 + items.length * 2), user_location: { type: "approximate", country: "IL" } }],
      messages,
    });
    if (response.stop_reason === "refusal") return out;
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return out;
    let raw: { results?: { key?: string; lowAverageILS?: number | null; prices?: { store?: string; priceILS?: number }[] }[] };
    try {
      raw = JSON.parse(text.slice(start, end + 1));
    } catch {
      return out;
    }
    for (const r of raw.results ?? []) {
      if (!r.key || typeof r.lowAverageILS !== "number" || !(r.lowAverageILS > 0)) continue;
      if (!items.some((i) => i.key === r.key)) continue;
      const value: MarketLow = {
        lowAverageILS: Math.round(r.lowAverageILS),
        prices: (r.prices ?? [])
          .filter((p) => typeof p.priceILS === "number" && p.priceILS > 0)
          .slice(0, 8)
          .map((p) => ({ store: String(p.store ?? "").slice(0, 60), priceILS: Math.round(p.priceILS!) })),
      };
      out.set(r.key, value);
      await writeCache(r.key, value).catch(() => {});
    }
    return out;
  }
  return out;
}

function buildEstimate(spec: StoreSpec, lows: Map<string, MarketLow>): PriceEstimate | null {
  const pc = lows.get(computerKey(spec));
  if (!pc) return null;
  const r = quotedRange(pc.lowAverageILS);
  const accessories: PriceEstimate["accessories"] = [];
  for (const name of accessoryNames(spec)) {
    const a = lows.get(accessoryKey(name));
    if (!a) continue;
    const range = accessoryRange(name, a.lowAverageILS);
    accessories.push({ name, fromILS: roundTen(range.from), toILS: roundTen(range.to) });
  }
  return { fromILS: roundTen(r.from), toILS: roundTen(r.to), accessories };
}

/**
 * הערכת מחיר לכמה מפרטים בבת אחת: מאגר היום, ואז חיפוש חי **רק למה שחסר** (קריאה אחת לכולם), ואז מחירון הגיבוי.
 * `allowLookup: false` = רק מאגר/גיבוי, בלי להוציא כסף (בשמירת בקשה, אחרי שהמחיר כבר הוצג).
 */
export async function estimateMany(
  specs: StoreSpec[],
  guide: StorePriceGuide,
  opts: { allowLookup: boolean },
): Promise<{ estimate: PriceEstimate | null; source: "market" | "guide" | "none" }[]> {
  const wanted = new Map<string, MarketItem>();
  for (const spec of specs) {
    wanted.set(computerKey(spec), { key: computerKey(spec), description: computerDescription(spec) });
    for (const name of accessoryNames(spec)) {
      wanted.set(accessoryKey(name), { key: accessoryKey(name), description: ACCESSORY_DESC[name] ?? name });
    }
  }
  const lows = await readCache([...wanted.keys()]);
  const missing = [...wanted.values()].filter((i) => !lows.has(i.key));
  if (opts.allowLookup && missing.length) {
    try {
      for (const [k, v] of await lookupMarketLows(missing)) lows.set(k, v);
    } catch {
      // חיפוש נכשל - נופלים לגיבוי
    }
  }
  return specs.map((spec) => {
    const market = buildEstimate(spec, lows);
    if (market) return { estimate: market, source: "market" as const };
    const fallback = estimateRange(spec, guide);
    return fallback ? { estimate: fallback, source: "guide" as const } : { estimate: null, source: "none" as const };
  });
}
