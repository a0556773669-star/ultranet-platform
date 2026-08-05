import Link from "next/link";
import { Cpu } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { ShopComputerConfig } from "@ultranet/shared-types";
import { USE_CASE_LABELS } from "@/lib/shop-recommender";
import { ShopTabs } from "../shop-tabs";
import { deleteCatalogItemAction } from "./actions";
import { DeleteCatalogItemButton } from "./delete-button";

const TIER_LABEL: Record<string, string> = { minimal: "מינימלי", recommended: "מומלץ", extreme: "מוגזם" };

export default async function ShopCatalogPage() {
  await requireModuleAccess("shop");
  const db = getAdminFirestore();
  const snap = await db.collection("n_shop_catalog").get();
  const items = snap.docs
    .map((d) => ({ ...(d.data() as Omit<ShopComputerConfig, "id">), id: d.id }) as ShopComputerConfig)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Cpu className="h-5 w-5" />
          קטלוג מחשבים
        </h1>
        <Link
          href="/dashboard/shop/catalog/new"
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          + תצורה חדשה
        </Link>
      </div>

      <ShopTabs />

      {!items.length ? (
        <div className="card text-sm text-muted">
          {
            "עדיין לא הוגדרו תצורות. כל עוד הקטלוג ריק, הצ'אטבוט ממליץ ללקוחות על מפרט גנרי בלבד וללא מחיר סופי - הוסיפו כאן מחשבים אמיתיים עם מחיר כדי שהם יוצגו במקום זאת."
          }
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 rounded-card border border-card-border bg-white p-4 shadow-card">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{item.name}</span>
                  <span className="rounded-full border border-teal bg-teal-bg px-2.5 py-0.5 text-[11px] font-bold text-teal-dark">
                    {TIER_LABEL[item.tier]}
                  </span>
                  {!item.active && (
                    <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2.5 py-0.5 text-[11px] font-bold text-muted">
                      לא פעיל
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {item.cpu} · זיכרון {item.ram} · אחסון {item.storage}
                  {item.gpu ? ` · ${item.gpu}` : ""}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.useCases.map((uc) => (
                    <span key={uc} className="rounded-full border border-card-border bg-[#f4f6f9] px-2 py-0.5 text-[10px] font-semibold text-muted">
                      {USE_CASE_LABELS[uc]}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-sm font-bold text-teal">
                  {typeof item.priceILS === "number" ? `${item.priceILS.toLocaleString("he-IL")} ₪` : "ללא מחיר - יימסר בהצעת מחיר"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/shop/catalog/${item.id}`}
                  className="rounded-lg border border-card-border px-3 py-1.5 text-xs font-bold text-ink transition hover:border-teal hover:text-teal"
                >
                  עריכה
                </Link>
                <DeleteCatalogItemButton action={deleteCatalogItemAction.bind(null, item.id)} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
