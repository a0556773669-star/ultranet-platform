"use server";

/**
 * רכישה — the one screen where equipment enters the business (שכבה 2).
 *
 * A purchase writes exactly three things, in one batch:
 *   1. one capital transaction (n_tx)  — the money that left the account, in full, once
 *   2. one invoice (n_purchases)       — the supplier document behind it
 *   3. one item per unit (n_items)     — each carrying its OWN real unit cost
 *
 * It writes no expense, in any branch, ever (כלל 7). Shipping those items to a branch later
 * records no money either (כלל 2) - which is precisely why the same 15,000 ₪ can be a cash
 * outflow, an investment in a branch, and zero cost to that branch's profit, all at once.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { ItemKind, Purchase, PurchaseLine } from "@ultranet/shared-types";
import {
  ITEMS_COLLECTION,
  ITEM_MOVES_COLLECTION,
  ITEM_KINDS,
  PURCHASES_COLLECTION,
  WAREHOUSE_LOCATION,
  itemsFromPurchaseLines,
  validatePurchase,
} from "@/lib/assets";
import { TX_COLLECTION, buildTransaction } from "@/lib/tx";
import type { TxBusiness } from "@ultranet/shared-types";

function revalidate() {
  revalidatePath("/dashboard/accounting/purchases");
  revalidatePath("/dashboard/accounting/inventory");
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath("/dashboard/accounting/integrity");
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readLines(formData: FormData): PurchaseLine[] {
  const kinds = formData.getAll("lineKind").map(String);
  const labels = formData.getAll("lineLabel").map(String);
  const qtys = formData.getAll("lineQty").map(String);
  const costs = formData.getAll("lineUnitCost").map(String);

  const lines: PurchaseLine[] = [];
  for (let i = 0; i < kinds.length; i++) {
    const qty = Math.round(Number(qtys[i] ?? 0));
    const unitCost = Math.round(Number(costs[i] ?? 0));
    // A blank row is how the form lets the owner add a line and change their mind; it is not an
    // error, it just isn't a line.
    if (!qty && !unitCost) continue;
    const kind = (ITEM_KINDS as string[]).includes(kinds[i] ?? "") ? (kinds[i] as ItemKind) : "other";
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("כמות בשורה חייבת להיות מספר חיובי");
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("עלות ליחידה חייבת להיות מספר חיובי");
    const line: PurchaseLine = { kind, qty, unitCost };
    const label = (labels[i] ?? "").trim();
    if (label) line.label = label;
    lines.push(line);
  }
  return lines;
}

export async function createPurchaseAction(formData: FormData) {
  await requireOwner();

  const date = String(formData.get("date") ?? "").trim();
  const supplier = String(formData.get("supplier") ?? "").trim();
  const invoiceNo = String(formData.get("invoiceNo") ?? "").trim();
  const total = Math.round(Number(formData.get("total") ?? 0));
  const note = String(formData.get("note") ?? "").trim();
  const docLink = String(formData.get("doc") ?? "").trim();
  const businessRaw = String(formData.get("business") ?? "rentals");
  const business: TxBusiness = (["rentals", "computers", "coworking", "hq"] as const).includes(
    businessRaw as TxBusiness,
  )
    ? (businessRaw as TxBusiness)
    : "rentals";
  // Where the units land. Default is the warehouse: they exist and cost money before anyone
  // decides which branch gets them, and that is a legitimate resting place (כלל 4).
  const location = String(formData.get("location") ?? WAREHOUSE_LOCATION).trim() || WAREHOUSE_LOCATION;

  if (!DATE_RE.test(date)) throw new Error("נא להזין תאריך חשבונית תקין");
  if (!supplier) throw new Error("נא להזין את שם הספק");

  const lines = readLines(formData);
  const check = validatePurchase(total, lines);
  if (!check.ok) throw new Error(check.error ?? "החשבונית לא תקינה");

  const db = getAdminFirestore();
  const purchaseRef = db.collection(PURCHASES_COLLECTION).doc();
  const txRef = db.collection(TX_COLLECTION).doc();
  const now = Date.now();

  const purchase: Omit<Purchase, "id"> = {
    date,
    month: date.slice(0, 7),
    supplier,
    total,
    txId: txRef.id,
    lines,
    createdAt: now,
    ...(invoiceNo ? { invoiceNo } : {}),
    ...(docLink ? { doc: docLink } : {}),
    ...(note ? { note } : {}),
  };

  const tx = buildTransaction({
    date,
    direction: "out",
    amount: total,
    nature: "capital",
    business,
    // The purchase hangs on the business unit as a whole, not on a branch: at the moment the
    // money leaves, nobody has decided where the units go. Where they end up is the items' job.
    branchId: location === WAREHOUSE_LOCATION ? "shared" : location,
    desc: `רכישה מ${supplier}${invoiceNo ? ` · חשבונית ${invoiceNo}` : ""}`,
    category: "רכישת ציוד",
    paidBy: "owner",
    // Capital is always fully the owner's - the partner never carries equipment (כלל 7).
    ownerShare: total,
    purchaseId: purchaseRef.id,
    ...(docLink ? { doc: docLink } : {}),
    ...(note ? { note } : {}),
  });

  const items = itemsFromPurchaseLines(lines, {
    purchaseId: purchaseRef.id,
    acquiredAt: date,
    location,
  });

  const batch = db.batch();
  batch.set(purchaseRef, purchase);
  batch.set(txRef, tx);
  for (const item of items) {
    const itemRef = db.collection(ITEMS_COLLECTION).doc();
    batch.set(itemRef, item);
    batch.set(db.collection(ITEM_MOVES_COLLECTION).doc(), {
      itemId: itemRef.id,
      from: "",
      to: item.location,
      date,
      reason: "initial",
      createdAt: now,
    });
  }
  await batch.commit();

  revalidate();
  redirect(`/dashboard/accounting/purchases/${purchaseRef.id}`);
}

/**
 * Deleting a purchase takes its transaction and its items with it - all three were created by
 * one act and describe one event, so leaving any of them behind breaks the balance the whole
 * asset layer rests on. Items that have already been shipped block the delete: at that point the
 * purchase is history a branch depends on, and the honest fix is a write-off, not an erasure.
 */
