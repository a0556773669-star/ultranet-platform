import Anthropic from "@anthropic-ai/sdk";
import { anthropicConfigured, createAnthropic } from "./anthropic-client";
import type { StoreRequest } from "@ultranet/shared-types";
import { buildMarketPrompt } from "./store-wizard";

/**
 * הכנה אוטומטית של סקירת מחירי שוק לבקשת חנות סניפים - **הדגם הזול ביותר (Haiku 5.5)**, מאמץ נמוך,
 * וחיפוש ברשת. פועל רק כש-`ANTHROPIC_API_KEY` מוגדר, ורק לבעלים (כפתור במסך הבקשה).
 *
 * זו **טיוטה** לבעלים: המספר שמוחזר ממלא את שדה "ממוצע שוק נמוך", והבעלים בודק ומאשר לפני שליחה לסניף.
 */
export function storeAiConfigured(): boolean {
  return anthropicConfigured();
}

const MODEL = "claude-haiku-5-5";
const MAX_PAUSE_TURNS = 3;

export type MarketDraft = {
  lowAverageILS: number | null;
  stores: { store: string; model: string; priceILS: number }[];
  upgradeNote: string;
};

const FORMAT_INSTRUCTION = `
החזר אך ורק אובייקט JSON אחד, בלי טקסט לפניו או אחריו ובלי בלוק קוד, במבנה:
{"lowAverageILS": number|null, "stores": [{"store": string, "model": string, "priceILS": number}], "upgradeNote": string}
- lowAverageILS = ממוצע המחירים הנמוך אחרי התעלמות ממחירים חריגים (null אם לא נמצאו מחירים אמינים).
- upgradeNote = משפט או שניים בעברית פשוטה על אפשרות טיפה יותר טובה במחיר קרוב, ובמה היא טובה יותר (מחרוזת ריקה אם אין).`;

function parseDraft(text: string): MarketDraft {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("לא התקבלה תשובה מובנית");
  const raw = JSON.parse(text.slice(start, end + 1)) as Partial<MarketDraft>;
  const low = typeof raw.lowAverageILS === "number" && raw.lowAverageILS > 0 ? Math.round(raw.lowAverageILS) : null;
  const stores = Array.isArray(raw.stores)
    ? raw.stores
        .filter((s) => s && typeof s.priceILS === "number" && s.priceILS > 0)
        .slice(0, 8)
        .map((s) => ({ store: String(s.store ?? "").slice(0, 60), model: String(s.model ?? "").slice(0, 120), priceILS: Math.round(s.priceILS) }))
    : [];
  return { lowAverageILS: low, stores, upgradeNote: String(raw.upgradeNote ?? "").slice(0, 600) };
}

export async function draftMarketPrice(request: StoreRequest): Promise<MarketDraft> {
  if (!storeAiConfigured()) throw new Error("ANTHROPIC_API_KEY לא מוגדר");
  const client = createAnthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildMarketPrompt(request) + "\n" + FORMAT_INSTRUCTION }];

  for (let turn = 0; turn <= MAX_PAUSE_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4, user_location: { type: "approximate", country: "IL" } }],
      messages,
    });
    if (response.stop_reason === "refusal") throw new Error("המודל סירב לבקשה");
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return parseDraft(text);
  }
  throw new Error("החיפוש לא הסתיים - נסו שוב");
}


export type PriceGuideDraft = {
  laptopBase: Record<string, number>;
  desktopBase: Record<string, number>;
  ramAdd: Record<string, number>;
  storageAdd: Record<string, number>;
  touchAdd: number | null;
  screen17Add: number | null;
  accessoriesLow: Record<string, number>;
  note: string;
};

const GUIDE_PROMPT = `אני מוכר מחשבים בישראל. בדוק מחירי שוק עדכניים (חנויות ישראליות מוכרות, מחשב חדש, מעבד אינטל דור 12 ומעלה) והחזר מחירון הערכה בשקלים.
לכל מספר: ממוצע המחירים **הנמוך**, בלי להתחשב במחירים חריגים (נמוכים או גבוהים בצורה חשודה).
הגדרות:
- laptopBase: מחשב נייד 15.6 אינץ', 8GB זיכרון, 256GB SSD, בלי מסך מגע - לפי מעבד i3 / i5 / i7.
- desktopBase: מחשב נייח (המחשב בלבד, בלי מסך) באותו מפרט - לפי i3 / i5 / i7.
- ramAdd: התוספת למחיר כשעוברים מ-8GB ל-16 ול-32 (מפתחות "16","32").
- storageAdd: התוספת כשעוברים מ-256GB ל-512, 1000, 2000 (מפתחות "512","1000","2000").
- touchAdd: תוספת מסך מגע בנייד. screen17Add: תוספת מסך 17 אינץ' בנייד.
- accessoriesLow: מחיר שוק נמוך ל: monitor (מסך 24 אינץ' פשוט), keyboardMouse (סט מקלדת ועכבר אלחוטיים פשוטים), keyboard, mouse, stick (דיסק און קי 64GB), speakers.
אם אין לך מידע אמין על פריט - השמט אותו (null או בלי המפתח). החזר אך ורק אובייקט JSON, בלי טקסט נוסף ובלי בלוק קוד, במבנה:
{"laptopBase":{"i3":0,"i5":0,"i7":0},"desktopBase":{"i3":0,"i5":0,"i7":0},"ramAdd":{"16":0,"32":0},"storageAdd":{"512":0,"1000":0,"2000":0},"touchAdd":null,"screen17Add":null,"accessoriesLow":{"monitor":0,"keyboardMouse":0,"stick":0},"note":"מקורות/הערות קצרות"}`;

function onlyNumbers(o: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) out[k] = Math.round(v);
    }
  }
  return out;
}

/** סקירת שוק מרוכזת למחירון (פעם בחודש בערך): Haiku + חיפוש ברשת. טיוטה לבעלים, לא נשמרת אוטומטית. */
export async function draftPriceGuide(): Promise<PriceGuideDraft> {
  if (!storeAiConfigured()) throw new Error("ANTHROPIC_API_KEY לא מוגדר");
  const client = createAnthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: GUIDE_PROMPT }];
  for (let turn = 0; turn <= MAX_PAUSE_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 6000,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 6, user_location: { type: "approximate", country: "IL" } }],
      messages,
    });
    if (response.stop_reason === "refusal") throw new Error("המודל סירב לבקשה");
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
    if (start < 0 || end <= start) throw new Error("לא התקבלה תשובה מובנית");
    const raw = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    return {
      laptopBase: onlyNumbers(raw.laptopBase),
      desktopBase: onlyNumbers(raw.desktopBase),
      ramAdd: onlyNumbers(raw.ramAdd),
      storageAdd: onlyNumbers(raw.storageAdd),
      touchAdd: typeof raw.touchAdd === "number" && raw.touchAdd > 0 ? Math.round(raw.touchAdd) : null,
      screen17Add: typeof raw.screen17Add === "number" && raw.screen17Add > 0 ? Math.round(raw.screen17Add) : null,
      accessoriesLow: onlyNumbers(raw.accessoriesLow),
      note: String(raw.note ?? "").slice(0, 300),
    };
  }
  throw new Error("החיפוש לא הסתיים - נסו שוב");
}
