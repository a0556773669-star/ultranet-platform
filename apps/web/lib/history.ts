/**
 * היסטוריה לא נערכת. מוסיפים לה. (פרק טו׳)
 *
 * Adding computers is a new dated movement, not a correction of the old number. An expense that
 * ended gets an end date, not a deletion. A price that changed opens a new version, it does not
 * overwrite the previous one. A branch that closed gets a closing date and does not disappear.
 *
 * All four are the same answer, and this module holds the two of them that are writes.
 *
 * THE QUALITY CHECK THIS MODULE EXISTS TO PASS:
 *   if any operation in the system can change a number for a month that has already passed,
 *   it is a bug - however convenient it is.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { Branch, ItemMove, Transaction } from "@ultranet/shared-types";
import { ITEMS_COLLECTION, ITEM_MOVES_COLLECTION, SOLD_LOCATION, WAREHOUSE_LOCATION } from "./assets";
import { TX_COLLECTION } from "./tx";

const MONTH_RE = /^\d{4}-\d{2}$/;

/* ------------------------------------------------------------------ *
 * שינוי מחיר = גרסה חדשה, לא עריכה
 * ------------------------------------------------------------------ */

/**
 * Changing the amount of a recurring charge, the only correct way: close the current period and
 * open a new one.
 *
 * Internet at 260 ₪/month since March; in September the supplier raised it to 310 ₪.
 *
 *   Editing `amount` to 310      → March–August are re-read as 310 ₪. Six months × 50 ₪ = 300 ₪
 *                                  rewritten in silence, and the statements already sent to the
 *                                  partner no longer match the system. This is the quietest and
 *                                  most damaging failure the whole model can have.
 *   Closing and versioning       → {from: 2026-03, to: 2026-08, 260} + {from: 2026-09, 310}.
 *                                  The past is frozen, the change applies from September, and
 *                                  the old statements stay correct forever.
 *
 * A recurring line is not an amount - it is a series of validity periods. Every change of amount
 * closes one period and opens another, which also hands you a price history per supplier per
 * branch for free.
 */
export async function reviseRecurringAmount(params: {
  txId: string;
  /** the first month the NEW amount applies to */
  fromMonth: string;
  newAmount: number;
}): Promise<{ ok: boolean; message: string }> {
  if (!MONTH_RE.test(params.fromMonth)) return { ok: false, message: "חודש לא תקין" };
  if (!Number.isFinite(params.newAmount) || params.newAmount <= 0) {
    return { ok: false, message: "נא להזין סכום גדול מאפס" };
  }

  const db = getAdminFirestore();
  const ref = db.collection(TX_COLLECTION).doc(params.txId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "השורה לא נמצאה" };

  const tx = { ...(snap.data() as Omit<Transaction, "id">), id: snap.id } as Transaction;
  if (!tx.recurring?.from) return { ok: false, message: "זו לא שורה חוזרת" };
  if (params.fromMonth <= tx.recurring.from) {
    return {
      ok: false,
      message: `הגרסה החדשה חייבת להתחיל אחרי ${tx.recurring.from}. שינוי שחל על העבר היה כותב מחדש חודשים שכבר נסגרה עליהם התחשבנות.`,
    };
  }

  // The last month the OLD amount still applies to.
  const lastOldMonth = previousMonth(params.fromMonth);
  const ratio = tx.amount > 0 ? params.newAmount / tx.amount : 1;

  const batch = db.batch();
  // 1. Close the current period. The amount itself is never touched.
  batch.set(ref, { recurring: { ...tx.recurring, to: lastOldMonth } }, { merge: true });

  // 2. Open a new period with the new amount, carrying every other field forward unchanged - the
  //    node, the split and the recurrence day are properties of the agreement, not of the price.
  const next: Omit<Transaction, "id"> = {
    ...tx,
    amount: Math.round(params.newAmount),
    ownerShare: Math.round((tx.ownerShare ?? tx.amount) * ratio),
    date: `${params.fromMonth}-01`,
    month: params.fromMonth,
    recurring: { from: params.fromMonth, ...(tx.recurring.dayOfMonth ? { dayOfMonth: tx.recurring.dayOfMonth } : {}) },
    createdAt: Date.now(),
  };
  if (tx.allocations?.length) {
    next.allocations = tx.allocations.map((a) => ({ branchId: a.branchId, amount: Math.round(a.amount * ratio) }));
  }
  delete (next as Partial<Transaction>).id;
  delete (next as Partial<Transaction>).reviewedAt;
  delete (next as Partial<Transaction>).flags;
  batch.set(db.collection(TX_COLLECTION).doc(), next);

  await batch.commit();
  return {
    ok: true,
    message: `הגרסה הקודמת נסגרה ב-${lastOldMonth}, והסכום החדש חל מ-${params.fromMonth}. החודשים שעברו לא השתנו.`,
  };
}

