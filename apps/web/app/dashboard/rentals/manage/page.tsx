import Link from "next/link";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { resolveNedarimCreds } from "@/lib/nedarim";
import type { Rental, RentalClient, Laptop, Stick, Branch, CollectionRoute } from "@ultranet/shared-types";
import { ActiveRentalRow } from "./active-rental-row";
import { UnpaidRowActions } from "./unpaid-row-actions";

async function loadData() {
  const db = getAdminFirestore();
  const [rentalsSnap, clientsSnap, laptopsSnap, sticksSnap, branchesSnap, routesSnap] = await Promise.all([
    db.collection("n_rentals").get(),
    db.collection("n_rental_clients").get(),
    db.collection("n_laptops").get(),
    db.collection("n_sticks").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
    db.collection("n_collection_routes").get(),
  ]);
  const rentals = rentalsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Rental, "id">) }) as Rental);
  const clients = new Map(clientsSnap.docs.map((d) => [d.id, d.data() as RentalClient]));
  const laptopsList = laptopsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Laptop, "id">) }) as Laptop);
  const sticksList = sticksSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Stick, "id">) }) as Stick);
  const laptops = new Map(laptopsList.map((l) => [l.id, l]));
  const sticks = new Map(sticksList.map((s) => [s.id, s]));
  const branchesList = branchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch);
  const branches = new Map(branchesList.map((b) => [b.id, b]));
  const routesList = routesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CollectionRoute, "id">) }) as CollectionRoute);
  return { rentals, clients, laptops, sticks, laptopsList, sticksList, branches, branchesList, routesList };
}

