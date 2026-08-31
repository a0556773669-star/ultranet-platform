import Link from "next/link";
import { PackageMinus } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { loadAssets } from "@/lib/assets-data";
import {
  ITEM_KIND_LABEL,
  ITEM_STATUS_LABEL,
  WAREHOUSE_LABEL,
  WAREHOUSE_LOCATION,
  itemCountsAsHeld,
  itemLabel,
} from "@/lib/assets";
import type { Branch } from "@ultranet/shared-types";
import { AccountingTabs } from "../accounting-tabs";
import { SaleClient } from "./sale-client";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] text-[12.5px]";

export default async function SalesPage() {
  await requireOwner();

  const [assets, branchesSnap] = await Promise.all([
    loadAssets(),
    getAdminFirestore().collection("n_branches").get(),
  ]);

  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const branchNames: Record<string, string> = Object.fromEntries(branches.map((b) => [b.id, b.name]));
  const nameOf = (id: string) =>
    id === WAREHOUSE_LOCATION ? WAREHOUSE_LABEL : branchNames[id] ?? id;

  const active = assets.items.filter(itemCountsAsHeld);
  const exited = [...assets.exitedItems].sort((a, b) => (b.soldAt ?? "").localeCompare(a.soldAt ?? ""));
  const { cost, proceeds, gain } = assets.capital;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <PackageMinus className="h-5 w-5" />
            יציאת ציוד
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            מכירה, גריטה ואבדן — מסך הרכש, בכיוון ההפוך
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/sales" />
      </div>

      <div className={`${CARD} mb-3.5 px-4 py-3 text-[12.5px] leading-relaxed text-muted`}>
        <b className="text-ink">תמורה ממכירת ציוד היא לא הכנסה — היא החזר הון.</b> רכישה ממירה כסף
        לנכס; מכירה ממירה נכס לכסף. אותה שכבה, אותו מנגנון, כיוון הפוך. לכן התמורה לא נכנסת למחזור, לא
        מתחלקת עם השותף ולא נוגעת ברווחיות של אף סניף — מאותה סיבה בדיוק שהרכישה לא הייתה הוצאה.
        <br />
        <b className="text-ink">פריט אף פעם לא נמחק</b> — הוא רק משנה סטטוס. מחיקה הייתה שוברת את
        המאזן של כלל 4, וגם מוחקת את הידיעה שהפסדת שם כסף.
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-4">
        {[
          { label: "פריטים פעילים", value: String(active.length), color: "#1a8a76" },
          { label: "יצאו מהעסק", value: String(exited.length), color: "#7a4a12" },
          { label: "עלותם המקורית", value: money(cost), color: "#6b46c1" },
          {
            label: gain >= 0 ? "רווח הוני מצטבר" : "הפסד הוני מצטבר",
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

      {active.length === 0 ? (
        <p className={`${CARD} px-4 py-6 text-center text-sm text-muted`}>
          אין פריטים פעילים.{" "}
          <Link href="/dashboard/accounting/purchases" className="font-bold text-teal underline">
            הזנת רכישה
          </Link>{" "}
          תיצור אותם.
        </p>
      ) : (
        <SaleClient items={active} branchNames={branchNames} />
      )}

      {exited.length > 0 && (
        <section className={`${CARD} mt-3.5 overflow-hidden`}>
          <div className="border-b border-card-border px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-ink">פריטים שיצאו מהעסק</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              נשארים במאזן לנצח — רק בצד השני שלו. זה מה שמחזיק את כלל 4 סגור.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>תאריך</th>
                  <th className={TH}>פריט</th>
                  <th className={TH}>יצא מ־</th>
                  <th className={TH}>מצב</th>
                  <th className={TH}>עלות</th>
                  <th className={TH}>תמורה</th>
                  <th className={TH}>תוצאה הונית</th>
                </tr>
              </thead>
              <tbody>
                {exited.map((item) => {
                  const itemGain = (item.soldPrice ?? 0) - (item.unitCost || 0);
                  return (
                    <tr key={item.id}>
                      <td className={`${TD} whitespace-nowrap tabular-nums text-muted`}>{item.soldAt || "—"}</td>
                      <td className={TD}>
                        <span className="font-bold text-ink">{itemLabel(item)}</span>
                        <span className="mr-1.5 text-[11px] text-muted">{ITEM_KIND_LABEL[item.kind]}</span>
                      </td>
                      <td className={TD}>{item.lastBranchId ? nameOf(item.lastBranchId) : "—"}</td>
                      <td className={`${TD} text-muted`}>{ITEM_STATUS_LABEL[item.status]}</td>
                      <td className={`${TD} tabular-nums`}>{money(item.unitCost)}</td>
                      <td className={`${TD} tabular-nums`}>{money(item.soldPrice ?? 0)}</td>
                      <td
                        className={`${TD} tabular-nums font-bold ${
                          itemGain >= 0 ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {money(itemGain)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-[#f4f6f9]">
                  <td className={`${TD} font-black text-ink`} colSpan={4}>
                    סה&quot;כ
                  </td>
                  <td className={`${TD} font-black tabular-nums`}>{money(cost)}</td>
                  <td className={`${TD} font-black tabular-nums`}>{money(proceeds)}</td>
                  <td
                    className={`${TD} font-black tabular-nums ${gain >= 0 ? "text-emerald-700" : "text-red-600"}`}
                  >
                    {money(gain)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="border-t border-card-border px-4 py-2.5 text-[11.5px] leading-relaxed text-muted">
            הרווח או ההפסד ההוני הוא מספר של <b className="text-ink">כל העסק</b>, לא של סניף: הציוד הוא
            ההון שלך, ולכן מה שהוא מימש הוא התוצאה שלך — ספר הסניף מעולם לא נשא את העלות מלכתחילה.
          </p>
        </section>
      )}

      <div className={`${CARD} mt-3.5 px-4 py-3 text-[12px] leading-relaxed text-muted`}>
        <b className="text-ink">מתי מכירה מפסיקה להיות הונית:</b> אם הפריט עבד אצלך לפני שנמכר — הוני,
        וזה מה שהמסך הזה עושה. אם נקנה במיוחד כדי להימכר, באופן שיטתי — זו יחידה עסקית חדשה שצריכה
        צומת משלה בעץ, מחזור משלה ועלות מכר משלה, ואסור לערבב אותה כאן.
        <br />
        <b className="text-ink">מכירה לשותף:</b> אם הוא לא משלם במזומן, הסכום נכנס כשורת{" "}
        <b className="text-ink">העברה</b> בהתחשבנות החודשית ומקטין את מה שהוא מעביר — לא כהוצאה של
        הסניף ולא כהכנסה שלך.
        <br />
        <b className="text-ink">מע&quot;מ:</b> רשום באותה שיטה שבה נרשמות הרכישות. חוסר עקביות בין
        השתיים ישבור את כלל 4.
      </div>
    </div>
  );
}
