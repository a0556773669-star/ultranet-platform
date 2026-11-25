import Anthropic from "@anthropic-ai/sdk";
import type { StoreCpuTier, StoreSpec } from "@ultranet/shared-types";
import { anthropicConfigured, createAnthropic } from "./anthropic-client";
import { getAdminFirestore } from "./firebase-admin";
import {
  DEFAULT_MIN_GENERATION,
  USAGE_OPTIONS,
  sanitizeSpec,
  specToText,
} from "./store-wizard";
import { loadGlossary } from "./store-glossary";
import { FAQ_COLLECTION, learnFaq, loadFaq, matchFaq } from "./store-faq";
import { priceOptions } from "./store-live-price";
import {
  guideForPrompt,
  loadPriceGuide,
  recordDemand,
  type PriceEstimate,
} from "./store-price-guide";

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
  /** משפט אחד: במה האפשרות הזו שונה/טובה */
  whyBetter: string;
  /** יתרונות וחסרונות קצרים (+/-) להסבר ללקוח */
  pros: string[];
  cons: string[];
  /** טווח הערכה מהמחירון היומי (מחושב בקוד, מיידי). null = אין במחירון בסיס למפרט הזה */
  estimate: PriceEstimate | null;
};

export type AdvisorReply = {
  reply: string;
  /** "faq" = נענה מהשאלות הנפוצות בלי קריאה למודל */
  source: "model" | "faq";
  /** הלקוח קבע הכול - הצעה אחת במחיר אחד */
  finalOffer?: boolean;
  options: ChatOption[];
  /** תשובות מוכנות ללחיצה (כמו בצ'אט), כשהשאלה סגורה: ["נייד", "נייח"] */
  quickReplies: string[];
  lockedFields: string[];
  budgetILS: number | null;
  notes: string;
  /** רמז לבעלים בלבד כשאין מחירים (למשל מחירון ריק) */
  ownerHint?: string;
};

const nullable = (schema: Record<string, unknown>) => ({
  anyOf: [schema, { type: "null" }],
});

const OPTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "label",
    "kind",
    "cpu",
    "ramGb",
    "storageGb",
    "screenInches",
    "touch",
    "extras",
    "monitorInches",
    "monitorNote",
    "wireless",
    "bagInches",
    "bagNote",
    "whyBetter",
    "pros",
    "cons",
  ],
  properties: {
    label: { type: "string" },
    kind: { type: "string", enum: ["as_requested", "upgrade", "alternative"] },
    cpu: nullable({ type: "string", enum: ["i3", "i5", "i7"] }),
    ramGb: nullable({ type: "integer" }),
    storageGb: nullable({ type: "integer" }),
    screenInches: nullable({ type: "number" }),
    touch: nullable({ type: "boolean" }),
    extras: { type: "array", items: { type: "string" } },
    monitorInches: nullable({ type: "number" }),
    monitorNote: nullable({ type: "string" }),
    wireless: nullable({ type: "boolean" }),
    bagInches: nullable({ type: "number" }),
    bagNote: nullable({ type: "string" }),
    whyBetter: { type: "string" },
    pros: { type: "array", items: { type: "string" } },
    cons: { type: "array", items: { type: "string" } },
  },
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "reply",
    "deviceKind",
    "options",
    "quickReplies",
    "lockedFields",
    "budgetILS",
    "notes",
    "generalQuestion",
    "finalOffer",
  ],
  properties: {
    reply: { type: "string" },
    /** true = הלקוח קבע את כל הפרטים - מציעים הצעה אחת בלבד במחיר אחד */
    finalOffer: { type: "boolean" },
    deviceKind: nullable({ type: "string", enum: ["laptop", "desktop"] }),
    options: { type: "array", items: OPTION_SCHEMA },
    quickReplies: { type: "array", items: { type: "string" } },
    lockedFields: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "cpu",
          "ramGb",
          "storageGb",
          "screenInches",
          "touch",
          "extras",
          "monitorInches",
          "wireless",
        ],
      },
    },
    budgetILS: nullable({ type: "integer" }),
    notes: { type: "string" },
    generalQuestion: nullable({
      type: "object",
      additionalProperties: false,
      required: ["question", "keywords"],
      properties: {
        question: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
      },
    }),
  },
} as const;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function proceduresText(): Promise<string> {
  const snap = await getAdminFirestore().collection("n_procedures").get();
  const items = snap.docs
    .map(
      (d) =>
        d.data() as {
          title?: string;
          content?: string;
          status?: string;
          audience?: { mode?: string };
        },
    )
    .filter(
      (p) =>
        p.audience?.mode === "store" && (p.status ?? "active") === "active",
    )
    .map((p) => `# ${p.title}\n${stripHtml(p.content ?? "")}`);
  return items.join("\n\n").slice(0, 4500);
}

