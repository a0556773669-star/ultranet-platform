import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CoworkingClient, CoworkingStation, Branch } from "@ultranet/shared-types";
import { addPaymentAction } from "./actions";

async function loadData() {
  const db = getAdminFirestore();
  const [clientsSnap, stationsSnap, branchesSnap] = await Promise.all([
    db.collection("n_cw_clients").get(),
    db.collection("n_cw_stations").get(),
    db.collection("n_branches").get(),
  ]);
  const clients = clientsSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<CoworkingClient, "id">) }) as CoworkingClient,
  );
  const stations = new Map(stationsSnap.docs.map((d) => [d.id, d.data() as CoworkingStation]));
  const branches = new Map(branchesSnap.docs.map((d) => [d.id, d.data() as Branch]));
  return { clients, stations, branches };
}

export default async function CoworkingPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const myBranchId = session?.user?.branchId;

  const { clients, stations, branches } = await loadData();
  const visible = clients.filter((c) => role === "owner" || c.branchId === myBranchId);
  const active = visible.filter((c) => !c.endDate);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">קוורקינג</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/coworking/stations" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            עמדות
          </Link>
          <Link href="/dashboard/coworking/new" className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-dark">
            + לקוח קוורקינג
          </Link>
        </div>
      </div>

      {active.length === 0 ? (
        <p className="text-sm text-gray-500">אין לקוחות קוורקינג פעילים.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {active.map((c) => {
            const station = stations.get(c.stationId);
            const branch = branches.get(c.branchId);
            const lastPayment = c.payments[c.payments.length - 1];
            const bound = addPaymentAction.bind(null, c.id);
            return (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-gray-800">{c.name}</span>
                    <span className="mr-2 text-sm text-gray-500">
                      {station?.name ?? "-"} {role === "owner" ? `· ${branch?.name ?? "-"}` : ""}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {lastPayment ? `תשלום אחרון: ${lastPayment.month} · ${lastPayment.amount} ₪` : "אין תשלומים עדיין"}
                  </span>
                </div>
                <form action={bound} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">חודש</label>
                    <input
                      name="month"
                      type="month"
                      required
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">סכום</label>
                    <input
                      name="amount"
                      type="number"
                      min={0}
                      required
                      defaultValue={c.customPrice ?? station?.price ?? 0}
                      className="w-28 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">אמצעי תשלום</label>
                    <input
                      name="paymentMethod"
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-teal focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-teal px-4 py-1.5 text-sm font-medium text-white transition hover:bg-teal-dark"
                  >
                    רישום תשלום
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
