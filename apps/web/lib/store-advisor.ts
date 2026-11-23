import Anthropic from "@anthropic-ai/sdk";
import type { StoreCpuTier, StoreSpec } from "@ultranet/shared-types";
import { anthropicConfigured, createAnthropic } from "./anthropic-client";
import { getAdminFirestore } from "./firebase-admin";
import { DEFAULT_MIN_GENERATION, USAGE_OPTIONS, sanitizeSpec, specToText } from "./store-wizard";
import { loadGlossary } from "./store-glossary";
import { FAQ_COLLECTION, learnFaq, loadFaq, matchFaq } from "./store-faq";
import { estimateRange, guideForPrompt, loadPriceGuide, type PriceEstimate } from "./store-price-guide";

/**
 * יועץ הצ'אט של חנות הסניפים - **Claude Haiku 5.5** (הדגם הזול ביותר), מאמץ נמוך, פלט מובנה.
 * מנהל הסניף מקליד מה הלקוח אומר, והיועץ שואל, מציע 2-3 אפשרויות ומראה להן טווחי מחיר (מחושבים בקוד
 * מהמחירון - לא ע"י המודל).
 *
 * חיסכון: (1) שאלה חוזרת שיש לה תשובה מאושרת ב-`n_store_faq` נענית בלי שום קריאה למודל;
 * (2) תשובות היועץ לשאלות כלליות נלמדות לאישור הבעלים; (3) הנחיות המערכת קבועות ולכן נשמרות במטמון;
 * (4) היסטוריה מקוצרת, תשובה קצרה, ומגבלת תורות לשיחה.
 */
export function advisorConfigured(): boolean {
  return anthropicConfigured();
}

const MODEL = "claude-haiku-5-5";
export const MAX_USER_TURNS = 20;
const HISTORY_WINDOW = 16;

export type AdvisorTurn = { role: "user" | "assistant"; content: string };

export type ChatOption = {
  label: string;
  kind: "as_requested" | "upgrade" | "alternative";
  spec: StoreSpec;
  specText: string;
  whyBetter: string;
  estimate: PriceEstimate | null;
};

export type AdvisorReply = {
  reply: string;
  /** "faq" = נענה מהשאלות הנפוצות בלי קריאה למודל */
  source: "model" | "faq";
  options: ChatOption[];
  lockedFields: string[];
  budgetILS: number | null;
  notes: string;
};

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });

const OPTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["label", "kind", "cpu", "ramGb", "storageGb", "screenInches", "touch", "extras", "whyBetter"],
  properties: {
    label: { type: "string" },
    kind: { type: "string", enum: ["as_requested", "upgrade", "alternative"] },
    cpu: nullable({ type: "string", enum: ["i3", "i5", "i7"] }),
    ramGb: nullable({ type: "integer" }),
    storageGb: nullable({ type: "integer" }),
    screenInches: nullable({ type: "number" }),
    touch: nullable({ type: "boolean" }),
    extras: { type: "array", items: { type: "string" } },
    whyBetter: { type: "string" },
  },
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "deviceKind", "options", "lockedFields", "budgetILS", "notes", "generalQuestion"],
  properties: {
    reply: { type: "string" },
    deviceKind: nullable({ type: "string", enum: ["laptop", "desktop"] }),
    options: { type: "array", items: OPTION_SCHEMA },
    lockedFields: { type: "array", items: { type: "string", enum: ["cpu", "ramGb", "storageGb", "screenInches", "touch", "extras"] } },
    budgetILS: nullable({ type: "integer" }),
    notes: { type: "string" },
    generalQuestion: nullable({
      type: "object",
      additionalProperties: false,
      required: ["question", "keywords"],
      properties: { question: { type: "string" }, keywords: { type: "array", items: { type: "string" } } },
    }),
  },
} as const;

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function proceduresText(): Promise<string> {
  const snap = await getAdminFirestore().collection("n_procedures").get();
  const items = snap.docs
    .map((d) => d.data() as { title?: string; content?: string; status?: string; audience?: { mode?: string } })
    .filter((p) => p.audience?.mode === "store" && (p.status ?? "active") === "active")
    .map((p) => `# ${p.title}\n${stripHtml(p.content ?? "")}`);
  return items.join("\n\n").slice(0, 4500);
}

