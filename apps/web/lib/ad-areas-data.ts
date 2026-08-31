/** Firestore access for the advertising areas. The math itself is in lib/ad-areas.ts. */
import { getAdminFirestore } from "./firebase-admin";
import { AD_AREAS_COLLECTION } from "./ad-areas";
import type { AdArea } from "@ultranet/shared-types";

export async function loadAdAreas(): Promise<AdArea[]> {
  const snap = await getAdminFirestore().collection(AD_AREAS_COLLECTION).get();
  return snap.docs
    .map((d) => {
      const a = { ...(d.data() as Omit<AdArea, "id">), id: d.id } as AdArea;
      return { ...a, branchIds: a.branchIds ?? [] };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}
