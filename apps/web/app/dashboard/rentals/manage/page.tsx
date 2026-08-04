import Link from "next/link";
import { FileText, Laptop as LaptopIcon, Wifi } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { resolveNedarimCreds, listNedarimRoutes } from "@/lib/nedarim";
import type { Rental, RentalClient, Laptop, Stick, Branch, CollectionRoute } from "@ultranet/shared-types";
import { RentalsLists, type ActiveRowData, type HistoryRowData } from "./rentals-lists";

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
  const rentals = rentalsSnap.docs.map((d) => ({ ...(d.data() as Omit<Rental, "id">), id: d.id }) as Rental);
  const clients = new Map(clientsSnap.docs.map((d) => [d.id, d.data() as RentalClient]));
  const laptopsList = laptopsSnap.docs.map((d) => ({ ...(d.data() as Omit<Laptop, "id">), id: d.id }) as Laptop);
  const sticksList = sticksSnap.docs.map((d) => ({ ...(d.data() as Omit<Stick, "id">), id: d.id }) as Stick);
  const laptops = new Map(laptopsList.map((l) => [l.id, l]));
  const sticks = new Map(sticksList.map((s) => [s.id, s]));
  const branchesList = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const branches = new Map(branchesList.map((b) => [b.id, b]));
  const routesList = routesSnap.docs.map((d) => ({ ...(d.data() as Omit<CollectionRoute, "id">), id: d.id }) as CollectionRoute);
  return { rentals, clients, laptops, sticks, laptopsList, sticksList, branches, branchesList, routesList };
}

