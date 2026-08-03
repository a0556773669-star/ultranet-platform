import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CollectionRoute } from "@ultranet/shared-types";

export type NedarimCreds = { mosadId: string; apiValid: string; routeId: string; name: string };
export type NedarimRouteOption = {
  id: string;
  name: string;
  mosadId: string;
  apiValid: string;
  defaultForNewCards: boolean;
};

/**
 * Resolves which Nedarim Plus route (business/merchant account) to charge through:
 * 1. An explicit routeId (e.g. a rental client's saved collectionRouteId - the route their
 *    gatewayToken was actually tokenized under). If given but not a valid connected Nedarim
 *    route, resolution fails outright (returns null) rather than silently falling back - a
 *    token is only valid for the merchant that created it, so guessing wrong would misroute
 *    (or reject) a real charge.
 * 2. Otherwise, a route explicitly assigned to the branch (branch.collectionRouteId).
 * 3. Otherwise, a global Nedarim Plus route (branchScope === null) - the owner's default
 *    fallback token so branches without their own merchant setup are still covered.
 */
export async function resolveNedarimCreds(
  branchId?: string | null,
  routeId?: string | null
): Promise<NedarimCreds | null> {
  const db = getAdminFirestore();

  if (routeId) {
    const routeDoc = await db.collection("n_collection_routes").doc(routeId).get();
    if (routeDoc.exists) {
      const route = routeDoc.data() as Omit<CollectionRoute, "id">;
      if (route.provider === "nedarim_plus" && route.terminalId && route.apiKey) {
        return { mosadId: route.terminalId, apiValid: route.apiKey, routeId: routeDoc.id, name: route.name };
      }
    }
    return null;
  }

  if (branchId) {
    const branchDoc = await db.collection("n_branches").doc(branchId).get();
    const collectionRouteId = (branchDoc.data() as { collectionRouteId?: string | null } | undefined)
      ?.collectionRouteId;
    if (collectionRouteId) {
      const routeDoc = await db.collection("n_collection_routes").doc(collectionRouteId).get();
      if (routeDoc.exists) {
        const route = routeDoc.data() as Omit<CollectionRoute, "id">;
        if (route.provider === "nedarim_plus" && route.terminalId && route.apiKey) {
          return { mosadId: route.terminalId, apiValid: route.apiKey, routeId: routeDoc.id, name: route.name };
        }
      }
    }
  }

  const globalSnap = await db
    .collection("n_collection_routes")
    .where("provider", "==", "nedarim_plus")
    .where("branchScope", "==", null)
    .limit(1)
    .get();
  if (!globalSnap.empty) {
    const doc = globalSnap.docs[0]!;
    const route = doc.data() as Omit<CollectionRoute, "id">;
    if (route.terminalId && route.apiKey) {
      return { mosadId: route.terminalId, apiValid: route.apiKey, routeId: doc.id, name: route.name };
    }
  }

  return null;
}

/**
 * All usable Nedarim Plus routes (connected merchant accounts), for UI that lets staff pick
 * which business a new card / fresh charge should belong to. Used by the rentals card-capture
 * and charge flows so a new client (or a client re-entering their card) can be routed to a
 * specific business instead of always following the branch's default route.
 */
export async function listNedarimRoutes(): Promise<NedarimRouteOption[]> {
  const db = getAdminFirestore();
  const snap = await db.collection("n_collection_routes").where("provider", "==", "nedarim_plus").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<CollectionRoute, "id">) }))
    .filter((r) => !!r.terminalId && !!r.apiKey && r.status !== "paused")
    .map((r) => ({
      id: r.id,
      name: r.name,
      mosadId: r.terminalId!,
      apiValid: r.apiKey!,
      defaultForNewCards: !!r.defaultForNewCards,
    }));
}
