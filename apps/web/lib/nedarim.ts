import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CollectionRoute } from "@ultranet/shared-types";

export type NedarimCreds = { mosadId: string; apiValid: string; routeId: string };

/**
 * Resolves which Nedarim Plus route to use for a given branch:
 * 1. A route explicitly assigned to the branch (branch.collectionRouteId), if it's a Nedarim route.
 * 2. Otherwise, a global Nedarim Plus route (branchScope === null) - acts as the owner's default
 *    fallback token so branches without their own merchant setup are still covered.
 */
export async function resolveNedarimCreds(branchId?: string | null): Promise<NedarimCreds | null> {
  const db = getAdminFirestore();

  if (branchId) {
    const branchDoc = await db.collection("n_branches").doc(branchId).get();
    const collectionRouteId = (branchDoc.data() as { collectionRouteId?: string | null } | undefined)
      ?.collectionRouteId;
    if (collectionRouteId) {
      const routeDoc = await db.collection("n_collection_routes").doc(collectionRouteId).get();
      if (routeDoc.exists) {
        const route = routeDoc.data() as Omit<CollectionRoute, "id">;
        if (route.provider === "nedarim_plus" && route.terminalId && route.apiKey) {
          return { mosadId: route.terminalId, apiValid: route.apiKey, routeId: routeDoc.id };
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
      return { mosadId: route.terminalId, apiValid: route.apiKey, routeId: doc.id };
    }
  }

  return null;
}
