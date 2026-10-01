import type { HelpFaq } from "./types";

// ---------------------------------------------------------------------------------------------
// חיפוש מקומי — עובד תמיד, גם בלי מפתח AI, וגם כהצעות מיידיות בזמן ההקלדה.

const PREFIXES = ["וכש", "וש", "וה", "וב", "ול", "ומ", "שה", "שב", "של", "כש", "מה", "לה", "בה", "ו", "ה", "ב", "ל", "מ", "ש", "כ"];
const STOP = new Set(["איך", "מה", "את", "של", "על", "עם", "אני", "יש", "לא", "זה", "או", "גם", "אם", "כדי", "איפה", "למה", "מתי", "צריך", "רוצה", "אפשר", "עושים", "לעשות", "כל", "הוא", "היא"]);

function stems(word: string): string[] {
  const w = word.replace(/[^֐-׿a-zA-Z0-9]/g, "").replace(/[֑-ׇ]/g, "");
  if (w.length < 2) return [];
  const out = new Set([w]);
  for (const p of PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= 2) out.add(w.slice(p.length));
  }
  // סיומות רבים נפוצות
  for (const s of ["ים", "ות"]) {
    for (const x of [...out]) if (x.endsWith(s) && x.length > 3) out.add(x.slice(0, -2));
  }
  return [...out];
}

function tokens(text: string): Set<string> {
  const set = new Set<string>();
  for (const word of text.toLowerCase().split(/[\s,.;:!?"'()\-–/]+/)) {
    if (STOP.has(word)) continue;
    for (const s of stems(word)) set.add(s);
  }
  return set;
}

export type FaqMatch = { faq: HelpFaq; score: number };

export function searchFaqs(faqs: HelpFaq[], query: string, limit = 5): FaqMatch[] {
  const q = tokens(query);
  if (q.size === 0) return [];
  const scored = faqs.map((faq) => {
    const qt = tokens(faq.question);
    const tt = tokens(faq.tags.join(" "));
    const at = tokens(faq.answer);
    let score = 0;
    for (const t of q) {
      if (qt.has(t)) score += 3;
      if (tt.has(t)) score += 2;
      if (at.has(t)) score += 0.5;
    }
    // ביטוי מלא מתוך התגיות שמופיע בשאלה — אות חזק במיוחד
    for (const tag of faq.tags) if (tag.length > 2 && query.includes(tag)) score += 3;
    return { faq, score: score / Math.sqrt(q.size) };
  });
  return scored
    .filter((m) => m.score >= 1.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** קבוצות תצוגה לרשימת השאלות במסך העזרה. */
export const MODULE_LABELS: Record<string, string> = {
  login: "התחברות",
  home: "דף הבית",
  users: "משתמשים והרשאות",
  computers: "חדרי מחשבים",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
  accounting: "הנה\"ח",
  duxus: "משימות ונהלים",
  shop: "חנות AI",
  tutorials: "הדרכות",
};
