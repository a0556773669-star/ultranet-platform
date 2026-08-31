"use server";

/**
 * יציאת ציוד — מכירה, גריטה ואבדן (פרק יג׳).
 *
 * The mirror image of a purchase, and deliberately the same shape: a purchase converts money
 * into assets, an exit converts assets back into money. One screen, one atomic write, and the
 * same axiom restated:
 *
 *   תמורה ממכירת ציוד היא לא הכנסה. היא החזר הון.
 *
 * So the transaction it creates is `nature: "capital"`, `direction: "in"` - it never enters
 * turnover, never splits with a partner, and never touches any branch's profitability, for
 * exactly the reason the purchase was not an expense (כלל 7).
 *
 * A write-off or a loss is the same act with proceeds of 0 and no incoming transaction. Note what
 * is NOT offered anywhere: deleting the item. Deleting would break כלל 4's balance and, worse,
 * erase the knowledge that money was lost there. An item never disappears - it changes status.
 */
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Item, ItemMove, ItemStatus, TxBusiness } from "@ultranet/shared-types";
import {
  ITEMS_COLLECTION,
  ITEM_MOVES_COLLECTION,
  SOLD_LOCATION,
  WAREHOUSE_LOCATION,
  splitSaleProceeds,
} from "@/lib/assets";
import { TX_COLLECTION, buildTransaction } from "@/lib/tx";

export interface SaveResult {
  ok: boolean;
  message: string;
}

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EXIT_STATUSES: ItemStatus[] = ["sold", "writeoff", "lost"];

function revalidate() {
  revalidatePath("/dashboard/accounting/sales");
  revalidatePath("/dashboard/accounting/inventory");
  revalidatePath("/dashboard/accounting/purchases");
  revalidatePath("/dashboard/accounting/bottom-line");
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath("/dashboard/accounting/integrity");
}

export async function recordExitAction(formData: FormData): Promise<SaveResult> {
  try {
    await requireOwner();

    const itemIds = [...new Set(formData.getAll("itemIds").map(String).filter(Boolean))];
    const statusRaw = String(formData.get("status") ?? "sold");
    const status: ItemStatus = EXIT_STATUSES.includes(statusRaw as ItemStatus)
      ? (statusRaw as ItemStatus)
      : "sold";
    const dateRaw = String(formData.get("date") ?? "").trim();
    const date = DATE_RE.test(dateRaw) ? dateRaw : new Date().toISOString().slice(0, 10);
    const buyer = String(formData.get("buyer") ?? "").trim();
    const invoiceNo = String(formData.get("invoiceNo") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    // A write-off or a loss realises nothing, whatever was typed - the field is hidden for them.
    const proceeds = status === "sold" ? Math.round(Number(formData.get("proceeds") ?? 0)) : 0;

    if (itemIds.length === 0) return { ok: false, message: "נא לסמן לפחות פריט אחד" };
    if (status === "sold" && (!Number.isFinite(proceeds) || proceeds <= 0)) {
      return { ok: false, message: "נא להזין את התמורה שהתקבלה. מכירה ללא תמורה היא גריטה — יש לבחור אותה במפורש" };
    }
    if (status === "sold" && !buyer) return { ok: false, message: "נא להזין למי נמכר" };

    const db = getAdminFirestore();
    const refs = itemIds.map((id) => db.collection(ITEMS_COLLECTION).doc(id));
    const snaps = await db.getAll(...refs);

    const items: Item[] = [];
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const item = { ...(snap.data() as Omit<Item, "id">), id: snap.id } as Item;
      // Re-submitting the form must not re-sell a unit that already left, which would create a
      // second incoming transaction for money received once.
      if (EXIT_STATUSES.includes(item.status)) continue;
      items.push(item);
    }
    if (items.length === 0) return { ok: false, message: "כל הפריטים שסומנו כבר יצאו מהעסק" };
    // Two writes per unit plus the transaction, and a Firestore batch holds 500. The whole exit
    // has to be atomic - a half-recorded sale would leave items out and break כלל 4's balance -
    // so an oversized selection is refused rather than split behind the owner's back.
    if (items.length > 240) {
      return { ok: false, message: `אפשר לרשום עד 240 פריטים ביציאה אחת (נבחרו ${items.length}). נא לפצל לשתי פעולות.` };
    }

    const shares = splitSaleProceeds(items, proceeds);
    const now = Date.now();
    const batch = db.batch();

    // One incoming capital transaction for the whole sale, hung on the business unit the units
    // came from when they all came from the same branch - so the money is traceable to a place.
    let txId: string | undefined;
    if (status === "sold" && proceeds > 0) {
      const branches = [...new Set(items.map((i) => i.location))].filter((l) => l !== WAREHOUSE_LOCATION);
      const soleBranchId = branches.length === 1 ? branches[0]! : null;
      // The business unit follows the branch the equipment actually sat in - hardcoding "rentals"
      // would file a computer room's sale under laptop rentals.
      let business: TxBusiness = "rentals";
      if (soleBranchId) {
        const branchSnap = await db.collection("n_branches").doc(soleBranchId).get();
        const type = (branchSnap.data() as { branchType?: string } | undefined)?.branchType;
        if (type === "rentals" || type === "computers" || type === "coworking") business = type;
      }
      const txRef = db.collection(TX_COLLECTION).doc();
      txId = txRef.id;
      batch.set(
        txRef,
        buildTransaction({
          date,
          direction: "in",
          amount: proceeds,
          // Capital, not income: this is the owner's own money coming back, so it stops at the
          // asset layer and never reaches any branch's operating book.
          nature: "capital",
          business,
          branchId: soleBranchId ?? "shared",
          desc: `מכירת ציוד${buyer ? ` ל${buyer}` : ""}`,
          category: "מכירת ציוד",
          paidBy: "owner",
          ownerShare: proceeds,
          ...(invoiceNo ? { doc: invoiceNo } : {}),
          ...(note ? { note } : {}),
        }),
      );
    }

    for (const item of items) {
      const from = item.location || WAREHOUSE_LOCATION;
      const patch: Partial<Item> = {
        status,
        location: SOLD_LOCATION,
        soldAt: date,
        soldPrice: shares.get(item.id) ?? 0,
        // MANDATORY. Once location is the terminal sentinel, this is the only record of which
        // branch the unit left - and without it that branch's capital return is wrong forever.
        lastBranchId: from,
        ...(txId ? { saleTxId: txId } : {}),
      };
      batch.update(db.collection(ITEMS_COLLECTION).doc(item.id), patch);

      // Location and its move are always written together: the moment the two can drift apart,
      // every historical figure in the system becomes a guess (פרק טו׳).
      const move: Omit<ItemMove, "id"> = {
        itemId: item.id,
        from,
        to: SOLD_LOCATION,
        date,
        reason: status === "sold" ? "sale" : "writeoff",
        createdAt: now,
        ...(note ? { note } : {}),
      };
      batch.set(db.collection(ITEM_MOVES_COLLECTION).doc(), move);
    }

    await batch.commit();
    revalidate();

    const cost = items.reduce((sum, i) => sum + (i.unitCost || 0), 0);
    const gain = proceeds - cost;
    return {
      ok: true,
      message:
        status === "sold"
          ? `${items.length} פריטים נמכרו ב-${money(proceeds)} · עלותם הייתה ${money(cost)} · ${
              gain >= 0 ? "רווח" : "הפסד"
            } הוני ${money(Math.abs(gain))}`
          : `${items.length} פריטים סומנו כ${status === "lost" ? "אבודים" : "נגרטים"} · הפסד הוני ${money(cost)}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `הפעולה נכשלה: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`,
    };
  }
}
