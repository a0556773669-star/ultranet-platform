import Link from "next/link";
import { Boxes, PackageMinus, Receipt } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { loadAssets } from "@/lib/assets-data";
import { WAREHOUSE_LOCATION, itemCountsAsHeld } from "@/lib/assets";
import { AccountingTabs } from "../accounting-tabs";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const CARD = "rounded-card border border-card-border bg-white shadow-card";

/**
 * שכבה 2 in one place.
 *
 * The three asset screens used to be three top-level tabs, which is three chances to wonder which
 * one you want. They are one act in three moments instead - equipment arrives, moves, and leaves -
 * so they sit behind one tab, in that order.
 */
export default async function AssetsHubPage() {
  await requireOwner();
  const assets = await loadAssets();

  const warehouse = assets.investmentByLocation.get(WAREHOUSE_LOCATION);
  const inBranches = [...assets.investmentByLocation.entries()]
    .filter(([loc]) => loc !== WAREHOUSE_LOCATION)
    .reduce((sum, [, inv]) => sum + inv.total, 0);
  const active = assets.items.filter(itemCountsAsHeld).length;
  const { gain } = assets.capital;

  const screens = [
    {
      href: "/dashboard/accounting/purchases",
      label: "רכש — חשבוניות מהספקים",
      note: "כאן ציוד נכנס לעסק. חשבונית אחת יוצרת תנועה הונית אחת ופריט לכל יחידה.",
      icon: Receipt,
    },
    {
      href: "/dashboard/accounting/inventory",
      label: "מלאי ומשלוחים",
      note: "איפה נמצא כל פריט וכמה הוא עלה. משלוח לסניף לא רושם שקל — העלות נוסעת עם הפריטים.",
      icon: Boxes,
    },
    {
      href: "/dashboard/accounting/sales",
      label: "יציאת ציוד",
      note: "מכירה, גריטה ואבדן. תמורה ממכירה היא החזר הון, לא הכנסה.",
      icon: PackageMinus,
    },
  ];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Boxes className="h-5 w-5" />
            ציוד
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            שכבת הנכסים — מה יש לי, איפה זה, וכמה זה עלה באמת
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/assets" />
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'סה"כ נרכש', value: money(assets.totalPurchased), color: "#1a8a76" },
          { label: "בסניפים", value: money(inBranches), color: "#0f6e56" },
          { label: "במחסן", value: money(warehouse?.total ?? 0), color: "#7a4a12" },
          {
            label: gain >= 0 ? "רווח הוני" : "הפסד הוני",
            value: money(Math.abs(gain)),
            color: gain >= 0 ? "#059669" : "#dc2626",
          },
        ].map((c) => (
          <article key={c.label} className={`${CARD} relative overflow-hidden py-2.5 pl-3.5 pr-3`}>
            <span className="absolute right-0 top-0 h-full w-[3px]" style={{ background: c.color }} />
            <p className="text-[11px] font-extrabold text-muted">{c.label}</p>
            <p className="mt-px text-[21px] font-black leading-tight tabular-nums" style={{ color: c.color }}>
              {c.value}
            </p>
          </article>
        ))}
      </div>

      <div className={`${CARD} mb-3.5 px-4 py-3 text-[12.5px] leading-relaxed text-muted`}>
        <b className="text-ink">רכישת ציוד היא לא הוצאה — היא המרה של כסף לנכס.</b> לכן ציוד לא נכנס
        לרווחיות של אף סניף, לא מתחלק עם אף שותף, ומופיע מתחת לשורה התחתונה ולא בתוכה. כרגע{" "}
        <b className="text-ink">{active}</b> פריטים פעילים.
      </div>

      <div className="flex flex-col gap-2.5">
        {screens.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className={`${CARD} flex items-center gap-3.5 px-4 py-3.5 transition hover:border-teal`}
          >
            <s.icon className="h-6 w-6 shrink-0 text-teal" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-extrabold text-ink">{s.label}</span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{s.note}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
