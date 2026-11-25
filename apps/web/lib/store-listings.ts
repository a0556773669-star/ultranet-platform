import Anthropic from "@anthropic-ai/sdk";
import type { StoreListing, StoreSpec } from "@ultranet/shared-types";
import { anthropicConfigured, createAnthropic } from "./anthropic-client";
import { specDescription } from "./store-price-guide";

/**
 * "איפה הכי זול להזמין": חיפוש חי (Haiku 5.5 + חיפוש ברשת) של כמה מודעות אמיתיות בחנויות ישראליות לתצורה שהלקוח
 * אישר, כדי שהבעלים יוכל להזמין משם אם אין לו מלאי אצל היבואנים. רץ רק כשסניף מבקש **בדיקת מלאי** (נפח נמוך),
 * ברקע, ולא מעכב את הסניף. עלות: כ-5 עד 10 אגורות לבדיקה.
 *
 * קישור נכלל רק אם הוא הופיע בפועל בתוצאות החיפוש - המודל לא יכול "להמציא" כתובת.
 */
const MODEL = "claude-haiku-5-5";
const MAX_PAUSE_TURNS = 3;

function resultUrls(content: Anthropic.ContentBlock[]): Set<string> {
  const urls = new Set<string>();
  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const r of block.content) if (r.type === "web_search_result" && r.url) urls.add(r.url);
    }
  }
  return urls;
}

export async function findCheapestListings(spec: StoreSpec): Promise<StoreListing[]> {
  if (!anthropicConfigured()) return [];
  const client = createAnthropic();
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `חפש באינטרנט עד 3 מודעות אמיתיות של חנויות ישראליות מוכרות (למשל KSP, Ivory, Bug, Zap) שמוכרות **מחשב חדש** במפרט הבא, במחיר הנמוך ביותר האמין:
${specDescription(spec)}

כללים: **המחיר חייב להיות מחיר סופי לצרכן כולל מע"מ** (לא "לפני מע"מ", לא מחיר מבצע שפג, ולא מחיר בלי מלאי). מחשב **בלי מערכת הפעלה** אם יש (או הזול ביותר שעומד במפרט). התעלם ממחיר חשוד כחריג (זול או יקר בצורה לא הגיונית לעומת השאר). כל מודעה חייבת קישור ישיר לעמוד המוצר שמצאת בתוצאות החיפוש.
החזר אך ורק JSON, בלי טקסט נוסף ובלי בלוק קוד:
{"listings":[{"store":"שם החנות","title":"שם הדגם","priceILS":number,"url":"https://..."}]}
אם לא מצאת מודעה אמינה - {"listings":[]}.`,
    },
  ];
  const seen = new Set<string>();
  for (let turn = 0; turn <= MAX_PAUSE_TURNS; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      output_config: { effort: "low" },
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
      messages,
    });
    for (const u of resultUrls(response.content)) seen.add(u);
    if (response.stop_reason === "refusal") return [];
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
    if (start < 0 || end <= start) return [];
    let raw: { listings?: { store?: string; title?: string; priceILS?: number; url?: string }[] };
    try {
      raw = JSON.parse(text.slice(start, end + 1));
    } catch {
      return [];
    }
    return (raw.listings ?? [])
      .filter((l) => typeof l.priceILS === "number" && l.priceILS > 300 && typeof l.url === "string" && /^https?:\/\//.test(l.url) && seen.has(l.url))
      .map((l) => ({ store: String(l.store ?? "").slice(0, 60), title: String(l.title ?? "").slice(0, 140), priceILS: Math.round(l.priceILS!), url: l.url! }))
      .sort((a, b) => a.priceILS - b.priceILS)
      .slice(0, 3);
  }
  return [];
}