async function systemPrompt(): Promise<string> {
  const [glossary, procedures, faq, guide] = await Promise.all([
    loadGlossary(),
    proceduresText(),
    loadFaq(),
    loadPriceGuide(),
  ]);
  const usage = USAGE_OPTIONS.map(
    (u) => `- ${u.key}: ${u.label} (${u.hint})`,
  ).join("\n");
  const faqText = faq
    .filter((f) => f.approved)
    .slice(0, 25)
    .map((f) => `ש: ${f.question}\nת: ${f.answer}`)
    .join("\n\n");
  return `אתה יועץ בצ'אט של "אולטרנט" שעוזר למנהל סניף להתאים מחשב ללקוח. מנהל הסניף מקליד מה הלקוח אומר.
סגנון: צ'אט טבעי, קצר וידידותי, בעברית פשוטה ומכבדת. לא טופס ולא רשימת שאלות ארוכה.

איך עובדים (חשוב - המטרה: ללקוח יוצאת הצעה **אחת** שמתאימה לו בדיוק, לא אלף אפשרויות. לכן מבררים הכול עד הסוף לפני שמציעים):
1. הבנת הלקוח: למה הוא צריך את המחשב ואם יש עוד שימושים (גם כשהשימוש נשמע בסיסי, כמו חידושי תורה - ברר אם יש עוד, כדי לא להציע מחשב חלש מדי).
2. שאל **את כל השאלות הרלוונטיות** לפני שאתה מציע, בהודעות קצרות של 2-3 שאלות (כל שאלה בשורה נפרדת, ממוספרת א. ב. ג.). דלג על מה שכבר נענה. אל תשאל פעמיים על אותו דבר. סדר: נייד/נייח ושימוש, אחר כך פרטי המחשב, אחר כך ציוד נלווה, ובסוף תקציב.
3. **נייד** - ברר: גודל מסך (14 קטן וקל / 15.6 הקלאסי / 17 גדול), **נפח אחסון** (256 / 512 / טרה - הסבר בקצרה: כמה ספרים, קבצים ותמונות), **מסך מגע או לא**, ו**תיק**: האם הלקוח רוצה תיק למחשב ואיזה גודל. אם הלקוח כבר אמר זיכרון/מעבד - אל תשאל שוב.
4. **נייח** - ברר: האם צריך **מסך** (אם כן: איזה גודל באינצ'ים, למשל 22/24/27, והאם יש **בקשה מיוחדת למסך** - מגן עיניים/נגד סינוור, מט, צבעים מדויקים וכו'), האם צריך **מקלדת ועכבר**, והאם **אלחוטיים או חוטיים**, והאם צריך עוד (סטיק רשת, רמקולים). אל תנחש - שאל.
5. תקציב: שאל פעם אחת בעדינות. אם הלקוח נמנע או אמר "הכי זול" או "לא משנה" - אל תשאל שוב; בפריט שהוא אמר עליו "לא משנה" - בחר ברירת מחדל סבירה לפי השימוש והמשך.
6. **תיק לנייד:** תיק לגדלים הקלאסיים (15 / 15.6 / 16 אינץ') עולה **50 ₪ קבוע, בלי רווח** - extras כולל "תיק" ו-bagInches בגודל. תיק ל-14 אינץ' או תיק מסוים/ספציפי (דגם, סוג, צבע) - extras כולל "תיק", bagInches הגודל, ו-bagNote תיאור הבקשה; המחיר ייבדק ללא רווח (אל תציין מחיר). אם הלקוח לא רוצה תיק - אל תוסיף.
7. **נייח:** כשיש מסך - extras כולל "מסך", monitorInches גודל, monitorNote לבקשה מיוחדת (null אם אין). מקלדת ועכבר - extras כולל "מקלדת" ו"עכבר" (שניהם), ו-wireless true/false. סטיק/רמקולים - ב-extras בשמם.
8. **הצעה:** כשסיימת לברר (או שהלקוח אמר "תחליט")  החזר אפשרויות בשדה options. **כשהלקוח קבע בעצמו את כל הפרטים העיקריים** (למשל "אני רוצה i5, 16 ג'יגה, 512, 15.6, בלי מגע, עם תיק") - החזר finalOffer=true ו**אפשרות אחת בלבד** (as_requested) שכוללת את כל מה שביקש: זו הצעה אחת במחיר אחד. כשהלקוח לא קבע הכול - הצע 2 או 3 אפשרויות: as_requested = ההתאמה הבסיסית, upgrade = טיפה יותר טוב, alternative = חלופה חסכונית. לכל אפשרות: whyBetter = משפט אחד במה היא שונה, pros עד 3, cons עד 2 - בעברית פשוטה, כדי שמנהל הסניף יוכל להסביר ללקוח.
9. אל תציין מחירים בטקסט: המערכת מחשבת ומוסיפה מחיר לכל אפשרות. אל תכתוב בעצמך את המחירים ואל תסיים בשאלה על התקדמות. כבד תקציב שהלקוח אמר.
10. שדה ב-lockedFields רק אם הלקוח אמר אותו במפורש. את מה שנעול אל תשנה באף אפשרות; שדרוג רק בשדות שלא ננעלו.
11. דור המעבד: ${DEFAULT_MIN_GENERATION} ומעלה כברירת מחדל. אל תשאל על זה.
12. שאלות כלליות (אחריות, אנטיווירוס, רישיונות, זמני אספקה ועוד): ענה לפי הנהלים והשאלות הנפוצות שלמטה, והחזר ב-generalQuestion את השאלה וכמה מילות מפתח. אל תמציא; אם אין תשובה - אמור שיפנה להנהלה. במקרה כזה options ריק.
13. אל תעסוק בנושאים שאינם קשורים למחשבים והחנות.
14. quickReplies: רק כששאלתך היא שאלה סגורה **אחת** (למשל "נייד או נייח?" או "אלחוטיים או חוטיים?") - החזר 2 עד 4 תשובות קצרות ללחיצה. בהודעה עם כמה שאלות או בשאלה פתוחה - רשימה ריקה.
15. כל עוד אתה עדיין מבקש מידע - options ריק. כל פעם שאתה מציע אפשרויות חדשות או מעודכנות - החזר את כולן שוב.

ערכי שימוש: 
${usage}
מפרט אפשרי: cpu: i3/i5/i7 · ramGb: 8/16/32 · storageGb: 256/512/1000/2000 · screenInches: 14/15.6/17 · extras אפשריים: מסך, מקלדת, עכבר, סטיק, רמקולים, תיק.

מושגים שהבעלים הגדיר:
${glossary.map((g) => `- ${g.term}: ${g.guidance}`).join("\n")}

מחירון שוק (לשיקולי תקציב בלבד):
${guideForPrompt(guide)}

נהלי החנות:
${procedures || "(אין נהלים)"}

שאלות נפוצות:
${faqText || "(אין)"}`;
}