export default async function RentalsPage({ searchParams }: { searchParams?: { mine?: string } }) {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;
  const perms = (session.user as { perms?: Partial<Record<string, boolean>> } | undefined)?.perms;
  const canCharge = role === "owner" || !!perms?.charging;
  const canDelete = role === "owner" || role === "partner";
  const onlyMine = searchParams?.mine === "1";

  const { rentals, clients, laptops, sticks, laptopsList, sticksList, branches, branchesList, routesList } = await loadData();

  const myOwnBranchIds = branchesList.filter((b) => b.isMine === true).map((b) => b.id);
  const visible = rentals.filter((r) => (role === "owner" && !onlyMine) || r.branchId === myBranchId || (onlyMine && myOwnBranchIds.includes(r.branchId)));
  const active = visible.filter((r) => r.status === "active");
  const history = visible.filter((r) => r.status !== "active").slice(0, 20);

  const visibleBranches = onlyMine
    ? branchesList.filter((b) => b.isMine === true)
    : role === "owner"
    ? branchesList
    : branchesList.filter((b) => b.id === myBranchId);

  const chargeRoutes = await listNedarimRoutes();

  // Charging a saved token must go through the same route it was tokenized under - resolve per
  // (branch, client route) combo actually in use, not just per branch, so each client's charge
  // button reflects the business their card is really tied to.
  const tokenRouteKeys = Array.from(
    new Set(
      active
        .filter((r) => {
          const c = clients.get(r.clientId);
          return !!(c?.gatewayToken && c?.cardExpiry);
        })
        .map((r) => `${r.branchId}::${clients.get(r.clientId)?.collectionRouteId ?? ""}`)
    )
  );
  const tokenCredsEntries = await Promise.all(
    tokenRouteKeys.map(async (key) => {
      const [branchId, routeId] = key.split("::");
      return [key, await resolveNedarimCreds(branchId, routeId || undefined)] as const;
    })
  );
  const tokenCredsMap = new Map(tokenCredsEntries);

  function renterName(itemId: string, kind: "laptop" | "stick") {
    const rental = active.find((r) => r.itemId === itemId && r.kind === kind);
    if (!rental) return null;
    return clients.get(rental.clientId)?.name ?? "לקוח";
  }

  function linkedStickRentedOut(laptopId: string) {
    const stick = sticksList.find((s) => s.linkedLaptopId === laptopId);
    return stick ? !!renterName(stick.id, "stick") : false;
  }

function routesForBranch(branchId: string): { id: string; name: string }[] {
    const branch = branches.get(branchId);
    if (!branch?.allowCollection) return [];
    return routesList
      .filter((rt) => !rt.branchScope || rt.branchScope === branchId)
      .map((rt) => ({ id: rt.id, name: rt.name }));
  }

  function itemOptionsFor(branchId: string, kind: "laptop" | "stick"): { id: string; name: string }[] {
    const list = kind === "stick" ? sticksList : laptopsList;
    return list
      .filter((it) => it.branchId === branchId)
      .map((it) => ({ id: it.id, name: it.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
  }

    function rowInfo(r: Rental) {
    const item = r.kind === "stick" ? sticks.get(r.itemId) : laptops.get(r.itemId);
    const client = clients.get(r.clientId);
    return {
      clientName: client?.name ?? "-",
      clientPhone: client?.phone,
      clientIdNum: client?.idNum,
      cardLast4: client?.cardLast4,
      hasCardToken: !!(client?.gatewayToken && client?.cardExpiry),
      itemName: item?.name ?? "-",
      branchName: branches.get(r.branchId)?.name ?? "-",
    };
  }

  const activeRows: ActiveRowData[] = active.map((r) => {
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
        ? { day1: (item as Stick).day1, day2: (item as Stick).day2, day3plus: (item as Stick).day3plus }
        : undefined;
    const client = clients.get(r.clientId);
    const tokenKey = `${r.branchId}::${client?.collectionRouteId ?? ""}`;
    const tokenRouteName = info.hasCardToken ? (tokenCredsMap.get(tokenKey)?.name ?? null) : null;
    return {
      rentalId: r.id,
      startDate: r.startDate,
      kind: r.kind,
      pricingVariant: r.pricingVariant,
      clientId: r.clientId,
      clientName: info.clientName,
      clientPhone: info.clientPhone,
      clientIdNum: info.clientIdNum,
      cardLast4: info.cardLast4,
      hasCardToken: info.hasCardToken,
      itemId: r.itemId,
      itemName: info.itemName,
      itemOptions: itemOptionsFor(r.branchId, r.kind),
      branchName: info.branchName,
      showBranch: role === "owner",
      calcPrice: r.calcPrice,
      notes: r.notes,
      laptopRates,
      stickRates,
      hasRoute: !!r.collectionRouteId,
      tokenRouteName: canCharge ? tokenRouteName : null,
      chargeRoutes: canCharge ? chargeRoutes : [],
      canDelete,
      canCharge,
    };
  });

  const historyRows: HistoryRowData[] = history.map((r) => {
    const info = rowInfo(r);
    return {
      rentalId: r.id,
      clientId: r.clientId,
      clientName: info.clientName,
      clientPhone: info.clientPhone,
      itemId: r.itemId,
      itemName: info.itemName,
      itemOptions: itemOptionsFor(r.branchId, r.kind),
      branchName: info.branchName,
      startDate: r.startDate,
      returnDate: r.returnDate ?? r.endDate,
      price: r.finalPrice ?? r.calcPrice,
      notes: r.notes,
      paid: !!r.paid,
      routes: routesForBranch(r.branchId),
      canDelete,
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <FileText className="h-4 w-4" />
          {"איחוד השכרות"}
        </h1>
        <p className="text-sm text-muted">ניהול השכרות פעילות והיסטוריה</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wide text-muted">מצב מחשבים וסטיקים</div>
        <Link
          href={onlyMine ? "/dashboard/rentals/new?mine=1" : "/dashboard/rentals/new"}
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
          const bLaptops = laptopsList
            .filter((l) => l.branchId === b.id)
            .sort((x, y) => x.name.localeCompare(y.name, "he", { numeric: true }));
          const bRentedSticks = sticksList
            .filter((s) => s.branchId === b.id && renterName(s.id, "stick"))
            .sort((x, y) => x.name.localeCompare(y.name, "he", { numeric: true }));
          if (bLaptops.length === 0 && bRentedSticks.length === 0) return null;
          return (
            <div key={b.id} className="mb-2">
              {role === "owner" && <h3 className="mb-2 text-sm font-bold text-ink">{b.name}</h3>}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {bLaptops.map((l) => {
                  const renter = renterName(l.id, "laptop");
                  const noInternet = !renter && linkedStickRentedOut(l.id);
                  return (
                    <div
                      key={l.id}
                      className={`rounded-xl border p-3 text-center text-xs ${
                        renter ? "border-red-300 bg-red-50" : "border-teal bg-teal-bg"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1 truncate font-bold text-ink">
                        <LaptopIcon className="h-4 w-4 shrink-0" />
                        {l.name}
                      </div>
                      <div className={`mt-1 text-[11px] font-semibold ${renter ? "text-red-600" : "text-teal-dark"}`}>
                        {renter ? "מושכר" : "פנוי"}
                      </div>
                      {renter && <div className="mt-1 truncate text-[11px] text-muted">{renter}</div>}
                      {noInternet && <div className="mt-1 text-[11px] font-bold text-red-600">ללא אינטרנט</div>}
                    </div>
                  );
                })}
                {bRentedSticks.map((s) => {
                  const renter = renterName(s.id, "stick");
                  return (
                    <div key={s.id} className="rounded-xl border border-red-300 bg-red-50 p-3 text-center text-xs">
                      <div className="flex items-center justify-center gap-1 truncate font-bold text-ink">
                        <Wifi className="h-4 w-4 shrink-0" />
                        {s.name}
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-red-600">מושכר</div>
                      {renter && <div className="mt-1 truncate text-[11px] text-muted">{renter}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <RentalsLists active={activeRows} history={historyRows} showBranchColumn={role === "owner"} />
    </div>
  );
}
