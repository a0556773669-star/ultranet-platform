import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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

export default async function CollectionRoutesPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "owner") {
    redirect("/dashboard");
  }

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
      <h1 className="mb-6 text-2xl font-bold text-gray-800">מסלולי גביה</h1>

      <form
        action={createCollectionRouteAction}
        className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-6 sm:grid-cols-2"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">שם המסלול</label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">ספק</label>
          <select
            name="provider"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          >
            <option value="manual">ידני</option>
            <option value="nedarim_plus">Nedarim Plus</option>
            <option value="tranzila">Tranzila</option>
            <option value="cardcom">Cardcom</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">מזהה סניף (ריק למסלול של סניף ספציפי)</label>
          <input
            name="branchScope"
            placeholder="ריק לכל הסניפים"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">מטבע</label>
          <input
            name="currency"
            defaultValue="ILS"
            dir="ltr"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">אחוז עמלה (%)</label>
          <input
            name="feePct"
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">עמלה קבועה לעסקה</label>
          <input
            name="feeFixed"
            type="number"
            min={0}
            step="0.01"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">יעד הפקדה</label>
          <select
            name="depositsTo"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          >
            <option value="owner">בעלים</option>
            <option value="branch">סניף</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">API Key (לא חובה)</label>
          <input
            name="apiKey"
            type="password"
            dir="ltr"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">API Secret (לא חובה)</label>
          <input
            name="apiSecret"
            type="password"
            dir="ltr"
            autoComplete="off"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="self-start rounded-lg bg-teal px-6 py-2 font-medium text-white transition hover:bg-teal-dark sm:col-span-2"
        >
          הוספת מסלול
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">שם</th>
              <th className="px-4 py-3 font-medium">ספק</th>
              <th className="px-4 py-3 font-medium">היקף</th>
              <th className="px-4 py-3 font-medium">יעד הפקדה</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {routes.map((r) => {
              const bound = deleteCollectionRouteAction.bind(null, r.id);
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.name}</td>
                  <td className="px-4 py-3 text-gray-600">{PROVIDER_LABELS[r.provider] ?? r.provider}</td>
                  <td className="px-4 py-3 text-gray-600">{branchName(r.branchScope)}</td>
                  <td className="px-4 py-3 text-gray-600">{r.depositsTo === "owner" ? "בעלים" : "סניף"}</td>
                  <td className="px-4 py-3">
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