/** ממפה טקסט חופשי של ציוד נלווה לשמות הקבועים (מסך / מקלדת / עכבר / סטיק / רמקולים / תיק), ומחלץ גודל מסך ואלחוטי. */
export function canonicalizeExtras(spec: StoreSpec): {
  extras: string[];
  monitorInches?: number;
  wireless?: boolean;
} {
  const out = new Set<string>();
  let monitorInches: number | undefined;
  let wireless: boolean | undefined;
  for (const raw of spec.extras ?? []) {
    const e = raw.trim();
    if (e.includes("מסך")) {
      out.add("מסך");
      const m = e.match(/(\d{2}(?:\.\d)?)/);
      if (m) monitorInches = Number(m[1]);
    } else if (e.includes("מקלדת") && e.includes("עכבר")) {
      out.add("מקלדת");
      out.add("עכבר");
    } else if (e.includes("מקלדת")) out.add("מקלדת");
    else if (e.includes("עכבר")) out.add("עכבר");
    else if (
      e.includes("סטיק") ||
      e.includes("רשת") ||
      e.toLowerCase().includes("wifi")
    )
      out.add("סטיק");
    else if (e.includes("רמקול")) out.add("רמקולים");
    else if (e.includes("תיק")) out.add("תיק");
    else out.add(e);
    if (e.includes("אלחוט")) wireless = true;
    else if (e.includes("חוטי")) wireless = false;
  }
  return { extras: [...out], monitorInches, wireless };
}

