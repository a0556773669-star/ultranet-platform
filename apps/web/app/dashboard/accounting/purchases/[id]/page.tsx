import Link from "next/link";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { loadAssets } from "@/lib/assets-data";
import {
  ITEM_KIND_LABEL,
  ITEM_STATUS_LABEL,
  WAREHOUSE_LABEL,
  WAREHOUSE_LOCATION,
  itemLabel,
  lineTotal,
  purchaseLinesTotal,
} from "@/lib/assets";
import type { Branch } from "@ultranet/shared-types";
import { AccountingTabs } from "../../accounting-tabs";
import { deletePurchaseAction } from "../actions";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] text-[12.5px]";

export default async function PurchaseDetailPage({ params }: { params: { id: string } }) {
  await requireOwner();

  const [assets, branchesSnap] = await Promise.all([
    loadAssets(),
    getAdminFirestore().collection("n_branches").get(),
  ]);

  const purchase = assets.purchaseById.get(params.id);
  if (!purchase) notFound();

  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const branchName = (id: string) =>
    id === WAREHOUSE_LOCATION ? WAREHOUSE_LABEL : branches.find((b) => b.id === id)?.name ?? id;

  const items = assets.itemsByPurchase.get(purchase.id) ?? [];
  const linesTotal = purchaseLinesTotal(purchase.lines ?? []);
  const itemsTotal = items.reduce((s, i) => s + (i.unitCost || 0), 0);
  const balanced = Math.abs(linesTotal - purchase.total) <= 0.5 && Math.abs(itemsTotal - purchase.total) <= 0.5;

  // Where this invoice's money physically sits right now - the answer the old model could not
  // give at all, because nothing linked an invoice to a branch.
  const byLocation = new Map<string, { count: number; total: number }>();
  for (const item of items) {
    const cur = byLocation.get(item.location) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += item.unitCost || 0;
    byLocation.set(item.location, cur);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Receipt className="h-5 w-5" />
            {purchase.supplier}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {purchase.invoiceNo ? `חשבונית ${purchase.invoiceNo} · ` : ""}
            {purchase.date} · {money(purchase.total)}
            {purchase.note ? ` · ${purchase.note}` : ""}
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/purchases" />
      </div>

      <div
        className={`${CARD} mb-3.5 px-4 py-3 text-[12.5px] font-bold ${
          balanced ? "text-[#0f6e56]" : "text-[#b91c1c]"
        }`}
      >
        {balanced ? (
          <>
            מאוזן — סכום עלויות {items.length} הפריטים ({money(itemsTotal)}) שווה בדיוק לסכום שיצא מהחשבון.
            אחרי כל משלוח, סכום ההשקעה בסניפים ועוד המחסן יישאר שווה לסכום הזה.
          </>
        ) : (
          <>
            לא מאוזן — סכום החשבונית {money(purchase.total)}, סכום השורות {money(linesTotal)}, סכום הפריטים{" "}
            {money(itemsTotal)}. יש פריט יתום או שורה שלא נוצרו לה פריטים.
          </>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
        <section className={`${CARD} overflow-hidden`}>
          <div className="border-b border-card-border px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-ink">שורות החשבונית</h2>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>פריט</th>
                <th className={TH}>כמות</th>
                <th className={TH}>עלות יחידה</th>
                <th className={TH}>סה&quot;כ</th>
              </tr>
            </thead>
            <tbody>
              {(purchase.lines ?? []).map((line, i) => (
                <tr key={i}>
                  <td className={TD}>{line.label || ITEM_KIND_LABEL[line.kind]}</td>
                  <td className={`${TD} tabular-nums`}>{line.qty}</td>
                  <td className={`${TD} tabular-nums text-muted`}>{money(line.unitCost)}</td>
                  <td className={`${TD} font-bold tabular-nums text-ink`}>{money(lineTotal(line))}</td>
                </tr>
              ))}
              <tr className="bg-[#fafbfc]">
                <td className={`${TD} font-extrabold text-ink`}>סה&quot;כ החשבונית</td>
                <td className={`${TD} tabular-nums font-extrabold`}>
                  {(purchase.lines ?? []).reduce((s, l) => s + l.qty, 0)}
                </td>
                <td className={TD} />
                <td className={`${TD} font-black tabular-nums text-ink`}>{money(purchase.total)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className={`${CARD} overflow-hidden`}>
          <div className="border-b border-card-border px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-ink">איפה הכסף הזה עכשיו</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              אותם {money(purchase.total)}, מפוזרים בין המחסן והסניפים — בלי שנרשם שקל נוסף
            </p>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>מיקום</th>
                <th className={TH}>פריטים</th>
                <th className={TH}>שווי</th>
              </tr>
            </thead>
            <tbody>
              {[...byLocation.entries()]
                .sort((a, b) => b[1].total - a[1].total)
                .map(([location, agg]) => (
                  <tr key={location}>
                    <td className={TD}>{branchName(location)}</td>
                    <td className={`${TD} tabular-nums`}>{agg.count}</td>
                    <td className={`${TD} font-bold tabular-nums text-ink`}>{money(agg.total)}</td>
                  </tr>
                ))}
              {byLocation.size === 0 && (
                <tr>
                  <td className={`${TD} text-center text-muted`} colSpan={3}>
                    לא נוצרו פריטים לחשבונית הזו
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="border-t border-card-border px-4 py-2.5 text-[12px] text-muted">
            <Link href="/dashboard/accounting/inventory" className="font-bold text-teal hover:underline">
              למסך המלאי והמשלוחים ←
            </Link>
          </div>
        </section>
      </div>

      <section className={`${CARD} mt-3.5 overflow-hidden`}>
        <div className="border-b border-card-border px-4 py-3">
          <h2 className="text-[15px] font-extrabold text-ink">{items.length} הפריטים שנוצרו</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>פריט</th>
                <th className={TH}>מספר סידורי</th>
                <th className={TH}>עלות</th>
                <th className={TH}>מיקום</th>
                <th className={TH}>מצב</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className={TD}>{itemLabel(item)}</td>
                  <td className={`${TD} text-muted`}>{item.serial || "—"}</td>
                  <td className={`${TD} tabular-nums`}>{money(item.unitCost)}</td>
                  <td className={TD}>{branchName(item.location)}</td>
                  <td className={`${TD} text-muted`}>{ITEM_STATUS_LABEL[item.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <form action={deletePurchaseAction.bind(null, purchase.id)} className="mt-3.5">
        <button type="submit" className="text-xs font-bold text-red-600 hover:underline">
          מחיקת הרכישה, התנועה ההונית והפריטים שלה
        </button>
        <p className="mt-1 text-[11.5px] text-muted">
          אפשרי רק כל עוד אף פריט מהחשבונית לא נשלח לסניף. אחרי משלוח, החשבונית היא היסטוריה שסניף
          מסתמך עליה — והדרך הנכונה היא סימון הפריטים כהושבתו, לא מחיקה.
        </p>
      </form>
    </div>
  );
}
