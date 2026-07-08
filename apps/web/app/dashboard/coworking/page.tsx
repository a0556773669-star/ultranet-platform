import Link from "next/link";
import { requireModuleAccess } from "@/lib/perms";
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
  const session = await requireModuleAccess("coworking");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

  const { clients, stations, branches } = await loadData();
  const visible = clients.filter((c) => role === "owner" || c.branchId === myBranchId);
  const active = visible.filter((c) => !c.endDate);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[21px] font-extrabold text-ink">🏢 משרד שיתופי</h1>
          <p className="mt-1 text-[13px] text-muted">עמדות, לקוחות ותשלומי קוורקינג</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/coworking/stations"
            className="rounded-lg border border-card-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-teal hover:text-teal"
          >
            🪑 עמדות
          </Link>
          <Link
            href="/dashboard/coworking/new"
            className="rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
          >
            + לקוח קוורקינג
          </Link>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-14 text-center text-muted">
          אין לקוחות קוורקינג פעילים
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((c) => {
            const station = stations.get(c.stationId);
            const branch = branches.get(c.branchId);
            const lastPayment = c.payments[c.payments.length - 1];
            const bound = addPaymentAction.bind(null, c.id);
            return (
              <div key={c.id} className="rounded-card border border-card-border bg-white p-4 shadow-card">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-extrabold text-ink">👤 {c.name}</span>
                    <span className="mr-2 text-sm text-muted">
                      {station?.name ?? "-"} {role === "owner" ? `· ${branch?.name ?? "-"}` : ""}
                    </span>
                  </div>
                  <span className="rounded-full bg-[#f4f6f9] px-2.5 py-1 text-xs font-bold text-muted">
                    {lastPayment ? `תשלום אחרון: ${lastPayment.month} · ${lastPayment.amount} ₪` : "אין תשלומים עדיין"}
                  </span>
                </div>
                <form action={bound} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">חודש</label>
                    <input
                      name="month"
                      type="month"
                      required
                      className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">סכום</label>
                    <input
                      name="amount"
                      type="number"
                      min={0}
                      required
                      defaultValue={c.customPrice ?? station?.price ?? 0}
                      className="w-28 rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">אמצעי תשלום</label>
                    <input
                      name="paymentMethod"
                      className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-1.5 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
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
