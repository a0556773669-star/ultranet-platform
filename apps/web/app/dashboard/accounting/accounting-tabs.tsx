import Link from "next/link";

/**
 * The tabs follow the three layers, in order: the money (רישום ותנועות), the assets
 * (רכש וציוד · מלאי ומשלוחים), and profitability (סקירה · השורה התחתונה), with the setup and
 * verification screens after them.
 */
const TABS = [
  { href: "/dashboard/accounting/overview", label: "סקירה" },
  { href: "/dashboard/accounting/bottom-line", label: "השורה התחתונה" },
  { href: "/dashboard/accounting/branches", label: "ניהול סניפים" },
  { href: "/dashboard/accounting/entries", label: "רישום ותנועות" },
  { href: "/dashboard/accounting/purchases", label: "רכש וציוד" },
  { href: "/dashboard/accounting/inventory", label: "מלאי ומשלוחים" },
  { href: "/dashboard/accounting/sales", label: "יציאת ציוד" },
  { href: "/dashboard/accounting/review", label: "סקירת הזנות" },
  { href: "/dashboard/accounting/policies", label: "מי משלם מה" },
  { href: "/dashboard/accounting/routes", label: "מסלולי גביה" },
  { href: "/dashboard/accounting/rates", label: "תעריפון" },
  { href: "/dashboard/accounting/ads", label: "פרסום משותף" },
  { href: "/dashboard/accounting/attribute", label: "שיוך לסניפים" },
  { href: "/dashboard/accounting/import", label: "ייבוא מאקסל" },
  { href: "/dashboard/accounting/integrity", label: "בדיקת שלמות" },
];

const ENTRIES_HREF = "/dashboard/accounting/entries";

/**
 * Owner-only navigation between the accounting screens. `active` is the href of the current tab.
 * Every accounting screen must render this - a screen without it strands the user with no way
 * back to the rest of the module.
 *
 * The "הזנת נתונים" button rides along on purpose: adding an income or an expense is the one
 * thing done from anywhere in the module, so it stays one click away instead of being buried
 * behind whichever tab happens to be open.
 */
export function AccountingTabs({ active }: { active: string }) {
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
      {active !== ENTRIES_HREF && (
        <Link
          href={ENTRIES_HREF}
          className="whitespace-nowrap rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90"
        >
          + הזנת נתונים
        </Link>
      )}
    </div>
  );
}
