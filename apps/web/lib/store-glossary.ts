import { getAdminFirestore } from "./firebase-admin";
import type { StoreGlossaryTerm } from "@ultranet/shared-types";

export const GLOSSARY_COLLECTION = "n_store_glossary";

/**
 * מושגי ברירת מחדל ליועץ ה-AI - משמשים רק כל עוד הבעלים לא הגדיר מושגים משלו ב-`/dashboard/store/glossary`.
 * "חידושי תורה" ו"גרפיקה" לפי הנחיית הבעלים; השאר הצעות שהבעלים רשאי לערוך או למחוק.
 */
export const DEFAULT_GLOSSARY: Omit<StoreGlossaryTerm, "id" | "active">[] = [
  {
    term: "חידושי תורה / כתיבת ספרים",
    guidance: "שימוש בסיסי בלבד: Word, כתיבה וקריאה. לא צריך מחשב חזק. מעבד i3, זיכרון 8GB מספיק. אל תשאל על תוכנות כבדות.",
  },
  {
    term: "גרפיקה / עיצוב",
    guidance:
      "שימוש כבד. לשאול: איזו איכות מסך צריך (דיוק צבעים, רזולוציה גבוהה) ולהסביר בפשטות למה זה משנה; באילו תוכנות עובד; ומה התקציב. מעבד i5 לפחות, זיכרון 16GB לפחות.",
  },
  {
    term: "מיילים, גוגל, Chrome",
    guidance: "שימוש בסיסי. אפשר מחשב פשוט. אם זה כל מה שהוא צריך - לא להציע מפרט גבוה.",
  },
  {
    term: "הנהלת חשבונות / משרד",
    guidance: "שימוש משרדי: Excel כבד וכמה תוכנות פתוחות במקביל. מעבד i5, זיכרון 16GB. לשאול אם יש מסך נוסף או מקלדת מספרים.",
  },
  {
    term: "עריכת וידאו",
    guidance: "שימוש כבד. לשאול על איכות המסך ועל נפח אחסון (קבצים גדולים), ומה התקציב. מעבד i7, זיכרון 16GB ומעלה.",
  },
];

export async function loadGlossary(): Promise<{ term: string; guidance: string }[]> {
  const snap = await getAdminFirestore().collection(GLOSSARY_COLLECTION).get();
  const terms = snap.docs
    .map((d) => ({ ...(d.data() as Omit<StoreGlossaryTerm, "id">), id: d.id }) as StoreGlossaryTerm)
    .filter((t) => t.active !== false && t.term && t.guidance);
  return terms.length ? terms.map((t) => ({ term: t.term, guidance: t.guidance })) : DEFAULT_GLOSSARY;
}
