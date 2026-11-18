import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { currentModuleScope, requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { buildMarketPrompt, specToText, suggestUpgrade } from "@/lib/store-wizard";
import type { StoreRequest } from "@ultranet/shared-types";
import { StoreTabs } from "../../store-tabs";
import { STORE_STATUS_LABEL as STATUS_LABEL } from "@/lib/store-status";
import { adjustCommissionAction } from "../../actions";
import { RespondForm } from "./respond-form";
import { StageActions } from "./stage-actions";
import { storeAiConfigured } from "@/lib/store-ai";
import { computeDealCommission } from "@/lib/store-commission";
import { loadCommissionRules } from "@/lib/store-commission-data";

export const dynamic = "force-dynamic";

export default async function StoreRequestPage({ params }: { params: { id: string } }) {
  await requireModuleAccess("store");
  const scope = await currentModuleScope("store");
  const doc = await getAdminFirestore().collection("n_store_requests").doc(params.id).get();
  if (!doc.exists) notFound();
  const r = { ...(doc.data() as Omit<StoreRequest, "id">), id: doc.id } as StoreRequest;
  if (!scope?.isOwner && !scope?.allows(r.branchId)) notFound();

  const isOwner = Boolean(scope?.isOwner);
  const upgrade = suggestUpgrade(r.spec, r.lockedFields);
  // העמלה הצפויה: מה שנקבע להזמנה הזו, ואחרת לפי הכללים (ברירת מחדל 150 למחשב ו-20 לאביזר)
  const expectedCommission = computeDealCommission(r, await loadCommissionRules());

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">בקשה: {r.customerName}</h1>
      <StoreTabs isOwner={isOwner} />
      <Link href="/dashboard/store/requests" className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline">
        <ArrowRight className="h-4 w-4" />
        חזרה לרשימה
      </Link>

      <div className="card mb-4 flex flex-col gap-2 text-sm">
        <div className="text-xs text-muted">
          {r.branchName} · {r.createdByName || r.createdByEmail} · {new Date(r.createdAt).toLocaleString("he-IL")} ·{" "}
          <b className="text-ink">{STATUS_LABEL[r.status]}</b>
          {r.customerPhone ? <> · <span dir="ltr">{r.customerPhone}</span></> : null}
        </div>
        <div>
          <span className="text-xs font-semibold text-muted">{r.mode === "guided" ? "התאמה לפי שאלות" : "לפי רצון הלקוח"}</span>
          <div className="font-bold text-ink">{specToText(r.spec)}</div>
          {r.lockedFields.length ? (
            <div className="text-xs text-muted">שדות שהלקוח קבע בוודאות (לא משנים): {r.lockedFields.length}</div>
          ) : null}
        </div>
        {r.budgetILS ? <div className="text-xs text-ink">תקציב שהלקוח הזכיר: {r.budgetILS.toLocaleString("he-IL")} ₪</div> : null}
        {r.notes ? <div className="text-xs text-ink">הערות: {r.notes}</div> : null}
        {r.answers.length ? (
          <details>
            <summary className="cursor-pointer text-xs font-semibold text-muted">תשובות הלקוח</summary>
            <div className="mt-1 border-r-2 border-card-border pr-3 text-xs">
              {r.answers.map((a, i) => (
                <div key={i}>{a.question}: <b>{a.answer}</b></div>
              ))}
            </div>
          </details>
        ) : null}
      </div>

      {r.options?.length ? (
        <div className="card mb-4 flex flex-col gap-3">
          <h2 className="text-base font-bold text-ink">התשובה שלנו</h2>
          {r.options.map((o, i) => (
            <div key={i} className="rounded-lg border border-card-border p-3 text-sm">
              <div className="font-bold text-ink">{o.label}</div>
              <div className="text-xs text-muted">{o.specText}</div>
              {o.quotedFromILS && o.quotedToILS ? (
                <div className="mt-1 font-bold text-teal-dark">
                  בערך {o.quotedFromILS.toLocaleString("he-IL")} - {o.quotedToILS.toLocaleString("he-IL")} ₪
                  <span className="mr-1 text-[11px] font-normal text-muted">(הערכה, לא מחיר סופי)</span>
                </div>
              ) : null}
              {o.whyBetter ? <div className="mt-1 text-xs text-ink">במה זה טוב יותר: {o.whyBetter}</div> : null}
            </div>
          ))}
          {r.responseNote ? <p className="text-sm text-ink">{r.responseNote}</p> : null}
        </div>
      ) : (
        <div className={`card mb-4 text-sm text-muted ${r.status === "new" || r.status === "in_review" ? "" : "hidden"}`}>הבקשה התקבלה. אנחנו בודקים מחירי שוק והתאמה ונחזור אליכם כאן.</div>
      )}

      {r.accessories?.length ? (
        <div className="card mb-4 flex flex-col gap-1 text-sm">
          <h2 className="text-base font-bold text-ink">ציוד נלווה</h2>
          {r.accessories.map((a, i) => (
            <div key={i} className="flex justify-between">
              <span>{a.name}</span>
              {a.quotedFromILS && a.quotedToILS ? (
                <span className="font-bold text-teal-dark">{a.quotedFromILS.toLocaleString("he-IL")} - {a.quotedToILS.toLocaleString("he-IL")} ₪</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {r.chosenOptionIndex !== undefined && r.options?.[r.chosenOptionIndex] ? (
        <div className="card mb-4 text-sm">
          האפשרות שהלקוח אישר: <b>{r.options[r.chosenOptionIndex]!.label}</b>
          {r.finalPriceILS ? <> · מחיר סופי: <b className="text-teal-dark">{r.finalPriceILS.toLocaleString("he-IL")} ₪</b></> : null}
          {r.collection ? (
            <div className="mt-1 text-xs text-ink">
              נגבה ע״י {r.collection.by === "branch" ? "הסניף" : "הנהלה"}: {r.collection.amountILS.toLocaleString("he-IL")} ₪
              {r.collection.by === "branch" && typeof r.commissionILS === "number" ? <> · עמלת הסניף: <b className="text-teal-dark">{r.commissionILS.toLocaleString("he-IL")} ₪</b></> : null}
            </div>
          ) : null}
          {r.stockNote ? <div className="mt-1 text-xs text-muted">{r.stockNote}</div> : null}
          {r.shippingNote ? <div className="mt-1 text-xs text-muted">משלוח: {r.shippingNote}</div> : null}
        </div>
      ) : null}

      {r.status === "no_stock" ? (
        <div className="card mb-4 text-sm text-ink">אין מלאי כרגע לאפשרות הזו. {r.stockNote || "נחזור אליכם עם חלופה."}</div>
      ) : null}

      {isOwner && r.collection?.by === "branch" ? (
        <form action={adjustCommissionAction.bind(null, r.id)} className="card mb-4 flex flex-wrap items-end gap-2 text-sm">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">עמלת הסניף (₪) - ניתן לתיקון</label>
            <input name="commissionILS" defaultValue={r.commissionILS ?? 0} inputMode="numeric" className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">סיבה (רשות)</label>
            <input name="commissionNote" defaultValue={r.commissionNote ?? ""} className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="btn-outline text-xs">עדכון עמלה</button>
        </form>
      ) : null}

      <div className="mb-4">
        <StageActions id={r.id} status={r.status} isOwner={isOwner} options={(r.options ?? []).map((o) => ({ label: o.label }))} finalPriceILS={r.finalPriceILS} accessoriesFinalILS={r.accessoriesFinalILS} hasAccessories={r.spec.kind === "desktop" || (r.spec.extras?.length ?? 0) > 0 || (r.accessories?.length ?? 0) > 0} expectedCommissionILS={expectedCommission} commissionOverridden={typeof r.commissionOverrideILS === "number"} />
      </div>

      {isOwner && ["new", "in_review", "answered", "no_stock"].includes(r.status) ? (
        <RespondForm
          id={r.id}
          requestedSpecText={specToText(r.spec)}
          upgradeSpecText={upgrade ? specToText(upgrade.spec) : ""}
          upgradeWhy={upgrade ? upgrade.reasons.join("\n") : ""}
          marketPrompt={buildMarketPrompt(r)}
          status={r.status}
          aiEnabled={storeAiConfigured()}
          isDesktop={r.spec.kind === "desktop"}
          extras={r.spec.extras ?? []}
        />
      ) : null}
    </div>
  );
}
