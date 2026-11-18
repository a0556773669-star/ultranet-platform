import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { currentModuleScope, requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { STORE_STATUS_LABEL as STATUS_LABEL } from "@/lib/store-status";
import { specToText } from "@/lib/store-wizard";
import type { StoreRequest } from "@ultranet/shared-types";
import { StoreTabs } from "../store-tabs";

export const dynamic = "force-dynamic";

const STATUS_CLASS: Record<string, string> = {
  new: "border-amber-300 bg-amber-50 text-amber-700",
  in_review: "border-purple bg-[#f4ecf8] text-purple",
  answered: "border-teal bg-teal-bg text-teal-dark",
  closed: "border-card-border bg-[#f4f6f9] text-muted",
};

export default async function StoreRequestsPage() {
  await requireModuleAccess("store");
  const scope = await currentModuleScope("store");
  const snap = await getAdminFirestore().collection("n_store_requests").get();
  const requests = snap.docs
    .map((d) => ({ ...(d.data() as Omit<StoreRequest, "id">), id: d.id }) as StoreRequest)
    .filter((r) => scope?.isOwner || scope?.allows(r.branchId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <ShoppingBag className="h-5 w-5" />
        {scope?.isOwner ? "בקשות מהסניפים" : "הבקשות שלי"}
      </h1>
      <StoreTabs isOwner={Boolean(scope?.isOwner)} />
      {!requests.length ? (
        <div className="card text-sm text-muted">עדיין אין בקשות.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => (
            <Link key={r.id} href={`/dashboard/store/requests/${r.id}`} className="card block transition hover:border-teal">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-ink">{r.customerName}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_CLASS[r.status] ?? STATUS_CLASS.closed}`}>{STATUS_LABEL[r.status]}</span>
                <span className="text-xs text-muted">{r.branchName} · {new Date(r.createdAt).toLocaleString("he-IL")}</span>
              </div>
              <div className="mt-1 text-xs text-muted">{specToText(r.spec)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
