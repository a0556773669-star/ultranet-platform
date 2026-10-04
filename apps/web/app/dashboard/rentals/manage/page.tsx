import Link from "next/link";
import { FileText, Laptop as LaptopIcon, Wifi } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { makeNedarimResolver, nedarimRouteOptions } from "@/lib/nedarim";
import type { Rental, RentalClient, Laptop, Stick, Branch, CollectionRoute } from "@ultranet/shared-types";
import { effectiveLaptopRates, effectiveStickRates } from "@/lib/rental-pricing";
import { isLaptopActive } from "@/lib/laptop-names";
import { RentalsLists, type ActiveRowData, type HistoryRowData } from "./rentals-lists";

async function loadData() {
  const db = getAdminFirestore();
  const [rentalsSnap, clientsSnap, laptopsSnap, sticksSnap, branchesSnap, routesSnap] = await Promise.all([
    db.collection("n_rentals").get(),
    db.collection("n_rental_clients").get(),
    db.collection("n_laptops").get(),
    db.collection("n_sticks").get(),
    db.collection("n_branches").get(),
    db.collection("n_collection_routes").get(),
  ]);
  const rentals = rentalsSnap.docs.map((d) => ({ ...(d.data() as Omit<Rental, "id">), id: d.id }) as Rental);
  const clients = new Map(clientsSnap.docs.map((d) => [d.id, d.data() as RentalClient]));
  const laptopsList = laptopsSnap.docs.map((d) => ({ ...(d.data() as Omit<Laptop, "id">), id: d.id }) as Laptop);
  const sticksList = sticksSnap.docs.map((d) => ({ ...(d.data() as Omit<Stick, "id">), id: d.id }) as Stick);
  const laptops = new Map(laptopsList.map((l) => [l.id, l]));
  const sticks = new Map(sticksList.map((s) => [s.id, s]));
  // Every branch is read (not just branchType === "rentals") purely so charge-route resolution can
  // look a branch up in memory instead of fetching its document again; the rentals screens below
  // still work off `branchesList`, which stays rentals-only exactly as before.
  const allBranchesList = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const allBranches = new Map(allBranchesList.map((b) => [b.id, b]));
  const branchesList = allBranchesList.filter((b) => b.branchType === "rentals");
  const branches = new Map(branchesList.map((b) => [b.id, b]));
  const routesList = routesSnap.docs.map((d) => ({ ...(d.data() as Omit<CollectionRoute, "id">), id: d.id }) as CollectionRoute);
  return { rentals, clients, laptops, sticks, laptopsList, sticksList, branches, branchesList, allBranches, routesList };
}

