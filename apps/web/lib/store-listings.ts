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
    if (
      block.type === "web_search_tool_result" &&
      Array.isArray(block.content)
    ) {
      for (const r of block.content)
        if (r.type === "web_search_result" && r.url) urls.add(r.url);
    }
  }
  return urls;
}

/** אתרים שדף המוצר שלהם נגיש לבדיקה אוטומטית (אחרים כמו KSP ו-PC Online חוסמים) - מהם אפשר לאמת מחיר. */
export const VERIFIABLE_DOMAINS = [
  "bug.co.il",
  "ivory.co.il",
  "pcil.co.il",
  "zap.co.il",
];

export async function findCheapestListings(
  spec: StoreSpec,
  allowedDomains?: string[],
): Promise<StoreListing[]> {
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
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 4,
          ...(allowedDomains?.length
            ? { allowed_domains: allowedDomains }
            : {}),
        },
      ],
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
    let raw: {
      listings?: {
        store?: string;
        title?: string;
        priceILS?: number;
        url?: string;
      }[];
    };
    try {
      raw = JSON.parse(text.slice(start, end + 1));
    } catch {
      return [];
    }
    const candidates = (raw.listings ?? [])
      .filter(
        (l) =>
          typeof l.priceILS === "number" &&
          l.priceILS > 300 &&
          typeof l.url === "string" &&
          /^https?:\/\//.test(l.url) &&
          seen.has(l.url),
      )
      .map((l) => ({
        store: String(l.store ?? "").slice(0, 60),
        title: String(l.title ?? "").slice(0, 140),
        priceILS: Math.round(l.priceILS!),
        url: l.url!,
      }))
      .sort((a, b) => a.priceILS - b.priceILS)
      .slice(0, 4);
    // אימות מול דף המוצר (במקביל). מודעה שהדף שלה נקרא והמחיר לא תואם - נפסלת; אתר שחוסם בדיקה - נשארת כ"לא מאומתת".
    const checked = await Promise.all(
      candidates.map(async (l): Promise<StoreListing | null> => {
        const v = await verifiedListingPrice(l.url, l.priceILS);
        return v === null
          ? null
          : { ...l, priceILS: v.price, verified: v.verified };
      }),
    );
    return checked
      .filter((l): l is StoreListing => l !== null)
      .sort((a, b) => a.priceILS - b.priceILS)
      .slice(0, 3);
  }
  return [];
}

/**
 * אימות מחיר מול דף המוצר עצמו. מודל שקורא תוצאות חיפוש טועה לפעמים (מחיר ללא מע"מ, תשלום חודשי, מוצר אחר באותו עמוד).
 * לכן כל מודעה נבדקת מול ה-HTML של הדף: אם המחיר שהמודל דיווח לא מופיע בו - מחליפים אותו במחיר המובנה של הדף
 * (JSON-LD / meta / itemprop), ואם אין כזה - המודעה נפסלת.
 */
const PAGE_TIMEOUT_MS = 8000;

function toNumber(s: string): number | null {
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type PageInspection = {
  structured: number[];
  shekel: number[];
  ok: boolean;
  status?: number;
};

export async function inspectPage(url: string): Promise<PageInspection> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; UltranetPriceCheck/1.0)",
        "accept-language": "he-IL,he;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok)
      return { structured: [], shekel: [], ok: false, status: res.status };
    const html = (await res.text()).slice(0, 1_500_000);
    const structured: number[] = [];
    for (const re of [
      /"price"\s*:\s*"?([\d.,]{3,9})"?/g,
      /property=["']product:price:amount["'][^>]*content=["']([\d.,]+)["']/g,
      /property=["']og:price:amount["'][^>]*content=["']([\d.,]+)["']/g,
      /itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/g,
    ]) {
      for (const m of html.matchAll(re)) {
        const n = toNumber(m[1]!);
        if (n && n >= 300 && n <= 60000) structured.push(Math.round(n));
      }
    }
    const shekel: number[] = [];
    for (const m of html.matchAll(
      /([\d]{1,2},?\d{3})\s*(?:₪|&#8362;|ש"ח|שח)|(?:₪|&#8362;)\s*([\d]{1,2},?\d{3})/g,
    )) {
      const n = toNumber(m[1] ?? m[2] ?? "");
      if (n && n >= 300 && n <= 60000) shekel.push(Math.round(n));
    }
    return { structured, shekel, ok: true, status: res.status };
  } catch {
    return { structured: [], shekel: [], ok: false };
  }
}

/** המחיר המאומת של המודעה. `verified:false` = האתר חוסם בדיקה אוטומטית (המחיר מהחיפוש בלבד). null = הדף נקרא והמחיר לא תואם - נפסלת. */
export async function verifiedListingPrice(
  url: string,
  claimed: number,
): Promise<{ price: number; verified: boolean } | null> {
  const page = await inspectPage(url);
  if (!page.ok) return { price: claimed, verified: false };
  const all = new Set([...page.structured, ...page.shekel]);
  if (all.has(claimed)) return { price: claimed, verified: true };
  // המחיר שהמודל דיווח לא בדף: סומכים רק על מחיר מובנה של הדף
  return page.structured[0]
    ? { price: page.structured[0], verified: true }
    : null;
}
