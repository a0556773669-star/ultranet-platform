import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { currentModuleScope, requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { buildMarketPrompt, specToText, suggestUpgrade } from "@/lib/store-wizard";
import type { StoreRequest } from "@ultranet/shared-types";
import { StoreTabs } from "../../store-tabs";
import { STORE_STATUS_LABEL as STATUS_LABEL } from "@/lib/store-status";
import { RespondForm } from "./respond-form";

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

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">בקשה: {r.customerName}</h1>
      <StoreTabs />
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
        <div className="card mb-4 text-sm text-muted">הבקשה התקבלה. אנחנו בודקים מחירי שוק והתאמה ונחזור אליכם כאן.</div>
      )}

      {isOwner ? (
        <RespondForm
          id={r.id}
          requestedSpecText={specToText(r.spec)}
          upgradeSpecText={upgrade ? specToText(upgrade.spec) : ""}
          upgradeWhy={upgrade ? upgrade.reasons.join("\n") : ""}
          marketPrompt={buildMarketPrompt(r)}
          status={r.status}
        />
      ) : null}
    </div>
  );
}