const SPEC_FIELDS = [
  "cpu",
  "ramGb",
  "storageGb",
  "screenInches",
  "touch",
  "extras",
  "monitorInches",
  "monitorNote",
  "wireless",
  "bagInches",
  "bagNote",
] as const;

function buildOptions(
  raw: unknown,
  kind: "laptop" | "desktop",
  locked: string[],
): Omit<ChatOption, "estimate">[] {
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
      monitorInches: (o.monitorInches as number | null) ?? undefined,
      monitorNote: (o.monitorNote as string | null) ?? undefined,
      wireless: (o.wireless as boolean | null) ?? undefined,
      bagInches: (o.bagInches as number | null) ?? undefined,
      bagNote: (o.bagNote as string | null) ?? undefined,
    });
    // נרמול: המודל לפעמים כותב טקסט חופשי ("מסך 27 אינץ", "מקלדת אלחוטית") - מתורגם לשמות הקבועים כדי שיתומחר
    const canon = canonicalizeExtras(spec);
    spec.extras = canon.extras;
    if (canon.monitorInches !== undefined && spec.monitorInches === undefined)
      spec.monitorInches = canon.monitorInches;
    if (canon.wireless !== undefined && spec.wireless === undefined)
      spec.wireless = canon.wireless;
    // תיק רק בנייד, ומסך/אלחוטי רק בנייח - ניקוי שדות שלא רלוונטיים
    if (kind === "desktop") {
      delete spec.bagInches;
      delete spec.bagNote;
      spec.extras = spec.extras?.filter((e) => e !== "תיק");
    } else {
      delete spec.monitorInches;
      delete spec.monitorNote;
      spec.extras = spec.extras?.filter((e) => e !== "מסך");
    }
    return {
      label: String(o.label ?? "").slice(0, 60) || "אפשרות",
      kind: (o.kind === "upgrade" || o.kind === "alternative"
        ? o.kind
        : "as_requested") as ChatOption["kind"],
      spec,
      specText: "",
      whyBetter: String(o.whyBetter ?? "").slice(0, 500),
      pros: (Array.isArray(o.pros) ? (o.pros as unknown[]) : [])
        .map((x) => String(x).slice(0, 90))
        .slice(0, 3),
      cons: (Array.isArray(o.cons) ? (o.cons as unknown[]) : [])
        .map((x) => String(x).slice(0, 90))
        .slice(0, 2),
    };
  });
  // מה שהלקוח קבע בוודאות - נאכף בקוד: כל אפשרות מקבלת את הערכים הנעולים מהאפשרות הראשונה.
  const base = parsed[0];
  if (base) {
    for (const opt of parsed.slice(1)) {
      for (const f of SPEC_FIELDS) {
        // ציוד נלווה שהלקוח ביקש (תיק/מסך/אלחוטי) נשאר בכל האפשרויות
        if (
          locked.includes(f) ||
          [
            "extras",
            "monitorInches",
            "monitorNote",
            "wireless",
            "bagInches",
            "bagNote",
          ].includes(f)
        )
          (opt.spec as unknown as Record<string, unknown>)[f] = (
            base.spec as unknown as Record<string, unknown>
          )[f];
      }
    }
  }
  return parsed.map((o) => ({ ...o, specText: specToText(o.spec) }));
}

