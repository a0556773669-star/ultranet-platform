import Link from "next/link";

/**
 * ניווט ההנה"ח — שש לשוניות, לפי סדר שלוש השכבות.
 *
 * היו כאן חמש-עשרה, ורובן היו דרכים שונות להזין את אותו שקל: תעריפון, פרסום משותף, שיוך
 * לסניפים וייבוא מאקסל. זו בדיוק הבעיה שמודל שלוש השכבות פתר, ומשנפתרה הן נמחקו.
 *
 * מה שנשאר עונה על שאלה אחת כל אחד: איפה הכסף (שכבה 1), מה יש לי (שכבה 2), כמה הרווחתי
 * (שכבה 3), ומי מוודא שהכל מסתדר.
 */
const TABS = [
  { href: "/dashboard/accounting/entries", label: "רישום ותנועות" },
  { href: "/dashboard/accounting/overview", label: "סקירה" },
  { href: "/dashboard/accounting/bottom-line", label: "השורה התחתונה" },
  { href: "/dashboard/accounting/assets", label: "ציוד" },
  { href: "/dashboard/accounting/branches", label: "סניפים" },
  { href: "/dashboard/accounting/integrity", label: "בדיקת שלמות" },
];

const ENTRIES_HREF = "/dashboard/accounting/entries";

/** מסך-בן מדליק את הלשונית של הקבוצה שלו, כך שתמיד ברור איפה נמצאים. */
const TAB_OF: Record<string, string> = {
  "/dashboard/accounting/purchases": "/dashboard/accounting/assets",
  "/dashboard/accounting/inventory": "/dashboard/accounting/assets",
  "/dashboard/accounting/sales": "/dashboard/accounting/assets",
  "/dashboard/accounting/policies": "/dashboard/accounting/branches",
  "/dashboard/accounting/review": "/dashboard/accounting/branches",
  "/dashboard/accounting/routes": "/dashboard/accounting/branches",
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
      {current !== ENTRIES_HREF && (
        <Link
          href={ENTRIES_HREF}
          className="whitespace-nowrap rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90"
        >
          + תנועה חדשה
        </Link>
      )}
    </div>
  );
}
