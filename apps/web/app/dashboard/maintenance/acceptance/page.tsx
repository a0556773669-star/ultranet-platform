import Link from "next/link";
import { AlertTriangle, ArrowRight, ClipboardCheck } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { AcceptanceChecklist, type AcceptanceSection } from "./acceptance-client";

/**
 * בדיקת קבלה לפני מעבר (מסמך המשך סעיף 40; אפיון בסיס סעיף 14, פריטים 5–7) — לבעלים/מזכירה.
 *
 * רשימה סטטית של פעולות מייצגות להשוואה מול המערכת הקודמת והנתונים. **המסך לא קורא ולא כותב
 * שום נתון**: סימוני ה-V נשמרים בדפדפן בלבד. הבדיקה נעשית על פעולות אמיתיות שקורות ממילא
 * (או בסביבת בדיקה) — אין ליצור עסקאות דמה בנתוני אמת.
 */
const SECTIONS: AcceptanceSection[] = [
  {
    key: "compare",
    title: "השוואה כללית מול המערכת הקודמת",
    items: [
      { id: "compare-records", text: "אותן רשומות ואותם מזהים: לקוחות, השכרות פעילות, ציוד לפי סניף — אותה כמות בשתי המערכות." },
      { id: "compare-links", text: "קשרים נשמרו: השכרה ← לקוח ← פריט ← סניף; שותפויות ואחוזים בכל סניף." },
      { id: "compare-money", text: "סכומי הנה\"ח, חובות ותשלומים זהים. הבדל מותר רק מכלל עסקי חדש שאושר — עם הסבר מספרי." },
      { id: "compare-history", text: "היסטוריות (השכרות שהוחזרו, תשלומים, העברות) מופיעות כמו קודם." },
    ],
  },
  {
    key: "rentals",
    title: "השכרות",
    items: [
      { id: "rent-existing", text: "השכרה חדשה ללקוח קיים — מופיעה בפעילות, הלקוח והפריט נכונים." },
      { id: "rent-new", text: "השכרה חדשה עם לקוח חדש — הלקוח נוצר פעם אחת, בלי כפילות." },
      { id: "return-unpaid", text: "החזרה ללא תשלום — ההשכרה עוברת לחובות, הסכום נכון." },
      { id: "return-methods", text: "החזרה עם תשלום — בכל אמצעי מורשה (מזומן, העברה, אשראי…), נרשם בהנה\"ח כמו במערכת הקודמת." },
    ],
  },
  {
    key: "pricing",
    title: "מחירון",
    items: [
      { id: "price-active", text: "עדכון מחיר: השכרה פעילה נשארת במחיר המקורי." },
      { id: "price-new", text: "השכרה שנפתחה אחרי העדכון מקבלת את המחיר החדש." },
      { id: "price-history", text: "השכרות היסטוריות לא משתנות." },
    ],
  },
  {
    key: "repair",
    title: "מחשב בתיקון",
    items: [
      { id: "repair-full", text: "תקופת תיקון של חודש מלא ושל חלק מחודש — מוצגת נכון." },
      { id: "repair-overlap", text: "תקופות חופפות ואפס זמינות — אין כפל ואין חלוקה באפס." },
      { id: "repair-block", text: "מחשב בתיקון לא מוצע להשכרה חדשה, והשכרה פעילה לא נפגעת." },
    ],
  },
  {
    key: "transfers",
    title: "העברות והוצאות",
    items: [
      { id: "transfer-monthly", text: "העברה חודשית — הסכום משויך לחודש הנכון ונספר פעם אחת בלבד." },
      { id: "transfer-multi", text: "העברה רב־חודשית / חלקית / יתרה קודמת — נספרת פעם אחת, היתרה נכונה." },
      { id: "recurring", text: "הוצאות חוזרות (קבועות וקבועות משתנות) — מופיעות בחודש הנכון ובסכום הנכון." },
    ],
  },
  {
    key: "perms",
    title: "הרשאות — בחשבון בעל סניף",
    items: [
      { id: "perm-search", text: "חיפוש כללי מחזיר רק לקוחות/ציוד של הסניף שלו." },
      { id: "perm-links", text: "קישור ישיר למסך/רשומה של סניף אחר — נחסם." },
      { id: "perm-export", text: "יצוא (אקסל/דו\"ח) כולל רק את הסניף שלו." },
      { id: "perm-content", text: "נהלים והדרכות — רואה רק את מה שהוגדר לו; נהלים פנימיים לא גלויים." },
      { id: "perm-owner", text: "בעלים ומזכירה — רואים ועושים את מה שעשו במערכת הקודמת, לא פחות ולא יותר." },
    ],
  },
];

export default async function AcceptancePage() {
  const session = await requireOwner();

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <ClipboardCheck className="h-5 w-5" />
          בדיקת קבלה לפני מעבר
        </h1>
        <Link href="/dashboard/maintenance" className="btn-outline flex items-center gap-1.5">
          <ArrowRight className="h-4 w-4" />
          לבדיקת נתונים
        </Link>
      </div>

      <div className="flex gap-2 rounded-card border-2 border-amber-400 bg-amber-50 p-3 text-[13px] text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <div className="font-extrabold">אין ליצור עסקאות דמה בנתוני אמת.</div>
          <div className="mt-0.5 leading-relaxed">
            בודקים על פעולות אמיתיות שקורות ממילא בעבודה, או בסביבת בדיקה — ומשווים את התוצאה למערכת הקודמת. הרשימה
            הזו לא קוראת ולא משנה שום נתון; הסימונים נשמרים רק בדפדפן הזה.
          </div>
        </div>
      </div>

      <AcceptanceChecklist email={session.user?.email ?? ""} sections={SECTIONS} />
    </div>
  );
}