async function systemPrompt(): Promise<string> {
  const [glossary, procedures, faq, guide] = await Promise.all([loadGlossary(), proceduresText(), loadFaq(), loadPriceGuide()]);
  const usage = USAGE_OPTIONS.map((u) => `- ${u.key}: ${u.label} (${u.hint})`).join("\n");
  const faqText = faq
    .filter((f) => f.approved)
    .slice(0, 25)
    .map((f) => `ש: ${f.question}\nת: ${f.answer}`)
    .join("\n\n");
  return `אתה יועץ בצ'אט של "אולטרנט" שעוזר למנהל סניף להתאים מחשב ללקוח. מנהל הסניף מקליד מה הלקוח אומר.
סגנון: צ'אט טבעי, קצר וידידותי, בעברית פשוטה ומכבדת. לא טופס ולא רשימת שאלות ארוכה.

איך עובדים:
1. הבן מה הלקוח צריך (נייד/נייח, למה, מה חשוב לו). שאל שאלה אחת או שתיים קצרות בכל פעם, רק על מה שחסר.
2. לקוחות לא תמיד רוצים לענות על הכול (למשל תקציב). שאל פעם אחת בעדינות; אם נמנע - המשך בלי זה ואל תחזור על השאלה.
3. ברגע שיש מספיק מידע (לפחות נייד/נייח והשימוש), הצע 2 או 3 אפשרויות בשדה options: הראשונה "as_requested" = בדיוק מה שהלקוח אמר או ההתאמה הבסיסית, אחת "upgrade" = טיפה יותר טוב, ואם מתאים "alternative" = חלופה חסכונית. לכל אפשרות כתוב whyBetter בעברית פשוטה: במה היא טובה או שונה, כדי שמנהל הסניף יוכל להסביר ללקוח.
4. אל תציין מחירים בטקסט: המערכת מוסיפה לכל אפשרות טווח מחיר לפי המחירון. כבד תקציב שהלקוח אמר.
5. שדה ב-lockedFields רק אם הלקוח אמר אותו במפורש. את מה שנעול אל תשנה באף אפשרות. אפשר להציע שדרוג רק בשדות שלא ננעלו.
6. בנייח או כשהלקוח מבקש - הוסף extras (מסך, מקלדת, עכבר, סטיק, רמקולים).
7. דור המעבד: ${DEFAULT_MIN_GENERATION} ומעלה כברירת מחדל. אל תשאל על זה.
8. שאלות כלליות (אחריות, אנטיווירוס, רישיונות, זמני אספקה ועוד): ענה לפי הנהלים והשאלות הנפוצות שלמטה, והחזר ב-generalQuestion את השאלה וכמה מילות מפתח, כדי שנענה עליה בעתיד בלי קריאה נוספת. אל תמציא; אם אין תשובה - אמור שיפנה להנהלה. במקרה כזה options ריק.
9. אל תעסוק בנושאים שאינם קשורים למחשבים והחנות.
10. אם עדיין אין מספיק מידע, options ריק. כל פעם שאתה מציע אפשרויות חדשות או מעודכנות - החזר את כולן שוב.

ערכי שימוש: 
${usage}
מפרט אפשרי: cpu: i3/i5/i7 · ramGb: 8/16/32 · storageGb: 256/512/1000/2000 · screenInches: 14/15.6/17.

מושגים שהבעלים הגדיר:
${glossary.map((g) => `- ${g.term}: ${g.guidance}`).join("\n")}

מחירון שוק (לשיקולי תקציב בלבד):
${guideForPrompt(guide)}

נהלי החנות:
${procedures || "(אין נהלים)"}

שאלות נפוצות:
${faqText || "(אין)"}`;
}

const SPEC_FIELDS = ["cpu", "ramGb", "storageGb", "screenInches", "touch", "extras"] as const;

