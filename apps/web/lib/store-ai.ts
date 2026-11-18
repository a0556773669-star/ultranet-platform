import Anthropic from "@anthropic-ai/sdk";
import type { StoreRequest } from "@ultranet/shared-types";
import { buildMarketPrompt } from "./store-wizard";

/**
 * הכנה אוטומטית של סקירת מחירי שוק לבקשת חנות סניפים - **הדגם הזול ביותר (Haiku 5.5)**, מאמץ נמוך,
 * וחיפוש ברשת. פועל רק כש-`ANTHROPIC_API_KEY` מוגדר, ורק לבעלים (כפתור במסך הבקשה).
 *
 * זו **טיוטה** לבעלים: המספר שמוחזר ממלא את שדה "ממוצע שוק נמוך", והבעלים בודק ומאשר לפני שליחה לסניף.
 */
export function storeAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
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
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildMarketPrompt(request) + "\n" + FORMAT_INSTRUCTION }];

  for (let turn = 0; turn <= MAX_PAUSE_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4, user_location: { type: "approximate", country: "IL" } }],
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
