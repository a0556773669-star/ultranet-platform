import Link from "next/link";

/**
 * ניווט ההנה"ח הראשית — שני מסכים.
 *
 * הגרסה המקורית החזיקה חמש-עשרה לשוניות, ורובן היו דרכים שונות להזין או להסיק את אותו
 * שקל: מודל תנועות, ספר תזרים, מזכר הוני, בדיקת שלמות, מדיניות, רכש ומלאי. כולן ניסו
 * לענות על שאלה אחת - האם הסכום הזה שייך לספר הראשי - וכל אחת ענתה עליה אחרת.
 *
 * עכשיו התשובה היא דגל שמישהו סימן (`countsToMain`), והמסכים שנשארו הם רק המקומות
 * שבהם באמת קורה משהו: הספר עצמו, והניידים.
 *
 * "מעקב סניפים ניידים" ו"העברות חודשיות" היו כאן שתי לשוניות ואוחדו ללשונית אחת, "ניידים"
 * (2026-09): שתיהן ענו על אותה שאלה מזוויות שונות — כמה סניף מרוויח לי, וכמה הוא חייב לי
 * בסוף החודש — ומעבר בין לשוניות כדי להצליב ביניהן הבטיח שמסתכלים רק על אחת. שתי הכתובות
 * הישנות נשארו כהפניה.
 *
 * "עדכון רטרואקטיבי" הייתה כאן לשונית והוסרה: היא נולדה כמסך חד-פעמי להחליט על דאטה
 * שנרשם לפני שהדגל היה קיים, וההחלטה הזו כבר התקבלה. הדגל נערך היכן שרושמים את ההוצאה,
 * ומסך שכל תפקידו היה מעבר חד-פעמי הוא מכאן והלאה עוד מקום שאפשר לשנות בו סכומים בטעות.
 *
 * "רכישות חוזרות" הייתה כאן לשונית והוסרה: מוצר שקונים שוב ושוב הוא לא מודול אלא
 * **סימון על ההוצאה עצמה** (`expenseTypeId`), והחיבור בין הקניות מוצג ליד ההוצאות בכל
 * מודול.
 *
 * "הוצאות נוספות" הייתה כאן לשונית והוסרה (2026-09): כל מה שהיה בה — רכישות חד-פעמיות,
 * הוצאות קבועות של העסק, הוצאות קבועות משתנות וסיכום הרכישות החוזרות — נמצא היום ב"ראשי"
 * עצמו, כארבע מהטבלאות שבסרגל שלו וכשני סוגים בחלון "הוספת הוצאה". לשונית שנייה לאותו
 * דאטה היא רק עוד מקום שצריך לזכור להיכנס אליו.
 */
const TABS = [
  { href: "/dashboard/accounting", label: "ראשי" },
  { href: "/dashboard/accounting/mobile", label: "ניידים" },
];

export function AccountingTabs({ active }: { active: string }) {
  // "הגדרות גבייה" הוא קישור צדדי ולא לשונית - נכנסים אליו כדי להגדיר ספק סליקה, לא כדי
  // לקרוא מספר - אבל כשעומדים בו הוא כן צריך להידלק, אחרת אין במסך שום סימן איפה אנחנו.
  const routesActive = active.startsWith("/dashboard/accounting/routes");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-xl border border-card-border bg-white p-1">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={
              t.href === active
                ? "rounded-lg bg-teal-bg px-3 py-1.5 text-[13px] font-bold text-teal-dark"
                : "rounded-lg px-3 py-1.5 text-[13px] font-bold text-muted transition hover:bg-gray-100"
            }
          >
            {t.label}
          </Link>
        ))}
      </div>
      <Link
        href="/dashboard/accounting/routes"
        className={`whitespace-nowrap rounded-lg border bg-white px-3 py-1.5 text-[12px] font-bold transition ${
          routesActive
            ? "border-teal text-teal"
            : "border-card-border text-muted hover:border-teal hover:text-teal"
        }`}
        title="הגדרות ספקי הסליקה והקבלות"
      >
        הגדרות גבייה
      </Link>
    </div>
  );
}
