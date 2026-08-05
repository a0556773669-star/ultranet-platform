import Link from "next/link";
import { Sparkles, ExternalLink } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { ShopLead } from "@ultranet/shared-types";
import { ShopTabs } from "./shop-tabs";
import { LeadRowActions } from "./lead-row-actions";

const TIER_LABEL: Record<string, string> = { minimal: "מינימלי", recommended: "מומלץ", extreme: "מוגזם" };
const STATUS_LABEL: Record<string, string> = { new: "חדש", contacted: "יצרנו קשר", closed: "נסגר" };
const STATUS_CLASS: Record<string, string> = {
  new: "border-teal bg-teal-bg text-teal-dark",
  contacted: "border-purple bg-[#f4ecf8] text-purple",
  closed: "border-card-border bg-[#f4f6f9] text-muted",
};

export default async function ShopLeadsPage() {
  await requireModuleAccess("shop");
  const db = getAdminFirestore();
  const snap = await db.collection("n_shop_leads").orderBy("createdAt", "desc").get();
  const leads = snap.docs.map((d) => ({ ...(d.data() as Omit<ShopLead, "id">), id: d.id }) as ShopLead);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Sparkles className="h-5 w-5" />
          חנות AI - עוזר קנייה חכם
        </h1>
        <Link
          href="/shop"
          target="_blank"
          className="flex items-center gap-1.5 rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink transition hover:border-teal hover:text-teal"
        >
          <ExternalLink className="h-4 w-4" />
          {"פתיחת הצ'אטבוט הציבורי"}
        </Link>
      </div>

      <ShopTabs />

      {!leads.length ? (
        <div className="card text-sm text-muted">
          עדיין לא התקבלו פניות. שתפו את הקישור{" "}
          <span className="font-mono font-semibold text-ink">/shop</span> עם לקוחות כדי שיתחילו לבנות מחשב מותאם אישית.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {leads.map((lead) => {
            const selected = lead.recommendedOptions.find((o) => o.tier === lead.selectedTier);
            return (
              <div key={lead.id} className="rounded-card border border-card-border bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink">{lead.contactName || "לקוח ללא שם"}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_CLASS[lead.status]}`}>
                        {STATUS_LABEL[lead.status]}
                      </span>
                      <span className="rounded-full border border-card-border bg-[#f4f6f9] px-2.5 py-0.5 text-[11px] font-bold text-muted">
                        {lead.useCaseLabel}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span>{lead.contactEmail}</span>
                      <span dir="ltr">{lead.contactPhone}</span>
                      <span>{new Date(lead.createdAt).toLocaleString("he-IL")}</span>
                    </div>
                  </div>
                  <LeadRowActions id={lead.id} status={lead.status} />
                </div>

                {lead.description && <p className="mt-3 text-sm text-ink">&quot;{lead.description}&quot;</p>}

                {selected && (
                  <div className="mt-3 rounded-lg border border-teal bg-teal-bg p-3 text-sm">
                    <div className="font-bold text-teal-dark">
                      נבחר: {TIER_LABEL[selected.tier]} - {selected.title}
                    </div>
                    <div className="mt-1 text-xs text-ink">{selected.specsSummary}</div>
                    <div className="mt-1 text-xs font-bold text-teal-dark">
                      {typeof selected.priceILS === "number" ? `${selected.priceILS.toLocaleString("he-IL")} ₪` : "מחיר טרם נקבע בקטלוג"}
                    </div>
                  </div>
                )}

                {!!lead.selectedAddonNames?.length && (
                  <div className="mt-2 text-xs text-muted">ציוד נלווה: {lead.selectedAddonNames.join(", ")}</div>
                )}

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-teal">פירוט השיחה המלא</summary>
                  <div className="mt-2 flex flex-col gap-1.5 border-r-2 border-card-border pr-3">
                    {lead.answers.map((a, i) => (
                      <div key={i} className="text-xs">
                        <span className="text-muted">{a.question}</span>
                        <br />
                        <span className="font-semibold text-ink">{a.answer}</span>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
