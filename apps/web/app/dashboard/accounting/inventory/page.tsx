import Link from "next/link";
import { Boxes } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { loadAssets, loadRecentItemMoves } from "@/lib/assets-data";
import {
  ITEM_KIND_LABEL,
  ITEM_MOVE_REASON_LABEL,
  WAREHOUSE_LABEL,
  WAREHOUSE_LOCATION,
  itemLabel,
} from "@/lib/assets";
import type { Branch } from "@ultranet/shared-types";
import { AccountingTabs } from "../accounting-tabs";
import { ShipmentClient } from "./shipment-client";
import { moveItemsAction, setItemStatusAction } from "./actions";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] text-[12.5px]";

export default async function InventoryPage() {
  await requireOwner();

  const [assets, branchesSnap, moves] = await Promise.all([
    loadAssets(),
    getAdminFirestore().collection("n_branches").get(),
    loadRecentItemMoves(40),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const nameOf = (id: string) =>
    id === WAREHOUSE_LOCATION ? WAREHOUSE_LABEL : id === "" ? "רכישה" : branches.find((b) => b.id === id)?.name ?? id;

  const itemById = new Map(assets.items.map((i) => [i.id, i]));

  const warehouse = assets.investmentByLocation.get(WAREHOUSE_LOCATION);
  const branchRows = branches
    .map((b) => ({ branch: b, inv: assets.investmentByLocation.get(b.id) }))
    .filter((r) => r.inv && r.inv.itemCount > 0)
    .sort((a, b) => (b.inv?.total ?? 0) - (a.inv?.total ?? 0));

  const inBranches = branchRows.reduce((sum, r) => sum + (r.inv?.total ?? 0), 0);
  const held = (warehouse?.total ?? 0) + inBranches;
  const drift = assets.totalPurchased - held;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Boxes className="h-5 w-5" />
            מלאי ומשלוחים
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            איפה נמצא כל פריט, וכמה הוא עלה באמת — שכבת הנכסים
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/inventory" />
      </div>

      {/* --- the balance that replaces every mirror mechanism -------------- */}
      <div
        className={`${CARD} mb-3.5 px-4 py-3 text-[12.5px] leading-relaxed ${
          Math.abs(drift) <= 0.5 ? "text-muted" : "font-bold text-[#b91c1c]"
        }`}
      >
        {Math.abs(drift) <= 0.5 ? (
          <>
            <b className="text-ink">המאזן סוגר:</b> נרכש {money(assets.totalPurchased)} · בסניפים{" "}
            {money(inBranches)} · במחסן {money(warehouse?.total ?? 0)}. סכום ההשקעה בכל הסניפים ועוד המחסן שווה
            בדיוק לסכום שיצא מהחשבון — וזו הבדיקה שמחליפה את כל מנגנוני הבבואה וההשתקה.
          </>
        ) : (
          <>
            המאזן לא סוגר: נרכש {money(assets.totalPurchased)}, אבל בסניפים ובמחסן יחד יש{" "}
            {money(held)} — הפרש של {money(Math.abs(drift))}. יש פריט יתום.{" "}
            <Link href="/dashboard/accounting/integrity" className="underline">
              למסך בדיקת השלמות
            </Link>
          </>
        )}
      </div>

      {assets.items.length === 0 ? (
        <p className={`${CARD} px-4 py-6 text-center text-sm text-muted`}>
          עדיין אין פריטים במערכת.{" "}
          <Link href="/dashboard/accounting/purchases" className="font-bold text-teal underline">
            הזנת רכישה ראשונה
          </Link>{" "}
          תיצור אותם אוטומטית, כל אחד עם עלות היחידה האמיתית שלו.
        </p>
      ) : (
        <>
          <ShipmentClient
            items={assets.items}
            locations={branches.map((b) => ({ id: b.id, name: b.name }))}
            moveAction={moveItemsAction}
            statusAction={setItemStatusAction}
          />

          <div className="mt-3.5 grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
            <section className={`${CARD} overflow-hidden`}>
              <div className="border-b border-card-border px-4 py-3">
                <h2 className="text-[15px] font-extrabold text-ink">השקעה לפי מיקום</h2>
                <p className="mt-0.5 text-[12px] text-muted">
                  נגזר ישירות ממקום הפריטים — בלי תאריכים, בלי מפתחות חלוקה, בלי פחת
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>מיקום</th>
                      <th className={TH}>מחשבים</th>
                      <th className={TH}>סטיקים</th>
                      <th className={TH}>אחר</th>
                      <th className={TH}>סה&quot;כ פריטים</th>
                      <th className={TH}>השקעה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {branchRows.map(({ branch, inv }) => (
                      <tr key={branch.id} className="transition hover:bg-[#fafbfc]">
                        <td className={`${TD} font-bold text-ink`}>{branch.name}</td>
                        <td className={`${TD} tabular-nums`}>{inv!.countByKind.laptop}</td>
                        <td className={`${TD} tabular-nums`}>{inv!.countByKind.stick}</td>
                        <td className={`${TD} tabular-nums text-muted`}>
                          {inv!.countByKind.bag + inv!.countByKind.sim + inv!.countByKind.other}
                        </td>
                        <td className={`${TD} tabular-nums`}>{inv!.itemCount}</td>
                        <td className={`${TD} font-bold tabular-nums text-ink`}>{money(inv!.total)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#fdf9f0]">
                      <td className={`${TD} font-bold text-ink`}>{WAREHOUSE_LABEL}</td>
                      <td className={`${TD} tabular-nums`}>{warehouse?.countByKind.laptop ?? 0}</td>
                      <td className={`${TD} tabular-nums`}>{warehouse?.countByKind.stick ?? 0}</td>
                      <td className={`${TD} tabular-nums text-muted`}>
                        {(warehouse?.countByKind.bag ?? 0) +
                          (warehouse?.countByKind.sim ?? 0) +
                          (warehouse?.countByKind.other ?? 0)}
                      </td>
                      <td className={`${TD} tabular-nums`}>{warehouse?.itemCount ?? 0}</td>
                      <td className={`${TD} font-bold tabular-nums text-ink`}>{money(warehouse?.total ?? 0)}</td>
                    </tr>
                    <tr className="bg-[#f4f6f9]">
                      <td className={`${TD} font-black text-ink`}>סה&quot;כ</td>
                      <td className={TD} colSpan={3} />
                      <td className={`${TD} tabular-nums font-black`}>
                        {assets.items.filter((i) => i.status !== "sold" && i.status !== "lost").length}
                      </td>
                      <td className={`${TD} font-black tabular-nums text-ink`}>{money(held)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className={`${CARD} overflow-hidden`}>
              <div className="border-b border-card-border px-4 py-3">
                <h2 className="text-[15px] font-extrabold text-ink">תנועות מלאי אחרונות</h2>
                <p className="mt-0.5 text-[12px] text-muted">
                  לתנועת מלאי אין שדה סכום. בכוונה, לעולם.
                </p>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0">
                    <tr>
                      <th className={TH}>תאריך</th>
                      <th className={TH}>פריט</th>
                      <th className={TH}>מ־</th>
                      <th className={TH}>אל</th>
                      <th className={TH}>סיבה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {moves.length === 0 ? (
                      <tr>
                        <td className={`${TD} text-center text-muted`} colSpan={5}>
                          עדיין אין תנועות מלאי
                        </td>
                      </tr>
                    ) : (
                      moves.map((m) => {
                        const item = itemById.get(m.itemId);
                        return (
                          <tr key={m.id}>
                            <td className={`${TD} whitespace-nowrap tabular-nums text-muted`}>{m.date}</td>
                            <td className={TD}>
                              {item ? itemLabel(item) : "פריט שנמחק"}
                              {item && (
                                <span className="mr-1.5 text-[11px] text-muted">{ITEM_KIND_LABEL[item.kind]}</span>
                              )}
                            </td>
                            <td className={`${TD} text-muted`}>{nameOf(m.from)}</td>
                            <td className={`${TD} font-bold text-ink`}>{nameOf(m.to)}</td>
                            <td className={`${TD} text-muted`}>{ITEM_MOVE_REASON_LABEL[m.reason]}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
