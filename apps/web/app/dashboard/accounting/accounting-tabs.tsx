import Link from "next/link";

/**
 * ניווט ההנה"ח הראשית — חמישה מסכים.
 *
 * הגרסה הקודמת החזיקה חמש-עשרה לשוניות, ורובן היו דרכים שונות להזין או להסיק את אותו
 * שקל: מודל תנועות, ספר תזרים, מזכר הוני, בדיקת שלמות, מדיניות, רכש ומלאי. כולן ניסו
 * לענות על שאלה אחת - האם הסכום הזה שייך לספר הראשי - וכל אחת ענתה עליה אחרת.
 *
 * עכשיו התשובה היא דגל שמישהו סימן (`countsToMain`), והמסכים שנשארו הם רק המקומות
 * שבהם באמת קורה משהו: הספר עצמו, המעקב אחרי הניידים, ההעברות, ההוצאות שלי, ומסך
 * חד-פעמי לעדכן את מה שכבר היה כאן לפני שהדגל נולד.
 */
const TABS = [
  { href: "/dashboard/accounting", label: "הספר הראשי" },
  { href: "/dashboard/accounting/laptop-branches", label: "מעקב סניפים ניידים" },
  { href: "/dashboard/accounting/transfers", label: "העברות חודשיות" },
  { href: "/dashboard/accounting/extra-expenses", label: "הוצאות נוספות" },
  { href: "/dashboard/accounting/legacy", label: "עדכון רטרואקטיבי" },
];

/** מסך-בן מדליק את הלשונית של הקבוצה שלו. */
const TAB_OF: Record<string, string> = {
  "/dashboard/accounting/routes": "/dashboard/accounting/extra-expenses",
};

export function AccountingTabs({ active }: { active: string }) {
  const current = TAB_OF[active] ?? active;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1 rounded-xl border border-card-border bg-white p-1">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={
              t.href === current
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
        className="whitespace-nowrap rounded-lg border border-card-border bg-white px-3 py-1.5 text-[12px] font-bold text-muted transition hover:border-teal hover:text-teal"
        title="הגדרות ספקי הסליקה והקבלות"
      >
        הגדרות גבייה
      </Link>
    </div>
  );
}
