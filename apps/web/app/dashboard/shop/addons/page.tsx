import Link from "next/link";
import { Backpack } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { ShopAddon } from "@ultranet/shared-types";
import { ShopTabs } from "../shop-tabs";
import { deleteAddonAction } from "./actions";
import { DeleteAddonButton } from "./delete-button";

const TYPE_LABEL: Record<string, string> = { bag: "תיק", mouse: "עכבר", keyboard: "מקלדת", flashdrive: "דיסק און קי", other: "אחר" };

export default async function ShopAddonsPage() {
  await requireModuleAccess("shop");
  const db = getAdminFirestore();
  const snap = await db.collection("n_shop_addons").get();
  const items = snap.docs
    .map((d) => ({ ...(d.data() as Omit<ShopAddon, "id">), id: d.id }) as ShopAddon)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Backpack className="h-5 w-5" />
          ציוד נלווה
        </h1>
        <Link
          href="/dashboard/shop/addons/new"
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          + פריט חדש
        </Link>
      </div>

      <ShopTabs />

      {!items.length ? (
        <div className="card text-sm text-muted">
          {"עדיין לא הוגדר ציוד נלווה. כל עוד הרשימה ריקה, הצ'אטבוט מציע ללקוחות רשימת ברירת מחדל (תיק/עכבר/מקלדת/דיסק און קי) בלי מחיר."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-card border border-card-border bg-white p-3 shadow-card">
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">{item.name}</span>
                <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[10px] font-semibold text-muted">
                  {TYPE_LABEL[item.type]}
                </span>
                {!item.active && (
                  <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[10px] font-semibold text-muted">
                    לא פעיל
                  </span>
                )}
                <span className="text-sm font-bold text-teal">
                  {typeof item.priceILS === "number" ? `${item.priceILS.toLocaleString("he-IL")} ₪` : "ללא מחיר"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/shop/addons/${item.id}`}
                  className="rounded-lg border border-card-border px-3 py-1.5 text-xs font-bold text-ink transition hover:border-teal hover:text-teal"
                >
                  עריכה
                </Link>
                <DeleteAddonButton action={deleteAddonAction.bind(null, item.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