export async function advisorChat(
  history: AdvisorTurn[],
  isOwner = false,
): Promise<AdvisorReply> {
  if (!advisorConfigured())
    throw new Error("יועץ ה-AI לא מופעל (חסר ANTHROPIC_API_KEY)");
  const userTurns = history.filter((t) => t.role === "user").length;
  if (userTurns === 0) throw new Error("אין הודעה");
  if (userTurns > MAX_USER_TURNS)
    throw new Error(
      "השיחה ארוכה מדי - אפשר לשלוח את הבקשה או להתחיל שיחה חדשה",
    );

  const last = history[history.length - 1]!;
  // שאלה חוזרת עם תשובה מאושרת: עונים בלי קריאה למודל (עלות 0).
  const faq = await loadFaq();
  const hit = last.role === "user" ? matchFaq(last.content, faq) : null;
  if (hit) {
    const id = hit.entry.id;
    if (id && !id.startsWith("builtin-")) {
      await getAdminFirestore()
        .collection(FAQ_COLLECTION)
        .doc(id)
        .update({ hits: (faq.find((f) => f.id === id)?.hits ?? 0) + 1 })
        .catch(() => {});
    }
    return {
      reply: hit.entry.answer,
      source: "faq",
      options: [],
      quickReplies: [],
      lockedFields: [],
      budgetILS: null,
      notes: "",
    };
  }

  const messages: Anthropic.MessageParam[] = history
    .slice(-HISTORY_WINDOW)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 600) }));
  while (messages[0]?.role !== "user") messages.shift();

  const response = await createAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1800,
    output_config: {
      effort: "low",
      format: {
        type: "json_schema",
        schema: SCHEMA as unknown as Record<string, unknown>,
      },
    },
    system: [
      {
        type: "text",
        text: await systemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });
  if (response.stop_reason === "refusal")
    throw new Error("היועץ לא הצליח להשיב - נסו לנסח אחרת");
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
  const locked = Array.isArray(raw.lockedFields)
    ? (raw.lockedFields as string[]).map(String)
    : [];
  const guide = await loadPriceGuide();
  const finalOffer = raw.finalOffer === true;
  // הצעה אחת במחיר אחד כשהלקוח קבע הכול (נאכף בקוד, לא רק בהנחיה)
  const built = buildOptions(raw.options, deviceKind, locked);
  const kept = finalOffer ? built.slice(0, 1) : built;
  // מחיר מאומת מול השוק (מטמון 24 שעות); נפילה למחירון אם החיפוש לא חזר בזמן
  const priced0 = kept.length
    ? await priceOptions(
        kept.map((o) => o.spec),
        guide,
      )
    : null;
  const options: ChatOption[] = kept.map((o, i) => ({
    ...o,
    estimate: priced0?.estimates[i] ?? null,
  }));
  let reply = String(raw.reply ?? "").slice(0, 1500);
  let ownerHint: string | undefined;
  if (options.length) {
    // ביקוש: נרשם פעם אחת לשיחה (בהצעה הראשונה), לפי האפשרות הראשונה = מה שהלקוח ביקש. מזין את הסריקה הלילית.
    const alreadyProposed = history.some(
      (t) =>
        t.role === "assistant" &&
        (t.content.includes("טווחי מחיר") ||
          t.content.includes("המחיר יימסר אחרי בדיקה") ||
          t.content.includes("ההצעה ללקוח")),
    );
    if (!alreadyProposed) await recordDemand(options[0]!.spec);
    // הכיוון + טווחי המחיר + השאלה אם להתקדם - מורכבים בקוד, כך שהם תמיד מדויקים ובלי עלות מודל
    const priced = options.filter((o) => o.estimate);
    const single = options.length === 1 && finalOffer;
    const money = (n: number) => n.toLocaleString("he-IL");
    const lineFor = (o: ChatOption) => {
      const e = o.estimate!;
      const inc = e.accessories.length
        ? ` (כולל ${e.accessories.map((a) => a.name).join(", ")})`
        : "";
      return `• ${o.label}: בערך ${money(e.totalFromILS)}-${money(e.totalToILS)} ₪${inc}`;
    };
    // מה **לא** כלול במחיר (אין לו מחיר במחירון) - נאמר במפורש, כדי שהמחיר לא ייראה סופי כשהוא חלקי
    const pendingLines = [
      ...new Set(priced.flatMap((o) => o.estimate!.pending.map((p) => p.text))),
    ];
    const notIncluded = pendingLines.length
      ? `\n\nלא כלול במחיר (ייבדק בנפרד): ${pendingLines.join("; ")}`
      : "";
    const uncertain = priced0?.uncertain
      ? "\n\nשימו לב: לא הצלחנו לאמת את המחיר מול חנות כרגע, לכן זו הערכה זהירה (טווח מורחב כלפי מעלה) והבעלים יאשר את המחיר בבדיקת המלאי."
      : "";
    if (single && priced.length) {
      const e = priced[0]!.estimate!;
      const inc = e.accessories.length
        ? ` (כולל ${e.accessories.map((a) => a.name).join(", ")})`
        : "";
      reply += `\n\nההצעה ללקוח: ${priced[0]!.label}\nמחיר: ${money(e.finalILS)} ₪${e.pending.length ? ` ${inc.trim()}`.trimEnd() : ` - כולל את כל מה שביקש${inc}`}${notIncluded}${uncertain}`;
      reply += `\n(הערכה לפי מחירי השוק - המחיר הסופי נקבע אחרי בדיקת מלאי.)\n\nהאם הלקוח מעוניין שנתקדם לבדיקת מלאי?`;
    } else if (priced.length) {
      reply += `\n\nטווחי מחיר (הערכה לפי מחירי השוק, לא מחיר סופי):\n${priced.map(lineFor).join("\n")}${notIncluded}${uncertain}\n\nהאם הלקוח מעוניין שנתקדם לבדיקת מלאי?`;
    } else {
      reply +=
        "\n\nהמחיר יימסר אחרי בדיקה. האם הלקוח מעוניין שנתקדם לבדיקת מלאי?";
    }
    if (!priced.length && isOwner) {
      ownerHint =
        Object.keys(guide.laptopBase).length ||
        Object.keys(guide.desktopBase).length
          ? "אין במחירון בסיס למפרט הזה"
          : 'מחירון השוק ריק. היכנסו ל"מחירון שוק" ולחצו על המילוי האוטומטי ואז שמירה (או חכו לריענון היומי)';
    }
  }

  const gq = raw.generalQuestion as {
    question?: string;
    keywords?: string[];
  } | null;
  if (gq?.question && options.length === 0) {
    await learnFaq(
      gq.question,
      reply,
      Array.isArray(gq.keywords) ? gq.keywords.map(String) : [],
    ).catch(() => {});
  }

  return {
    reply,
    source: "model",
    finalOffer: finalOffer && options.length === 1,
    options,
    ownerHint,
    quickReplies: (Array.isArray(raw.quickReplies)
      ? (raw.quickReplies as unknown[])
      : []
    )
      .map((x) => String(x).slice(0, 40))
      .slice(0, 4),
    lockedFields: locked,
    budgetILS:
      typeof raw.budgetILS === "number" && raw.budgetILS > 0
        ? raw.budgetILS
        : null,
    notes: String(raw.notes ?? "").slice(0, 500),
  };
}
