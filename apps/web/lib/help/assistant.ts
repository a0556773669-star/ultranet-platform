import Anthropic from "@anthropic-ai/sdk";
import type { HelpScope } from "./knowledge";

/**
 * העוזר החכם של מרכז העזרה: Claude עונה על שאלות "איך עושים" מתוך המדריך שהמשתמש רשאי לראות.
 *
 * פועל רק כש-`ANTHROPIC_API_KEY` מוגדר. בלעדיו מרכז העזרה עובד במצב חיפוש בשאלות הנפוצות
 * בלבד — אין שום תלות קשיחה.
 */
export function assistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type { ChatTurn } from "./types";
import type { ChatTurn } from "./types";

const MODEL = "claude-opus-5-5";

function systemPrompt(scope: HelpScope): string {
  const who =
    scope.audience === "owner"
      ? "המשתמש הוא בעל העסק או המזכירה שעובדת על חשבון הבעלים — יש לו גישה לכל המודולים."
      : "המשתמש הוא שותף שמנהל סניף השכרות של מחשבים ניידים וסטיקים. הוא רואה רק את הסניף שלו ורק את המסכים המתוארים במדריך שלמטה.";
  const faqs = scope.faqs.map((f) => `ש: ${f.question}\nת: ${f.answer}`).join("\n\n");
  return `אתה העוזר של מערכת הניהול "אולטרנט" (חדרי מחשבים, השכרות מחשבים, משרד שיתופי והנהלת חשבונות).
תפקידך: לענות למשתמשי המערכת איך מבצעים בה פעולות.
${who}

כללים:
- ענה בעברית פשוטה וברורה, בגוף שני רבים ("לוחצים", "בוחרים"), כמו מדריך במשרד.
- תן צעדים ממוספרים וקצרים, עם שמות הכפתורים והשדות בדיוק כפי שהם כתובים במדריך, בתוך מירכאות.
- הסתמך רק על המדריך והשאלות הנפוצות שלמטה. אל תמציא כפתורים, מסכים או התנהגויות.
- אם התשובה לא מופיעה במדריך, אמור זאת בכנות והצע לפנות לבעלים/למנהל המערכת.
- אם המשתמש שואל על מסך או פעולה שאינם זמינים לו (לא מופיעים במדריך שלו), הסבר שזה לא בהרשאות שלו ושיפנה לבעלים.
- אין לך גישה לנתונים במערכת (לקוחות, סכומים וכו'). אם שואלים על נתון ספציפי, הסבר איפה רואים אותו במערכת.
- אל תעסוק בנושאים שאינם קשורים לשימוש במערכת; החזר בעדינות לנושא.
- תשובה קצרה ככל האפשר: בדרך כלל עד 8 שורות.

# המדריך לפי מסכים
${scope.guide || "(אין מדריך מסכים למשתמש זה — השתמש בשאלות הנפוצות בלבד)"}

# שאלות נפוצות
${faqs}`;
}

export async function askAssistant(scope: HelpScope, history: ChatTurn[], question: string): Promise<string> {
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.slice(-8).map((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: question },
  ];
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    // עונה על שאלות "איך עושים" מתוך טקסט נתון — לא דורש חשיבה עמוקה.
    output_config: { effort: "low" },
    // אם מסווג בטיחות דוחה בטעות שאלה תמימה, השרת מעביר אותה למודל חלופי באותה קריאה.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // המדריך זהה בכל קריאה של אותו קהל — נשמר במטמון וחוסך את רוב עלות הקלט.
    system: [{ type: "text", text: systemPrompt(scope), cache_control: { type: "ephemeral" } }],
    messages,
  });
  if (response.stop_reason === "refusal") {
    return "לא הצלחתי לענות על השאלה הזו. נסו לנסח אותה אחרת, או פנו לבעלים.";
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  return text || "לא התקבלה תשובה. נסו שוב.";
}
