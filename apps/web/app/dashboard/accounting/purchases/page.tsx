import Link from "next/link";
import { Receipt } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { loadAssets } from "@/lib/assets-data";
import { ITEM_KIND_LABEL, WAREHOUSE_LABEL, WAREHOUSE_LOCATION, purchaseUnitCount } from "@/lib/assets";
import type { Branch } from "@ultranet/shared-types";
import { AccountingTabs } from "../accounting-tabs";
import { PurchaseForm } from "./purchase-form";
import { convertSetupCostAction, createPurchaseAction } from "./actions";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] text-[12.5px]";

export default async function PurchasesPage() {
  await requireOwner();

  const [assets, branchesSnap] = await Promise.all([
    loadAssets(),
    getAdminFirestore().collection("n_branches").get(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  const branchName = (id: string) =>
    id === WAREHOUSE_LOCATION ? WAREHOUSE_LABEL : branches.find((b) => b.id === id)?.name ?? id;

  // Computer rooms whose setup cost is still only a number on the branch document.
  const convertedSetup = new Set(
    assets.purchases.filter((p) => p.note?.startsWith("setupCost:")).map((p) => p.note!.slice("setupCost:".length)),
  );
  const pendingSetup = branches.filter(
    (b) => b.branchType === "computers" && (b.setupCost ?? 0) > 0 && !convertedSetup.has(b.id),
  );

  const warehouse = assets.investmentByLocation.get(WAREHOUSE_LOCATION);
  const inBranches = [...assets.investmentByLocation.entries()]
    .filter(([loc]) => loc !== WAREHOUSE_LOCATION)
    .reduce((sum, [, inv]) => sum + inv.total, 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Receipt className="h-5 w-5" />
            רכש וציוד
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            החשבוניות מהספקים — הרובד שבו כסף הופך לנכס, ולא להוצאה
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/purchases" />
      </div>

      <div className={`${CARD} mb-3.5 px-4 py-3 text-[12.5px] leading-relaxed text-muted`}>
        <b className="text-ink">למה רכישה היא לא הוצאה:</b> כשיוצאים 15,000 ₪ מהחשבון אתה לא נעשה עני
        ב-15,000 ₪ — יש לך עכשיו פריטים ששווים 15,000 ₪. ההון לא זז, רק שינה צורה. לכן המסך הזה יוצר{" "}
        <b className="text-ink">תנועה הונית אחת</b> ואת הפריטים שנקנו, ו<b className="text-ink">לא</b> רושם
        הוצאה לאף סניף. כשתשלח את הפריטים לסניף — במסך{" "}
        <Link href="/dashboard/accounting/inventory" className="text-teal underline">
          מלאי ומשלוחים
        </Link>{" "}
        — לא יירשם ולו שקל אחד נוסף: העלות פשוט נוסעת עם הפריטים.
      </div>

      <section className={`${CARD} mb-3.5 overflow-hidden`}>
        <div className="border-b border-card-border px-4 py-3">
          <h2 className="text-[15px] font-extrabold text-ink">רכישה חדשה</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            סכום השורות חייב להיות שווה לסכום החשבונית — זו הבדיקה שמבטיחה שהמאזן תמיד יסגור
          </p>
        </div>
        <div className="p-3.5">
          <PurchaseForm branches={branches} action={createPurchaseAction} />
        </div>
      </section>

      {pendingSetup.length > 0 && (
        <section className={`${CARD} mb-3.5 overflow-hidden border-[#f0dcb8]`}>
          <div className="border-b border-card-border bg-[#fdf3e3] px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-[#7a4a12]">עלויות הקמה שעדיין לא הומרו לרכישה</h2>
            <p className="mt-0.5 text-[12px] text-[#7a4a12]">
              &quot;עלות הקמה&quot; היא שדה בודד בלי תאריך, בלי חשבונית ובלי פירוט. המרה יוצרת ממנה רכישה
              אמיתית ופריט בסניף — אותו סכום בדיוק, אבל כזה שהמאזן יכול לאמת. הסכום נספר פעם אחת:
              אחרי ההמרה המערכת מפסיקה לקרוא את השדה הישן.
            </p>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>סניף</th>
                <th className={TH}>עלות הקמה</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {pendingSetup.map((b) => (
                <tr key={b.id}>
                  <td className={`${TD} font-bold text-ink`}>{b.name}</td>
                  <td className={`${TD} tabular-nums`}>{money(b.setupCost ?? 0)}</td>
                  <td className={TD}>
                    <form action={convertSetupCostAction.bind(null, b.id)}>
                      <button type="submit" className="text-xs font-bold text-teal hover:underline">
                        המרה לרכישה
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[
          { label: 'סה"כ נרכש', value: money(assets.totalPurchased), color: "#1a8a76" },
          { label: "מוחזק בסניפים", value: money(inBranches), color: "#0f6e56" },
          { label: "יושב במחסן", value: money(warehouse?.total ?? 0), color: "#7a4a12" },
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

      {assets.purchases.length === 0 ? (
        <p className={`${CARD} px-4 py-6 text-center text-sm text-muted`}>
          עדיין לא הוזנה אף חשבונית רכש. כל עוד אין רכישות, ההשקעה פר סניף מחושבת רק מהערכות התעריפון —
          מספרים משוערים שאין להם קשר מתמטי למה שבאמת יצא מהחשבון.
        </p>
      ) : (
        <section className={`${CARD} overflow-hidden`}>
          <div className="border-b border-card-border px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-ink">חשבוניות רכש</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>תאריך</th>
                  <th className={TH}>ספק</th>
                  <th className={TH}>חשבונית</th>
                  <th className={TH}>פריטים</th>
                  <th className={TH}>פירוט</th>
                  <th className={TH}>סכום</th>
                  <th className={TH}>איפה הם עכשיו</th>
                </tr>
              </thead>
              <tbody>
                {assets.purchases.map((p) => {
                  const items = assets.itemsByPurchase.get(p.id) ?? [];
                  const locations = [...new Set(items.map((i) => i.location))];
                  return (
                    <tr key={p.id} className="transition hover:bg-[#fafbfc]">
                      <td className={`${TD} whitespace-nowrap tabular-nums`}>{p.date}</td>
                      <td className={TD}>
                        <Link
                          href={`/dashboard/accounting/purchases/${p.id}`}
                          className="font-bold text-teal hover:underline"
                        >
                          {p.supplier}
                        </Link>
                      </td>
                      <td className={`${TD} text-muted`}>{p.invoiceNo || "—"}</td>
                      <td className={`${TD} tabular-nums`}>{purchaseUnitCount(p.lines ?? [])}</td>
                      <td className={`${TD} text-muted`}>
                        {(p.lines ?? [])
                          .map((l) => `${l.qty}× ${l.label || ITEM_KIND_LABEL[l.kind]}`)
                          .join(" · ")}
                      </td>
                      <td className={`${TD} font-bold tabular-nums text-ink`}>{money(p.total)}</td>
                      <td className={`${TD} text-muted`}>
                        {locations.length === 0 ? "—" : locations.map(branchName).join(" · ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
