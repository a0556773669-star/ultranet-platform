import Link from "next/link";

const TABS = [
  { href: "/dashboard/accounting/overview", label: "סקירה" },
  { href: "/dashboard/accounting/branches", label: "סטטוס סניפים" },
  { href: "/dashboard/accounting/entries", label: "רישום ותנועות" },
  { href: "/dashboard/accounting/routes", label: "מסלולי גביה" },
  { href: "/dashboard/accounting/rates", label: "תעריפון" },
  { href: "/dashboard/accounting/ads", label: "פרסום משותף" },
  { href: "/dashboard/accounting/import", label: "ייבוא מאקסל" },
];

/** Owner-only navigation between the accounting screens. `active` is the href of the current tab. */
export function AccountingTabs({ active }: { active: string }) {
  return (
    <div className="flex gap-1 rounded-xl border border-card-border bg-white p-1">
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
  );
}