function buildOptions(raw: unknown, kind: "laptop" | "desktop", locked: string[]): Omit<ChatOption, "estimate">[] {
  if (!Array.isArray(raw)) return [];
  const parsed = raw.slice(0, 3).map((o: Record<string, unknown>) => {
    const spec = sanitizeSpec({
      kind,
      cpu: (o.cpu as StoreCpuTier | null) ?? undefined,
      ramGb: (o.ramGb as number | null) ?? undefined,
      storageGb: (o.storageGb as number | null) ?? undefined,
      screenInches: (o.screenInches as number | null) ?? undefined,
      touch: (o.touch as boolean | null) ?? undefined,
      extras: Array.isArray(o.extras) ? (o.extras as string[]) : undefined,
    });
    return {
      label: String(o.label ?? "").slice(0, 60) || "אפשרות",
      kind: (o.kind === "upgrade" || o.kind === "alternative" ? o.kind : "as_requested") as ChatOption["kind"],
      spec,
      specText: "",
      whyBetter: String(o.whyBetter ?? "").slice(0, 500),
    };
  });
  // מה שהלקוח קבע בוודאות - נאכף בקוד: כל אפשרות מקבלת את הערכים הנעולים מהאפשרות הראשונה.
  const base = parsed[0];
  if (base) {
    for (const opt of parsed.slice(1)) {
      for (const f of SPEC_FIELDS) {
        if (locked.includes(f)) (opt.spec as unknown as Record<string, unknown>)[f] = (base.spec as unknown as Record<string, unknown>)[f];
      }
    }
  }
  return parsed.map((o) => ({ ...o, specText: specToText(o.spec) }));
}

export async function advisorChat(history: AdvisorTurn[]): Promise<AdvisorReply> {
  if (!advisorConfigured()) throw new Error("יועץ ה-AI לא מופעל (חסר ANTHROPIC_API_KEY)");
  const userTurns = history.filter((t) => t.role === "user").length;
  if (userTurns === 0) throw new Error("אין הודעה");
  if (userTurns > MAX_USER_TURNS) throw new Error("השיחה ארוכה מדי - אפשר לשלוח את הבקשה או להתחיל שיחה חדשה");

  const last = history[history.length - 1]!;
  // שאלה חוזרת עם תשובה מאושרת: עונים בלי קריאה למודל (עלות 0).
  const faq = await loadFaq();
  const hit = last.role === "user" ? matchFaq(last.content, faq) : null;
  if (hit) {
    const id = hit.entry.id;
    if (id && !id.startsWith("builtin-")) {
      await getAdminFirestore().collection(FAQ_COLLECTION).doc(id).update({ hits: (faq.find((f) => f.id === id)?.hits ?? 0) + 1 }).catch(() => {});
    }
    return { reply: hit.entry.answer, source: "faq", options: [], lockedFields: [], budgetILS: null, notes: "" };
  }

  const messages: Anthropic.MessageParam[] = history.slice(-HISTORY_WINDOW).map((t) => ({ role: t.role, content: t.content.slice(0, 600) }));
  while (messages[0]?.role !== "user") messages.shift();

  const response = await createAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1800,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
    system: [{ type: "text", text: await systemPrompt(), cache_control: { type: "ephemeral" } }],
    messages,
  });
  if (response.stop_reason === "refusal") throw new Error("היועץ לא הצליח להשיב - נסו לנסח אחרת");
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("לא התקבלה תשובה תקינה - נסו שוב");
  }

  const deviceKind = raw.deviceKind === "desktop" ? "desktop" : "laptop";
  const locked = Array.isArray(raw.lockedFields) ? (raw.lockedFields as string[]).map(String) : [];
  const guide = await loadPriceGuide();
  const options: ChatOption[] = buildOptions(raw.options, deviceKind, locked).map((o) => ({ ...o, estimate: estimateRange(o.spec, guide) }));
  const reply = String(raw.reply ?? "").slice(0, 1200);

  const gq = raw.generalQuestion as { question?: string; keywords?: string[] } | null;
  if (gq?.question && options.length === 0) {
    await learnFaq(gq.question, reply, Array.isArray(gq.keywords) ? gq.keywords.map(String) : []).catch(() => {});
  }

  return {
    reply,
    source: "model",
    options,
    lockedFields: locked,
    budgetILS: typeof raw.budgetILS === "number" && raw.budgetILS > 0 ? raw.budgetILS : null,
    notes: String(raw.notes ?? "").slice(0, 500),
  };
}