function previousMonth(month: string): string {
  const [y0, m0] = month.split("-").map(Number);
  let y = y0 ?? 2000;
  let m = (m0 ?? 1) - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Ending a recurring charge — by giving it an end date, never by deleting it.
 *
 * Deleting would take every month it has ever produced with it, including months whose settlement
 * with the partner has already been closed and reported.
 */
export async function endRecurring(txId: string, lastMonth: string): Promise<{ ok: boolean; message: string }> {
  if (!MONTH_RE.test(lastMonth)) return { ok: false, message: "חודש לא תקין" };
  const db = getAdminFirestore();
  const ref = db.collection(TX_COLLECTION).doc(txId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "השורה לא נמצאה" };
  const tx = snap.data() as Partial<Transaction>;
  if (!tx.recurring?.from) return { ok: false, message: "זו לא שורה חוזרת" };
  if (lastMonth < tx.recurring.from) return { ok: false, message: "חודש הסיום מוקדם מחודש ההתחלה" };

  await ref.set({ recurring: { ...tx.recurring, to: lastMonth } }, { merge: true });
  return { ok: true, message: `השורה תיפסק אחרי ${lastMonth}. כל החודשים שכבר נוצרו נשארים כפי שהיו.` };
}

/* ------------------------------------------------------------------ *
 * סגירת סניף
 * ------------------------------------------------------------------ */

export interface CloseBranchResult {
  ok: boolean;
  message: string;
  recurringEnded: number;
  itemsReturned: number;
  returnedValue: number;
}

/**
 * Closing a branch — everything in one batch, and nothing deleted.
 *
 * `closedAt` is a BUSINESS date and deliberately not `deletedAt`: a branch that stopped operating
 * on 15 July and was only marked deleted in September must stop accruing from July. Using the
 * technical date would bill it for two months of internet, filtering and advertising it never
 * used, and would demand a transfer from the partner for a branch that was not working.
 *
 * The three things that are easy to forget, and what each one costs:
 *  - not ending the recurring charges → the branch accrues internet forever
 *  - not returning the items          → capital stays embalmed in a dead branch and every
 *                                       payback figure counts equipment nobody can use
 *  - deleting anything                → the history that every past statement was built on
 *
 * The outstanding balance is deliberately NOT cleared: closing a branch is not forgiving a debt.
 * It keeps rolling forward through buildBranchLedger until a transfer is actually recorded.
 */
export async function closeBranch(branchId: string, closedAt: string): Promise<CloseBranchResult> {
  const fail = (message: string): CloseBranchResult => ({
    ok: false,
    message,
    recurringEnded: 0,
    itemsReturned: 0,
    returnedValue: 0,
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closedAt)) return fail("נא להזין תאריך סגירה תקין");

  const db = getAdminFirestore();
  const branchRef = db.collection("n_branches").doc(branchId);
  const [branchSnap, txSnap, itemsSnap, fixedSnap] = await Promise.all([
    branchRef.get(),
    db.collection(TX_COLLECTION).get(),
    db.collection(ITEMS_COLLECTION).where("location", "==", branchId).get(),
    db.collection("n_fixed_expenses").where("branchId", "==", branchId).get(),
  ]);
  if (!branchSnap.exists) return fail("הסניף לא נמצא");
  const branch = branchSnap.data() as Branch;
  if (branch.openedAt && closedAt < branch.openedAt) {
    return fail(`תאריך הסגירה מוקדם מתאריך הפתיחה (${branch.openedAt})`);
  }

  const closedMonth = closedAt.slice(0, 7);
  const now = Date.now();
  const batch = db.batch();

  // 1. The business closing date itself.
  batch.set(branchRef, { closedAt }, { merge: true });

  // 2. End every recurring charge on the branch, so it stops accruing from the closing month.
  let recurringEnded = 0;
  for (const d of txSnap.docs) {
    const tx = d.data() as Partial<Transaction>;
    if (tx.node?.branchId !== branchId) continue;
    if (!tx.recurring?.from || tx.recurring.to) continue;
    if (tx.recurring.from > closedMonth) continue;
    batch.set(d.ref, { recurring: { ...tx.recurring, to: closedMonth } }, { merge: true });
    recurringEnded += 1;
  }
  // The legacy recurring collection needs the same treatment, or the branch keeps billing there.
  for (const d of fixedSnap.docs) {
    const e = d.data() as { endDate?: string; startDate?: string };
    if (e.endDate) continue;
    if (e.startDate && e.startDate > closedAt) continue;
    batch.update(d.ref, { endDate: closedAt });
    recurringEnded += 1;
  }

  // 3. Send every item still at the branch back to the warehouse, with a real dated move - so the
  //    capital comes home instead of staying embalmed, and the history stays replayable.
  let itemsReturned = 0;
  let returnedValue = 0;
  for (const d of itemsSnap.docs) {
    const item = d.data() as { status?: string; unitCost?: number };
    if (item.status === "sold" || item.status === "writeoff" || item.status === "lost") continue;
    batch.update(d.ref, { location: WAREHOUSE_LOCATION });
    const move: Omit<ItemMove, "id"> = {
      itemId: d.id,
      from: branchId,
      to: WAREHOUSE_LOCATION,
      date: closedAt,
      reason: "branch_closed",
      createdAt: now,
    };
    batch.set(db.collection(ITEM_MOVES_COLLECTION).doc(), move);
    itemsReturned += 1;
    returnedValue += item.unitCost ?? 0;
  }

  await batch.commit();

  return {
    ok: true,
    message:
      `${branch.name} נסגר ב-${closedAt}. ${recurringEnded} הוצאות חוזרות נעצרו, ` +
      `${itemsReturned} פריטים חזרו למחסן. היתרה הפתוחה נשארה פתוחה — סגירת סניף היא לא מחיקת חוב, ` +
      "ושום נתון היסטורי לא נמחק.",
    recurringEnded,
    itemsReturned,
    returnedValue,
  };
}

/**
 * Reopening a branch: clear the closing date, and ship items to it again like any other branch.
 * Nothing from the past has to change, because nothing from the past was deleted - which is the
 * whole beauty of the rule.
 */
export async function reopenBranch(branchId: string): Promise<{ ok: boolean; message: string }> {
  const db = getAdminFirestore();
  const ref = db.collection("n_branches").doc(branchId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, message: "הסניף לא נמצא" };
  await ref.set({ closedAt: null }, { merge: true });
  return {
    ok: true,
    message:
      "הסניף נפתח מחדש. ההוצאות החוזרות שנעצרו לא חוזרות לבד — יש להזין אותן כגרסה חדשה מהחודש הנוכחי, " +
      "והציוד נשלח אליו מחדש ממסך המלאי.",
  };
}

export { SOLD_LOCATION };
