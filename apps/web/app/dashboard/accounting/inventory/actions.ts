"use server";

/**
 * משלוח לסניף — moving items between locations.
 *
 * Note what this file does NOT read from the form: a sum. There is no amount here, and there
 * must never be one (כלל 2). It is a design rule rather than an accounting one, which is exactly
 * why it enforces itself: with no field to type a number into, a shipment cannot create money,
 * so it cannot double-count anything. The cost simply travels with the items - out of the
 * warehouse's total and into the branch's.
 */
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { moveItems } from "@/lib/assets-data";
import { ITEMS_COLLECTION, WAREHOUSE_LOCATION } from "@/lib/assets";
import type { ItemMoveReason, ItemStatus } from "@ultranet/shared-types";

function revalidate() {
  revalidatePath("/dashboard/accounting/inventory");
  revalidatePath("/dashboard/accounting/purchases");
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath("/dashboard/accounting/integrity");
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REASONS: ItemMoveReason[] = ["allocation", "return", "transfer", "repair", "writeoff", "initial"];

export async function moveItemsAction(formData: FormData) {
  await requireOwner();

  const itemIds = formData.getAll("itemIds").map(String).filter(Boolean);
  const to = String(formData.get("to") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "").trim();
  const date = DATE_RE.test(dateRaw) ? dateRaw : new Date().toISOString().slice(0, 10);
  const note = String(formData.get("note") ?? "").trim();
  const reasonRaw = String(formData.get("reason") ?? "");
  const reason: ItemMoveReason = REASONS.includes(reasonRaw as ItemMoveReason)
    ? (reasonRaw as ItemMoveReason)
    : to === WAREHOUSE_LOCATION
      ? "return"
      : "allocation";

  if (itemIds.length === 0) throw new Error("נא לסמן לפחות פריט אחד למשלוח");
  if (!to) throw new Error("נא לבחור יעד");

  await moveItems({ itemIds, to, reason, date, ...(note ? { note } : {}) });
  revalidate();
}

const STATUSES: ItemStatus[] = ["active", "repair", "lost", "sold", "writtenoff"];

/**
 * Changing an item's condition. A sold or lost unit stops counting as investment in the branch
 * it sat in - it is genuinely not there any more - while its purchase stays in שכבה 1 forever,
 * because that money really did leave the account.
 */
export async function setItemStatusAction(formData: FormData) {
  await requireOwner();

  const itemIds = formData.getAll("itemIds").map(String).filter(Boolean);
  const statusRaw = String(formData.get("status") ?? "");
  if (!STATUSES.includes(statusRaw as ItemStatus)) throw new Error("מצב פריט לא תקין");
  if (itemIds.length === 0) throw new Error("נא לסמן לפחות פריט אחד");

  const db = getAdminFirestore();
  const batch = db.batch();
  for (const id of itemIds) {
    batch.update(db.collection(ITEMS_COLLECTION).doc(id), { status: statusRaw });
  }
  await batch.commit();
  revalidate();
}
