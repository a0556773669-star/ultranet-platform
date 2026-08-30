/**
 * Loading שכבה 2 (נכסים) from Firestore, and the writes that keep it consistent.
 *
 * Split out of lib/assets.ts so that module can stay pure - the purchase form and the shipment
 * screen are client components and import its helpers directly, and pulling firebase-admin into
 * them breaks `next build` with "Can't resolve 'http2'". Same split as cost-rates.ts /
 * cost-rates-data.ts and branch-accounting.ts / branch-accounting-data.ts.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { Item, ItemLocation, ItemMove, ItemMoveReason, Purchase } from "@ultranet/shared-types";
import {
  ITEMS_COLLECTION,
  ITEM_MOVES_COLLECTION,
  PURCHASES_COLLECTION,
  WAREHOUSE_LOCATION,
  investmentByLocation,
  type LocationInvestment,
} from "./assets";

const doc = <T>(d: QueryDocumentSnapshot) => ({ ...(d.data() as Omit<T, "id">), id: d.id }) as T;

export interface AssetsData {
  purchases: Purchase[];
  purchaseById: Map<string, Purchase>;
  items: Item[];
  itemsByLocation: Map<ItemLocation, Item[]>;
  itemsByPurchase: Map<string, Item[]>;
  /** location -> what is held there and what it cost */
  investmentByLocation: Map<ItemLocation, LocationInvestment>;
  /** Σ of every invoice ever entered */
  totalPurchased: number;
}

export async function loadAssets(): Promise<AssetsData> {
  const db = getAdminFirestore();
  const [purchasesSnap, itemsSnap] = await Promise.all([
    db.collection(PURCHASES_COLLECTION).get(),
    db.collection(ITEMS_COLLECTION).get(),
  ]);

  const purchases = purchasesSnap.docs
    .map((d) => doc<Purchase>(d))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const items = itemsSnap.docs.map((d) => doc<Item>(d));

  const itemsByLocation = new Map<ItemLocation, Item[]>();
  const itemsByPurchase = new Map<string, Item[]>();
  for (const item of items) {
    const location = item.location || WAREHOUSE_LOCATION;
    const byLoc = itemsByLocation.get(location) ?? [];
    byLoc.push(item);
    itemsByLocation.set(location, byLoc);
    if (item.purchaseId) {
      const byPur = itemsByPurchase.get(item.purchaseId) ?? [];
      byPur.push(item);
      itemsByPurchase.set(item.purchaseId, byPur);
    }
  }

  return {
    purchases,
    purchaseById: new Map(purchases.map((p) => [p.id, p])),
    items,
    itemsByLocation,
    itemsByPurchase,
    investmentByLocation: investmentByLocation(items),
    totalPurchased: purchases.reduce((sum, p) => sum + (p.total || 0), 0),
  };
}

/** The moves of one item, oldest first - its whole travel history. */
export async function loadItemMoves(itemId: string): Promise<ItemMove[]> {
  const snap = await getAdminFirestore().collection(ITEM_MOVES_COLLECTION).where("itemId", "==", itemId).get();
  return snap.docs.map((d) => doc<ItemMove>(d)).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

/** The most recent moves across all items, for the shipment screen's activity log. */
export async function loadRecentItemMoves(limit = 60): Promise<ItemMove[]> {
  const snap = await getAdminFirestore().collection(ITEM_MOVES_COLLECTION).get();
  return snap.docs
    .map((d) => doc<ItemMove>(d))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, limit);
}

/**
 * Moves items to a new location and records why.
 *
 * The signature is the design rule made physical: there is NO amount parameter, and there never
 * will be (כלל 2). A shipment cannot record money, so it cannot double-count anything - the cost
 * simply travels with the items, from the warehouse's total into the branch's.
 */
export async function moveItems(params: {
  itemIds: string[];
  to: ItemLocation;
  reason: ItemMoveReason;
  date: string;
  note?: string;
}): Promise<number> {
  const db = getAdminFirestore();
  const ids = [...new Set(params.itemIds.filter(Boolean))];
  if (ids.length === 0) return 0;

  const refs = ids.map((id) => db.collection(ITEMS_COLLECTION).doc(id));
  const snaps = await db.getAll(...refs);

  const now = Date.now();
  // Each move is two writes (the item's new location + its history row), and a Firestore batch
  // holds 500. "Select all" on a full warehouse would silently exceed that, so the writes are
  // chunked; a partial failure leaves earlier chunks committed, which is the right trade here -
  // an item that moved and was recorded as moving is consistent on its own.
  const MOVES_PER_BATCH = 200;
  let batch = db.batch();
  let inBatch = 0;
  let moved = 0;

  for (const snap of snaps) {
    if (!snap.exists) continue;
    const item = { ...(snap.data() as Omit<Item, "id">), id: snap.id } as Item;
    const from = item.location || WAREHOUSE_LOCATION;
    // A no-op move would add a history row that says nothing happened; skip it silently so
    // re-submitting a shipment form is harmless.
    if (from === params.to) continue;

    batch.update(snap.ref, { location: params.to });
    const move: Omit<ItemMove, "id"> = {
      itemId: snap.id,
      from,
      to: params.to,
      date: params.date,
      reason: params.reason,
      createdAt: now,
      ...(params.note ? { note: params.note } : {}),
    };
    batch.set(db.collection(ITEM_MOVES_COLLECTION).doc(), move);
    moved += 1;
    inBatch += 1;

    if (inBatch >= MOVES_PER_BATCH) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }

  if (inBatch > 0) await batch.commit();
  return moved;
}
