import Anthropic from "@anthropic-ai/sdk";
import type { StoreCpuTier, StoreDeviceKind } from "@ultranet/shared-types";
import { DEFAULT_MIN_GENERATION, USAGE_OPTIONS, type UsageKey } from "./store-wizard";
import { loadGlossary } from "./store-glossary";

/**
 * יועץ ההתאמה של חנות הסניפים: שיחה קצרה שבה Claude Haiku 5.5 (הדגם הזול ביותר, מאמץ נמוך) מבין מה
 * הלקוח צריך, שואל שאלות המשך, ומחזיר מפרט מובנה. מנהל הסניף מקליד את מה שהלקוח אומר.
 *
 * עלות מוגבלת בקוד: עד `MAX_USER_TURNS` תורות, תשובה קצרה, וללא חיפוש ברשת. בלי `ANTHROPIC_API_KEY` הכפתור
 * לא מוצג והאשף הרגיל (דטרמיניסטי, בלי עלות) ממשיך לעבוד.
 */
export function advisorConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = "claude-haiku-5-5";
export const MAX_USER_TURNS = 10;

export type AdvisorTurn = { role: "user" | "assistant"; content: string };

export type AdvisorResult = {
  reply: string;
  done: boolean;
  kind: StoreDeviceKind | null;
  usage: UsageKey | null;
  cpu: StoreCpuTier | null;
  ramGb: number | null;
  storageGb: number | null;
  screenInches: number | null;
  touch: boolean | null;
  extras: string[];
  budgetILS: number | null;
  /** שדות שהלקוח קבע במפורש - לא משנים */
  lockedFields: string[];
  notes: string;
};

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "done", "kind", "usage", "cpu", "ramGb", "storageGb", "screenInches", "touch", "extras", "budgetILS", "lockedFields", "notes"],
  properties: {
    reply: { type: "string" },
    done: { type: "boolean" },
    kind: nullable({ type: "string", enum: ["laptop", "desktop"] }),
    usage: nullable({ type: "string", enum: ["basic", "office", "heavy"] }),
    cpu: nullable({ type: "string", enum: ["i3", "i5", "i7"] }),
    ramGb: nullable({ type: "integer" }),
    storageGb: nullable({ type: "integer" }),
    screenInches: nullable({ type: "number" }),
    touch: nullable({ type: "boolean" }),
    extras: { type: "array", items: { type: "string" } },
    budgetILS: nullable({ type: "integer" }),
    lockedFields: { type: "array", items: { type: "string", enum: ["cpu", "ramGb", "storageGb", "screenInches", "touch", "extras"] } },
    notes: { type: "string" },
  },
} as const;

async function systemPrompt(): Promise<string> {
  const glossary = await loadGlossary();
  const usage = USAGE_OPTIONS.map((u) => `- ${u.key}: ${u.label} (${u.hint})`).join("\n");
  return `אתה יועץ התאמת מחשבים בסניף של "אולטרנט". מנהל הסניף מקליד מה הלקוח אומר, ואתה עוזר להבין מה מתאים לו.

מטרה: להגיע למפרט מתאים ללקוח בכמה שפחות שאלות (עד 6), בשפה פשוטה וברורה, ובטון מכבד.

כללים:
- שאל שאלה אחת או שתיים קצרות בכל תור. אל תחזור על שאלה שכבר נענתה.
- הבן את הכוונה של הלקוח, לא רק את המילים. השתמש במושגים שלמטה.
- חובה לברר: נייד או נייח; למה הלקוח צריך את המחשב; ומה התקציב שהוא חושב עליו (שאל בעדינות, והוא רשאי לא לדעת).
- בנייד: גודל מסך ומסך מגע. בנייח: אילו ציוד נלווה (מסך, מקלדת, עכבר).
- כשהשימוש דורש איכות מסך (למשל גרפיקה או וידאו) - שאל על איכות המסך והסבר בקצרה למה זה חשוב.
- שדה ב-lockedFields רק אם הלקוח אמר אותו במפורש (למשל "אני רוצה i3 ו-8 ג'יגה"). מה שאתה מסיק בעצמך לא ננעל.
- אל תציין מחירים ואל תבטיח מחיר או מלאי. לא מדברים על רווח.
- דור המעבד: ${DEFAULT_MIN_GENERATION} ומעלה כברירת מחדל; אל תשאל על זה.
- כשיש מספיק מידע, החזר done=true עם משפט סיכום קצר ב-reply. כל עוד חסר מידע חשוב: done=false.
- אם הלקוח שואל על משהו שאינו התאמת מחשב, החזר בעדינות לנושא.

ערכי usage: 
${usage}
מפרט אפשרי: cpu: i3/i5/i7 · ramGb: 8/16/32 · storageGb: 256/512/1000/2000 · screenInches: 14/15.6/17.
החזר null לשדה שעוד לא ידוע.

מושגים שהבעלים הגדיר:
${glossary.map((g) => `- ${g.term}: ${g.guidance}`).join("\n")}`;
}

export async function advisorTurn(history: AdvisorTurn[]): Promise<AdvisorResult> {
  if (!advisorConfigured()) throw new Error("יועץ ה-AI לא מופעל (חסר ANTHROPIC_API_KEY)");
  const userTurns = history.filter((t) => t.role === "user").length;
  if (userTurns === 0) throw new Error("אין הודעה");
  if (userTurns > MAX_USER_TURNS) throw new Error("השיחה ארוכה מדי - עוברים לסיכום או לשאלון הרגיל");

  const messages: Anthropic.MessageParam[] = history.slice(-24).map((t) => ({
    role: t.role,
    content: t.content.slice(0, 600),
  }));
  if (messages[0]?.role !== "user") messages.shift();

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    system: [{ type: "text", text: await systemPrompt(), cache_control: { type: "ephemeral" } }],
    messages,
  });
  if (response.stop_reason === "refusal") throw new Error("היועץ לא הצליח להשיב - נסו שוב או עברו לשאלון הרגיל");
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  let raw: Partial<AdvisorResult>;
  try {
    raw = JSON.parse(text) as Partial<AdvisorResult>;
  } catch {
    throw new Error("לא התקבלה תשובה תקינה - נסו שוב");
  }
  return {
    reply: String(raw.reply ?? "").slice(0, 800),
    done: Boolean(raw.done) && raw.kind != null,
    kind: raw.kind === "desktop" || raw.kind === "laptop" ? raw.kind : null,
    usage: raw.usage === "basic" || raw.usage === "office" || raw.usage === "heavy" ? raw.usage : null,
    cpu: raw.cpu === "i3" || raw.cpu === "i5" || raw.cpu === "i7" ? raw.cpu : null,
    ramGb: typeof raw.ramGb === "number" ? raw.ramGb : null,
    storageGb: typeof raw.storageGb === "number" ? raw.storageGb : null,
    screenInches: typeof raw.screenInches === "number" ? raw.screenInches : null,
    touch: typeof raw.touch === "boolean" ? raw.touch : null,
    extras: Array.isArray(raw.extras) ? raw.extras.map(String).slice(0, 8) : [],
    budgetILS: typeof raw.budgetILS === "number" && raw.budgetILS > 0 ? raw.budgetILS : null,
    lockedFields: Array.isArray(raw.lockedFields) ? raw.lockedFields.map(String) : [],
    notes: String(raw.notes ?? "").slice(0, 500),
  };
}