export default async function RentalsPage() {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

  const { rentals, clients, laptops, sticks, laptopsList, sticksList, branches, branchesList, routesList } = await loadData();

  const visible = rentals.filter((r) => role === "owner" || r.branchId === myBranchId);
  const active = visible.filter((r) => r.status === "active");
  const history = visible.filter((r) => r.status !== "active").slice(0, 20);

  const visibleBranches = role === "owner" ? branchesList : branchesList.filter((b) => b.id === myBranchId);

  const activeBranchIds = Array.from(new Set(active.map((r) => r.branchId)));
  const credsEntries = await Promise.all(
    activeBranchIds.map(async (id) => [id, await resolveNedarimCreds(id)] as const)
  );
  const credsMap = new Map(credsEntries);

  function renterName(itemId: string, kind: "laptop" | "stick") {
    const rental = active.find((r) => r.itemId === itemId && r.kind === kind);
    if (!rental) return null;
    return clients.get(rental.clientId)?.name ?? "לקוח";
  }

function routesForBranch(branchId: string): { id: string; name: string }[] {
    const branch = branches.get(branchId);
    if (!branch?.allowCollection) return [];
    return routesList
      .filter((rt) => !rt.branchScope || rt.branchScope === branchId)
      .map((rt) => ({ id: rt.id, name: rt.name }));
  }

    function rowInfo(r: Rental) {
    const item = r.kind === "stick" ? sticks.get(r.itemId) : laptops.get(r.itemId);
    return {
      clientName: clients.get(r.clientId)?.name ?? "-",
      clientPhone: clients.get(r.clientId)?.phone,
      clientIdNum: clients.get(r.clientId)?.idNum,
      itemName: item?.name ?? "-",
      branchName: branches.get(r.branchId)?.name ?? "-",
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[21px] font-extrabold text-ink">📄 איחוד השכרות</h1>
        <p className="text-sm text-muted">ניהול השכרות פעילות והיסטוריה</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wide text-muted">מצב מחשבים וסטיקים</div>
        <Link
          href="/dashboard/rentals/new"
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
        >
          + השכרה חדשה
        </Link>
      </div>

      {visibleBranches.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
          אין סניפים להצגה
        </div>
      ) : (
        visibleBranches.map((b) => {
          const bLaptops = laptopsList.filter((l) => l.branchId === b.id);
          const bSticks = sticksList.filter((s) => s.branchId === b.id);
          if (bLaptops.length === 0 && bSticks.length === 0) return null;
          return (
            <div key={b.id} className="mb-2">
              {role === "owner" && <h3 className="mb-2 text-sm font-bold text-ink">{b.name}</h3>}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {bLaptops.map((l) => {
                  const renter = renterName(l.id, "laptop");
                  return (
                    <div
                      key={l.id}
                      className={`rounded-xl border p-3 text-center text-xs ${
                        renter ? "border-red-300 bg-red-50" : "border-teal bg-teal-bg"
                      }`}
                    >
                      <div className="truncate font-bold text-ink">💻 {l.name}</div>
                      <div className={`mt-1 text-[11px] font-semibold ${renter ? "text-red-600" : "text-teal-dark"}`}>
                        {renter ? "מושכר" : "פנוי"}
                      </div>
                      {renter && <div className="mt-1 truncate text-[11px] text-muted">{renter}</div>}
                    </div>
                  );
                })}
                {bSticks.map((s) => {
                  const renter = renterName(s.id, "stick");
                  return (
                    <div
                      key={s.id}
                      className={`rounded-xl border p-3 text-center text-xs ${
                        renter ? "border-red-300 bg-red-50" : "border-teal bg-teal-bg"
                      }`}
                    >
                      <div className="truncate font-bold text-ink">📡 {s.name}</div>
                      <div className={`mt-1 text-[11px] font-semibold ${renter ? "text-red-600" : "text-teal-dark"}`}>
                        {renter ? "מושכר" : "פנוי"}
                      </div>
                      {renter && <div className="mt-1 truncate text-[11px] text-muted">{renter}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <div className="mb-3 mt-4 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
        <span>השכרות פעילות</span>
        <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{active.length}</span>
      </div>
      {active.length === 0 ? (
        <div className="mb-8 rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
          אין השכרות פעילות
        </div>
      ) : (
        <div className="mb-8 overflow-hidden rounded-card border border-card-border bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead className="bg-[#f4f6f9] text-muted">
              <tr>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">לקוח</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">פריט</th>
                {role === "owner" && (
                  <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סניף</th>
                )}
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">התחלה</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מחיר משוער</th>
                <th className="px-[11px] py-[9px]"></th>
              </tr>
            </thead>
            <tbody>
              {active.map((r) => {
                const info = rowInfo(r);
                const item = r.kind === "stick" ? sticks.get(r.itemId) : laptops.get(r.itemId);
                const laptopRates =
                  r.kind === "laptop" && item
                    ? {
                        dayPrice: (item as Laptop).dayPrice,
                        weekPrice: (item as Laptop).weekPrice,
                        monthPrice: (item as Laptop).monthPrice,
                        altPricing: (item as Laptop).altPricing,
                        noInternetDayPrice: (item as Laptop).noInternetDayPrice,
                        noInternetWeekPrice: (item as Laptop).noInternetWeekPrice,
                        noInternetMonthPrice: (item as Laptop).noInternetMonthPrice,
                      }
                    : undefined;
                const stickRates =
                  r.kind === "stick" && item
                    ? {
                        day1: (item as Stick).day1,
                        day2: (item as Stick).day2,
                        day3plus: (item as Stick).day3plus,
                      }
                    : undefined;
                const creds = credsMap.get(r.branchId) ?? null;
                return (
                  <ActiveRentalRow
                    key={r.id}
                    rentalId={r.id}
                    startDate={r.startDate}
                    kind={r.kind}
                    pricingVariant={r.pricingVariant}
                    clientName={info.clientName}
                    clientPhone={info.clientPhone}
                    clientIdNum={info.clientIdNum}
                    itemName={info.itemName}
                    branchName={info.branchName}
                    showBranch={role === "owner"}
                    calcPrice={r.calcPrice}
                    notes={r.notes}
                    laptopRates={laptopRates}
                    stickRates={stickRates}
                    hasRoute={!!r.collectionRouteId}
                    nedarimCreds={creds ? { mosadId: creds.mosadId, apiValid: creds.apiValid } : null}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
        <span>היסטוריה אחרונה</span>
        <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{history.length}</span>
      </div>
      {history.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
          אין היסטוריה עדיין
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead className="bg-[#f4f6f9] text-muted">
              <tr>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">לקוח</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">פריט</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">התחלה</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">החזרה</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מחיר</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">תשלום</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => {
                const info = rowInfo(r);
                return (
                  <tr
                    key={r.id}
                    className={`border-t border-card-border transition hover:bg-[#f8fafc] ${!r.paid ? "bg-red-50" : ""}`}
                  >
                    <td className="px-[11px] py-2 text-muted">{info.clientName}</td>
                    <td className="px-[11px] py-2 text-muted">{info.itemName}</td>
                    <td className="px-[11px] py-2 text-muted">{r.startDate}</td>
                    <td className="px-[11px] py-2 text-muted">{r.returnDate ?? r.endDate}</td>
                    <td className="px-[11px] py-2 font-semibold text-ink">{(r.finalPrice ?? r.calcPrice)} ₪</td>
                    <td className="px-[11px] py-2">
                      {r.paid ? (
                        <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">שולם</span>
                      ) : (
                        <UnpaidRowActions rentalId={r.id} routes={routesForBranch(r.branchId)} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