export default async function RentalsPage({ searchParams }: { searchParams?: { mine?: string } }) {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;
  const perms = (session.user as { perms?: Partial<Record<string, boolean>> } | undefined)?.perms;
  const canCharge = role === "owner" || !!perms?.charging;
  const canDelete = role === "owner" || role === "partner";
  const onlyMine = searchParams?.mine === "1";

  const { rentals, clients, laptops, sticks, laptopsList, sticksList, branches, branchesList, allBranches, routesList } =
    await loadData();

  const myOwnBranchIds = branchesList.filter((b) => b.isMine === true).map((b) => b.id);
  const visible = rentals.filter((r) => (role === "owner" && !onlyMine) || r.branchId === myBranchId || (onlyMine && myOwnBranchIds.includes(r.branchId)));
  const active = visible.filter((r) => r.status === "active");
  // Sorted newest-first so both the dedicated "unpaid" list and the paginated history below show
  // the most relevant entries first. Capped generously (not to 20 anymore) so pagination on the
  // client has real pages to page through instead of always maxing out at one page of 20.
  const historyAll = visible
    .filter((r) => r.status !== "active")
    .sort((a, b) => (b.returnDate ?? b.endDate ?? "").localeCompare(a.returnDate ?? a.endDate ?? ""));
  const HISTORY_CAP = 500;
  const history = historyAll.slice(0, HISTORY_CAP);
  const unpaid = historyAll.filter((r) => !r.paid);

  const visibleBranches = onlyMine
    ? branchesList.filter((b) => b.isMine === true)
    : role === "owner"
    ? branchesList
    : branchesList.filter((b) => b.id === myBranchId);

  // Both of these used to be extra Firestore waves after loadData - a second full read of
  // n_collection_routes, then up to three sequential document reads per distinct (branch, route)
  // pair. Every one of those documents is already loaded above, so they're resolved in memory.
  const chargeRoutes = nedarimRouteOptions(routesList);
  const resolveCreds = makeNedarimResolver(routesList, allBranches);

  // Charging a saved token must go through the same route it was tokenized under - resolve per
  // (branch, client route) combo actually in use, not just per branch, so each client's charge
  // button reflects the business their card is really tied to.
  const tokenCredsMap = new Map<string, ReturnType<typeof resolveCreds>>();
  for (const r of active) {
    const c = clients.get(r.clientId);
    if (!c?.gatewayToken || !c?.cardExpiry) continue;
    const routeId = c.collectionRouteId ?? "";
    const key = `${r.branchId}::${routeId}`;
    if (tokenCredsMap.has(key)) continue;
    tokenCredsMap.set(key, resolveCreds(r.branchId, routeId || undefined));
  }

  // The item/branch lookups below are hit once per rendered card and once per rental row. Indexing
  // them up front keeps the page linear; scanning `active`/`sticksList` per lookup made it grow
  // with rentals x items, which is what made this screen crawl as the history piled up.
  // First entry wins, matching the .find() these replace - should the data ever hold two active
  // rentals for one item, the same one keeps being reported as before.
  const activeByItem = new Map<string, Rental>();
  for (const r of active) {
    const key = `${r.kind}::${r.itemId}`;
    if (!activeByItem.has(key)) activeByItem.set(key, r);
  }
  const stickByLinkedLaptop = new Map<string, Stick>();
  for (const s of sticksList) {
    if (s.linkedLaptopId && !stickByLinkedLaptop.has(s.linkedLaptopId)) {
      stickByLinkedLaptop.set(s.linkedLaptopId, s);
    }
  }

  function renterName(itemId: string, kind: "laptop" | "stick") {
    const rental = activeByItem.get(`${kind}::${itemId}`);
    if (!rental) return null;
    return clients.get(rental.clientId)?.name ?? "לקוח";
  }

  function linkedStickRentedOut(laptopId: string) {
    const stick = stickByLinkedLaptop.get(laptopId);
    return stick ? !!renterName(stick.id, "stick") : false;
  }

  // These two are memoised per key rather than rebuilt per row, which matters twice over: it drops
  // the repeated Hebrew localeCompare sorts, and - because every row for a branch now shares one
  // array instance - the RSC serializer emits each list once and references it thereafter instead
  // of writing a full copy into the payload for all several-hundred history rows.
  const routesByBranch = new Map<string, { id: string; name: string }[]>();
  function routesForBranch(branchId: string): { id: string; name: string }[] {
    const cached = routesByBranch.get(branchId);
    if (cached) return cached;
    const branch = branches.get(branchId);
    const result = !branch?.allowCollection
      ? []
      : routesList
          .filter((rt) => !rt.branchScope || rt.branchScope === branchId)
          .map((rt) => ({ id: rt.id, name: rt.name }));
    routesByBranch.set(branchId, result);
    return result;
  }

  const itemOptionsCache = new Map<string, { id: string; name: string }[]>();
  function itemOptionsFor(branchId: string, kind: "laptop" | "stick"): { id: string; name: string }[] {
    const key = `${kind}::${branchId}`;
    const cached = itemOptionsCache.get(key);
    if (cached) return cached;
    const list = kind === "stick" ? sticksList : laptopsList;
    const result = list
      .filter((it) => it.branchId === branchId && isLaptopActive(it))
      .map((it) => ({ id: it.id, name: it.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
    itemOptionsCache.set(key, result);
    return result;
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
    // המחירון בפועל = מה שהוזן על הפריט, וכל מה שחסר יורש ממחירון הסניף (מוגדר פעם אחת ב-/pricing).
    const branchPricing = branches.get(r.branchId)?.rentalPricing;
    const laptopRates =
      r.kind === "laptop" && item ? effectiveLaptopRates(item as Laptop, branchPricing) : undefined;
    const stickRates =
      r.kind === "stick" && item ? effectiveStickRates(item as Stick, branchPricing) : undefined;
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

  function toHistoryRow(r: Rental): HistoryRowData {
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
  }

  const historyRows: HistoryRowData[] = history.map(toHistoryRow);
  const unpaidRows: HistoryRowData[] = unpaid.map(toHistoryRow);

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
          // סניף שנסגר (או נמחק) לא מקבל לוח — אין בו מה להשכיר.
          if (b.closedAt || b.deleted) return null;
          const bLaptops = laptopsList
            .filter((l) => l.branchId === b.id && isLaptopActive(l))
            .sort((x, y) => x.name.localeCompare(y.name, "he", { numeric: true }));
          const bRentedSticks = sticksList
            .filter((s) => s.branchId === b.id && renterName(s.id, "stick"))
            .sort((x, y) => x.name.localeCompare(y.name, "he", { numeric: true }));
          if (bLaptops.length === 0 && bRentedSticks.length === 0) return null;
          return (
            <div key={b.id} className="mb-2">
              {role === "owner" && <h3 className="mb-2 text-sm font-bold text-ink">{b.name}</h3>}
              {/* ריבועים קטנים ולא פסים רחבים: רוחב קבוע של ~120px ממלא את השורה בכמה שנכנס,
                  כך שבמסך רחב רואים את כל הסניף בשורה-שתיים ולא שש כרטיסיות מתוחות. */}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(124px,1fr))]">
                {bLaptops.map((l) => {
                  const renter = renterName(l.id, "laptop");
                  const noInternet = !renter && linkedStickRentedOut(l.id);
                  return (
                    <div
                      key={l.id}
                      className={`relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border p-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                        renter
                          ? "border-red-200 bg-gradient-to-b from-red-50 to-white"
                          : "border-teal/40 bg-gradient-to-b from-teal-bg to-white"
                      }`}
                    >
                      <span
                        className={`absolute inset-x-0 top-0 h-1 ${renter ? "bg-red-400" : "bg-teal"}`}
                        aria-hidden
                      />
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          renter ? "bg-red-100 text-red-600" : "bg-white text-teal-dark shadow-sm"
                        }`}
                      >
                        <LaptopIcon className="h-[18px] w-[18px]" />
                      </span>
                      <div className="w-full truncate text-[12.5px] font-extrabold leading-tight text-ink" title={l.name}>
                        {l.name}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                          renter ? "bg-red-600 text-white" : "bg-teal text-white"
                        }`}
                      >
                        {renter ? "מושכר" : "פנוי"}
                      </span>
                      {renter && (
                        <div className="w-full truncate text-[10.5px] text-muted" title={renter}>
                          {renter}
                        </div>
                      )}
                      {noInternet && <div className="text-[10.5px] font-bold text-red-600">ללא אינטרנט</div>}
                    </div>
                  );
                })}
                {bRentedSticks.map((s) => {
                  const renter = renterName(s.id, "stick");
                  return (
                    <div
                      key={s.id}
                      className="relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-red-200 bg-gradient-to-b from-red-50 to-white p-2 text-center shadow-sm"
                    >
                      <span className="absolute inset-x-0 top-0 h-1 bg-red-400" aria-hidden />
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <Wifi className="h-[18px] w-[18px]" />
                      </span>
                      <div className="w-full truncate text-[12.5px] font-extrabold leading-tight text-ink" title={s.name}>
                        {s.name}
                      </div>
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10.5px] font-bold text-white">מושכר</span>
                      {renter && (
                        <div className="w-full truncate text-[10.5px] text-muted" title={renter}>
                          {renter}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      <RentalsLists active={activeRows} unpaid={unpaidRows} history={historyRows} showBranchColumn={role === "owner"} />
    </div>
  );
}