export async function deletePurchaseAction(id: string) {
  await requireOwner();
  const db = getAdminFirestore();

  const [purchaseSnap, itemsSnap] = await Promise.all([
    db.collection(PURCHASES_COLLECTION).doc(id).get(),
    db.collection(ITEMS_COLLECTION).where("purchaseId", "==", id).get(),
  ]);
  if (!purchaseSnap.exists) throw new Error("הרכישה לא נמצאה");
  const purchase = purchaseSnap.data() as Omit<Purchase, "id">;

  const shipped = itemsSnap.docs.filter(
    (d) => (d.data() as { location?: string }).location !== WAREHOUSE_LOCATION,
  );
  if (shipped.length > 0) {
    throw new Error(
      `אי אפשר למחוק: ${shipped.length} פריטים מהחשבונית כבר נשלחו לסניפים. יש להחזיר אותם למחסן קודם.`,
    );
  }

  const batch = db.batch();
  batch.delete(purchaseSnap.ref);
  if (purchase.txId) batch.delete(db.collection(TX_COLLECTION).doc(purchase.txId));
  for (const d of itemsSnap.docs) batch.delete(d.ref);
  await batch.commit();

  revalidate();
  redirect("/dashboard/accounting/purchases");
}

/**
 * ממירה את "עלות הקמה" של חדר מחשבים לרכישה אמיתית.
 *
 * `Branch.setupCost` is a single number with no date, no invoice and no breakdown - the exact
 * shape of estimate the asset layer exists to replace. Converting it writes a real purchase and
 * a real capital transaction for the same amount, with one item standing for the room's fit-out,
 * located in that branch. The number does not change; it just stops being a mystery field and
 * starts being a document the balance can verify.
 *
 * The branch's own `setupCost` field is deliberately left alone: it is the historical value, and
 * the projection in lib/tx-data.ts stops reading it for a branch that has been converted (it
 * matches on the purchase's `setupCost:<branchId>` marker), so the amount is never counted twice.
 */
export async function convertSetupCostAction(branchId: string) {
  await requireOwner();
  const db = getAdminFirestore();

  const branchSnap = await db.collection("n_branches").doc(branchId).get();
  if (!branchSnap.exists) throw new Error("הסניף לא נמצא");
  const branch = branchSnap.data() as { name?: string; setupCost?: number; openedAt?: string; founded?: string };
  const total = Math.round(branch.setupCost ?? 0);
  if (total <= 0) throw new Error("לסניף הזה אין עלות הקמה להמרה");

  const marker = `setupCost:${branchId}`;
  const existing = await db.collection(PURCHASES_COLLECTION).where("note", "==", marker).limit(1).get();
  if (!existing.empty) throw new Error("עלות ההקמה של הסניף הזה כבר הומרה לרכישה");

  const date = (branch.openedAt || branch.founded || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const purchaseRef = db.collection(PURCHASES_COLLECTION).doc();
  const txRef = db.collection(TX_COLLECTION).doc();
  const now = Date.now();
  const label = `הקמת ${branch.name ?? "חדר מחשבים"}`;

  const lines: PurchaseLine[] = [{ kind: "other", label, qty: 1, unitCost: total }];

  const batch = db.batch();
  batch.set(purchaseRef, {
    date,
    month: date.slice(0, 7),
    supplier: label,
    total,
    txId: txRef.id,
    lines,
    createdAt: now,
    note: marker,
  } satisfies Omit<Purchase, "id">);
  batch.set(
    txRef,
    buildTransaction({
      date,
      direction: "out",
      amount: total,
      nature: "capital",
      business: "computers",
      branchId,
      desc: label,
      category: "רכישת ציוד",
      paidBy: "owner",
      ownerShare: total,
      purchaseId: purchaseRef.id,
      note: marker,
    }),
  );
  const itemRef = db.collection(ITEMS_COLLECTION).doc();
  batch.set(itemRef, {
    kind: "other",
    label,
    purchaseId: purchaseRef.id,
    unitCost: total,
    acquiredAt: date,
    location: branchId,
    status: "active",
    note: "נוצר מהמרת שדה עלות ההקמה של הסניף",
  });
  batch.set(db.collection(ITEM_MOVES_COLLECTION).doc(), {
    itemId: itemRef.id,
    from: "",
    to: branchId,
    date,
    reason: "initial",
    createdAt: now,
  });
  await batch.commit();

  revalidate();
  revalidatePath("/dashboard/computer-rooms-accounting");
}
