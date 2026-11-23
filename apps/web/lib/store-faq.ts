import { getAdminFirestore } from "./firebase-admin";
import type { StoreFaqEntry } from "@ultranet/shared-types";

export const FAQ_COLLECTION = "n_store_faq";

/**
 * שאלות נפוצות שמקורן בנהלי ברירת המחדל - עונות מיד, בלי קריאה למודל. הבעלים רשאי להוסיף ולהסיר נוספות
 * ב-`/dashboard/store/faq`; שאלות שהיועץ עונה עליהן נלמדות אוטומטית וממתינות לאישור.
 */
export const BUILTIN_FAQ: Omit<StoreFaqEntry, "id" | "hits" | "createdAt">[] = [
  {
    question: "יש אחריות?",
    answer:
      "האחריות היא מול היצרן, ולכל יצרן יש בארץ מרכז שירות. אין אחריות על שבר, ואין אחריות על וירוסים שפגעו במחשב.",
    keywords: ["אחריות", "אחריות יצרן", "שבר", "מוחזר", "קלקול"],
    approved: true,
    source: "owner",
  },
  {
    question: "צריך אנטיווירוס?",
    answer:
      "האנטיווירוס המובנה של וינדוס מספיק, לפי הניסיון שלנו. אם הלקוח רוצה אנטיווירוס אחר בתשלום, אפשר להתקין לו רישיון אחר, אבל התשלום עליו במלואו.",
    keywords: ["אנטיווירוס", "אנטי וירוס", "וירוס", "הגנה", "נטפרי"],
    approved: true,
    source: "owner",
  },
  {
    question: "מה עם תוכנות ורישיונות?",
    answer:
      "מתקינים תוכנות בסיס שמותר להתקין על פי החוק. חלק מהתוכנות דורשות רישיון שהלקוח קונה בעצמו, ואנחנו לא מספקים רישיונות. ללקוח שלא מכירים אומרים שהתוכנות מותקנות בלי רישיון.",
    keywords: ["רישיון", "רשיון", "תוכנות", "אופיס", "וורד", "אדובי", "התקנה של תוכנות"],
    approved: true,
    source: "owner",
  },
  {
    question: "כמה זמן לוקח עד שהמחשב מגיע?",
    answer:
      "אחרי סגירת העסקה אנחנו מוציאים משלוח, בדרך כלל באותו יום, והוא מגיע לסניף תוך כמה ימים. כשהמחשב מגיע מכינים אותו ללקוח לפי הדרכות ההתקנה.",
    keywords: ["כמה זמן", "ימים", "משלוח", "מגיע", "לוקח", "זמן אספקה"],
    approved: true,
    source: "owner",
  },
];

const PREFIXES = ["וה", "ה", "ו", "ב", "ל", "מ", "ש", "כ"];
const STOP = new Set(["את", "של", "על", "עם", "זה", "זו", "אם", "או", "גם", "מה", "איך", "יש", "לי", "לו", "אני", "הוא", "היא", "אבל", "כי", "לא", "כן", "אפשר"]);

/** נירמול עברית פשוט לצורך השוואה: בלי ניקוד/פיסוק, בלי אותיות שימוש בתחילית, בלי מילות קישור. */
export function tokens(text: string): string[] {
  return text
    .replace(/[֑-ׇ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      // עד שתי אותיות שימוש בתחילית ("ולוורד" -> "וורד" -> "ורד"), כך ששני הצדדים מנורמלים אותו הדבר
      for (let i = 0; i < 2; i++) {
        const p = PREFIXES.find((x) => w.startsWith(x) && w.length - x.length >= 3);
        if (!p) break;
        w = w.slice(p.length);
      }
      return w;
    })
    .filter((w) => w.length >= 2 && !STOP.has(w));
}

export type FaqMatch = { entry: Pick<StoreFaqEntry, "question" | "answer"> & { id?: string }; score: number };

/**
 * התאמה בין הודעת המשתמש לשאלה נפוצה מאושרת. מחמיר במכוון (עדיף לפנות למודל מאשר לענות לא נכון):
 * רק הודעה קצרה וממוקדת, ורק אם כל מילות המפתח של השאלה כמעט מכסות אותה.
 */
export function matchFaq(
  message: string,
  entries: (Pick<StoreFaqEntry, "question" | "answer" | "keywords" | "approved"> & { id?: string })[],
): FaqMatch | null {
  const msgTokens = tokens(message);
  if (msgTokens.length === 0 || msgTokens.length > 8) return null;
  let best: FaqMatch | null = null;
  for (const e of entries) {
    if (!e.approved) continue;
    const kw = new Set(e.keywords.flatMap((k) => tokens(k)));
    for (const t of tokens(e.question)) kw.add(t);
    if (!kw.size) continue;
    const hits = msgTokens.filter((t) => kw.has(t));
    const coverage = hits.length / msgTokens.length; // כמה מההודעה היא על הנושא
    if (hits.length >= 1 && coverage >= 0.5) {
      const score = coverage + hits.length * 0.05;
      if (!best || score > best.score) best = { entry: e, score };
    }
  }
  return best;
}

export async function loadFaq(): Promise<(StoreFaqEntry & { builtin?: boolean })[]> {
  const snap = await getAdminFirestore().collection(FAQ_COLLECTION).get();
  const stored = snap.docs.map((d) => ({ ...(d.data() as Omit<StoreFaqEntry, "id">), id: d.id }) as StoreFaqEntry);
  const builtin = BUILTIN_FAQ.map((b, i) => ({ ...b, id: `builtin-${i}`, hits: 0, createdAt: "", builtin: true }));
  return [...builtin, ...stored];
}

/** שמירת שאלה שהיועץ ענה עליה, לאישור הבעלים. לא כפילות של שאלה קיימת. */
export async function learnFaq(question: string, answer: string, keywords: string[]): Promise<void> {
  const q = question.trim().slice(0, 200);
  const a = answer.trim().slice(0, 800);
  if (!q || !a) return;
  const existing = await loadFaq();
  const qt = new Set(tokens(q));
  const dup = existing.some((e) => {
    const et = tokens(e.question);
    return et.length > 0 && et.filter((t) => qt.has(t)).length / Math.max(et.length, qt.size) >= 0.7;
  });
  if (dup) return;
  await getAdminFirestore()
    .collection(FAQ_COLLECTION)
    .add({
      question: q,
      answer: a,
      keywords: keywords.map((k) => k.trim()).filter(Boolean).slice(0, 8),
      approved: false,
      source: "ai",
      hits: 0,
      createdAt: new Date().toISOString(),
    } satisfies Omit<StoreFaqEntry, "id">);
}
