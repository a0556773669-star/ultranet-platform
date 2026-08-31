"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { revalidatePath } from "next/cache";
import {
  BRANCH_KEYS,
  BRANCH_LABELS,
  DEFAULT_PRODUCTS,
  type BranchKey,
  type InventoryItem,
} from "@/lib/legacy-inventory";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("יש להתחבר למערכת");
  }
  return session;
}

export type InventorySnapshot = {
  branches: { key: BranchKey; label: string }[];
  products: string[];
  visibility: Record<string, Record<string, boolean>>;
  inventory: Record<string, Record<string, InventoryItem>>;
};

export async function getInventorySnapshotAction(): Promise<InventorySnapshot> {
  await requireSession();
  const db = getAdminFirestore();

  const [productsSnap, visibilitySnap, ...invSnaps] = await Promise.all([
    db.collection("config").doc("products").get(),
    db.collection("config").doc("visibility").get(),
    ...BRANCH_KEYS.map((b) => db.collection("inventory").doc(b).get()),
  ]);

  const productsData = productsSnap.exists ? (productsSnap.data() as { list?: string[] }) : undefined;
  const products = productsData?.list ?? DEFAULT_PRODUCTS;
  const visibility = (visibilitySnap.exists ? visibilitySnap.data() : {}) as Record<string, Record<string, boolean>>;

  const inventory: Record<string, Record<string, InventoryItem>> = {};
  BRANCH_KEYS.forEach((b, i) => {
    const snap = invSnaps[i]!;
    const data = (snap.exists ? snap.data() : {}) as Record<string, unknown>;
    const clean: Record<string, InventoryItem> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === "zMeta") continue;
      const item = v as Partial<InventoryItem> | undefined;
      clean[k] = { qty: Number(item?.qty) || 0, min: Number(item?.min) || 2 };
    }
    inventory[b] = clean;
  });

  return {
    branches: BRANCH_KEYS.map((key) => ({ key, label: BRANCH_LABELS[key] })),
    products,
    visibility,
    inventory,
  };
}

export type SaveInventoryResult = { ok: true } | { ok: false; message: string };

export async function saveInventoryAction(
  branch: BranchKey,
  items: Record<string, InventoryItem>
): Promise<SaveInventoryResult> {
  await requireSession();
  if (!(BRANCH_KEYS as readonly string[]).includes(branch)) {
    return { ok: false, message: "סניף לא תקין" };
  }
  const db = getAdminFirestore();
  const data: Record<string, unknown> = { ...items, zMeta: { lastUpdate: Timestamp.now() } };
  await db.collection("inventory").doc(branch).set(data);
  revalidatePath("/dashboard/inventory");
  return { ok: true };
}
