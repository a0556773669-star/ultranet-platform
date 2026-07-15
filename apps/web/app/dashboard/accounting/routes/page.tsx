import { CreditCard } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CollectionRoute, Branch } from "@ultranet/shared-types";
import { createCollectionRouteAction, deleteCollectionRouteAction } from "../actions";
import { DeleteRouteButton } from "./delete-route-button";

const PROVIDER_LABELS: Record<string, string> = {
  manual: "ידני",
  nedarim_plus: "Nedarim Plus",
  tranzila: "Tranzila",
  cardcom: "Cardcom",
};

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export default async function CollectionRoutesPage() {
  await requireModuleAccess("accounting");

  const db = getAdminFirestore();
  const [routesSnap, branchesSnap] = await Promise.all([
    db.collection("n_collection_routes").get(),
    db.collection("n_branches").get(),
  ]);
  const routes = routesSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<CollectionRoute, "id">) }) as CollectionRoute,
  );
  const branches = branchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch);
  const branchName = (id: string | null) =>
    id ? (branches.find((b) => b.id === id)?.name ?? "-") : "כל הסניפים";

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><CreditCard className="h-5 w-5" />מסלולי גביה</h1>

      <form
        action={createCollectionRouteAction}
        className="mb-6 grid grid-cols-1 gap-4 rounded-card border border-card-border bg-white p-5 shadow-card sm:grid-cols-2"
      >
        <div>
          <label className={LABEL}>שם המסלול</label>
          <input name="name" required className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>ספק</label>
          <select name="provider" className={FIELD}>
            <option value="manual">ידני</option>
            <option value="nedarim_plus">Nedarim Plus</option>
            <option value="tranzila">Tranzila</option>
            <option value="cardcom">Cardcom</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>מספר מוסד (Mosad ID / Terminal ID)</label>
          <input name="terminalId" dir="ltr" className={FIELD} />
          <p className="mt-1 text-[11px] text-muted">
            בנדרים פלוס: המספר שמזהה את המוסד שלך אצלם.
          </p>
        </div>
        <div>
          <label className={LABEL}>מזהה סניף (ריק למסלול של כל הסניפים)</label>
          <input name="branchScope" placeholder="ריק לכל הסניפים" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>מטבע</label>
          <input name="currency" defaultValue="ILS" dir="ltr" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>אחוז עמלה (%)</label>
          <input name="feePct" type="number" min={0} step="0.01" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>עמלה קבועה לעסקה</label>
          <input name="feeFixed" type="number" min={0} step="0.01" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>יעד הפקדה</label>
          <select name="depositsTo" className={FIELD}>
            <option value="owner">בעלים</option>
            <option value="branch">סניף</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>API Key / טוקן ApiValid (לא חובה)</label>
          <input name="apiKey" type="password" dir="ltr" autoComplete="off" className={FIELD} />
          <p className="mt-1 text-[11px] text-muted">
            בנדרים פלוס: כאן מכניסים את טוקן ה-ApiValid (מבקשים אותו במפורש משירות הלקוחות שלהם).
          </p>
        </div>
        <div>
          <label className={LABEL}>API Secret (לא חובה)</label>
          <input name="apiSecret" type="password" dir="ltr" autoComplete="off" className={FIELD} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>הפקת קבלות</label>
          <select name="receiptsProvider" className={FIELD} defaultValue="none">
            <option value="none">ללא הפקת קבלות</option>
            <option value="icount">iCount</option>
            <option value="green_invoice">חשבונית ירוקה</option>
          </select>
        </div>
        <div>
          <label className={LABEL}>מזהה חברה אצל ספק הקבלות</label>
          <input name="receiptsCompanyId" dir="ltr" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>API Key לקבלות (לא חובה)</label>
          <input name="receiptsApiKey" type="password" dir="ltr" autoComplete="off" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>API Secret לקבלות (לא חובה)</label>
          <input name="receiptsApiSecret" type="password" dir="ltr" autoComplete="off" className={FIELD} />
        </div>
        <button
          type="submit"
          className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 sm:col-span-2"
        >
          הוספת מסלול
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f4f6f9] text-muted">
            <tr>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">שם</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">ספק</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">היקף</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">יעד הפקדה</th>
              <th className="px-[11px] py-[9px]"></th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => {
              const bound = deleteCollectionRouteAction.bind(null, r.id);
              return (
                <tr key={r.id} className="border-t border-card-border transition hover:bg-[#f8fafc]">
                  <td className="px-[11px] py-2 font-semibold text-ink">{r.name}</td>
                  <td className="px-[11px] py-2 text-muted">{PROVIDER_LABELS[r.provider] ?? r.provider}</td>
                  <td className="px-[11px] py-2 text-muted">{branchName(r.branchScope)}</td>
                  <td className="px-[11px] py-2 text-muted">{r.depositsTo === "owner" ? "בעלים" : "סניף"}</td>
                  <td className="px-[11px] py-2">
                    <form action={bound}>
                      <DeleteRouteButton />
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
