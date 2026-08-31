"use server";

/**
 * ההוצאות שמנהל הסניף מזין בעצמו (פרק יד׳).
 *
 * Look at what this action reads from the form and what it does NOT: it reads description,
 * amount, date, category and a receipt - facts. It never reads `paidBy`, `ownerShare` or a
 * branch picker, because those are terms of the agreement and a derived consequence of it. The
 * manager cannot get them wrong, because he is never asked.
 *
 * The row counts in the settlement from the moment it is saved. The owner's review list
 * (/dashboard/accounting/review) is a list, never a gate - see lib/expense-review.ts.
 */
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, BranchTransfer, TxBusiness } from "@ultranet/shared-types";
import { TX_COLLECTION, buildTransaction } from "@/lib/tx";
import { loadTransactionModel } from "@/lib/tx-data";
import { BRANCH_EXPENSE_CATEGORIES, paidByForCategory } from "@/lib/expense-policy";
import { flagsForEntry } from "@/lib/expense-review";

export interface SaveResult {
  ok: boolean;
  message: string;
}

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/**
 * A branch manager may only ever write to his OWN branch. The branch is taken from the session,
 * never from the form - a branch id in a payload is a branch id an attacker can change.
 */
async function requireBranchManager(): Promise<{ userId: string; name: string; branchId: string } | string> {
  const session = await getServerSession(authOptions);
  if (!session) return "נדרשת התחברות מחדש";
  const branchId = session.user?.branchId;
  if (!branchId || branchId === "all") return "המסך הזה מיועד למנהל סניף";
  return {
    userId: (session.user as { id?: string } | undefined)?.id ?? session.user?.email ?? "",
    name: session.user?.name ?? session.user?.email ?? "מנהל הסניף",
    branchId,
  };
}

function businessOf(branch: Branch): TxBusiness {
  return branch.branchType === "rentals" || branch.branchType === "computers" || branch.branchType === "coworking"
    ? branch.branchType
    : "hq";
}

export async function addBranchExpenseAction(formData: FormData): Promise<SaveResult> {
  try {
    const who = await requireBranchManager();
    if (typeof who === "string") return { ok: false, message: who };

    const desc = String(formData.get("desc") ?? "").trim();
    const amount = Math.round(Number(String(formData.get("amount") ?? "").replace(/[₪,\s]/g, "")));
    const dateRaw = String(formData.get("date") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const receipt = String(formData.get("receipt") ?? "").trim();
    const note = String(formData.get("note") ?? "").trim();
    const recurringFrom = String(formData.get("recurringFrom") ?? "").trim();

    if (!DATE_RE.test(dateRaw)) return { ok: false, message: "נא לבחור תאריך" };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "נא להזין סכום גדול מאפס" };
    if (!BRANCH_EXPENSE_CATEGORIES.some((c) => c.label === category)) {
      return { ok: false, message: "נא לבחור קטגוריה מהרשימה" };
    }
    if (recurringFrom && !MONTH_RE.test(recurringFrom)) return { ok: false, message: "חודש התחלה לא תקין" };

    const db = getAdminFirestore();
    const branchSnap = await db.collection("n_branches").doc(who.branchId).get();
    if (!branchSnap.exists) return { ok: false, message: "הסניף לא נמצא" };
    const branch = { ...(branchSnap.data() as Omit<Branch, "id">), id: branchSnap.id } as Branch;
    if (branch.closedAt) {
      return { ok: false, message: "הסניף סגור. פנה לבעלים כדי לרשום הוצאה לתקופה שלפני הסגירה." };
    }

    const month = dateRaw.slice(0, 7);
    // Derived, not typed: who fronted the cash follows from the branch's agreement, and the
    // owner's economic share follows from the partnership percentages.
    const paidBy = paidByForCategory(branch, category);
    const ownerPct = branch.isMine ? 100 : branch.myPct ?? 100 - (branch.partnerPct ?? 0);
    const ownerShare = (amount * (Number.isFinite(ownerPct) ? ownerPct : 100)) / 100;

    // Flags are computed once, at entry, against the branch's own baseline - so the reason a row
    // was surfaced cannot silently change later when that baseline moves.
    const [model, transfersSnap] = await Promise.all([
      loadTransactionModel(),
      db.collection("n_branch_transfers").where("branchId", "==", who.branchId).get(),
    ]);
    const settledMonths = new Set(
      transfersSnap.docs
        .map((d) => d.data() as BranchTransfer)
        .filter((t) => t.transferred || !!t.transferredAmount)
        .map((t) => `${who.branchId}|${t.month}`),
    );
    const flags = flagsForEntry(
      { branchId: who.branchId, month, amount, category, hasReceipt: !!receipt },
      { history: model.transactions, settledMonths },
    );

    const tx = buildTransaction({
      date: dateRaw,
      direction: "out",
      amount,
      nature: "operating",
      business: businessOf(branch),
      branchId: who.branchId,
      desc: desc || category,
      category,
      paidBy,
      ownerShare,
      ...(receipt ? { doc: receipt } : {}),
      ...(note ? { note } : {}),
      // Entered once, on the day the line was installed - and it appears by itself every month
      // from then on. Nobody types anything monthly; that is the entire point.
      ...(recurringFrom ? { recurring: { from: recurringFrom } } : {}),
    });

    await db
      .collection(TX_COLLECTION)
      .add({ ...tx, enteredBy: who, ...(flags.length > 0 ? { flags } : {}) });

    revalidatePath("/dashboard/rentals/my-expenses");
    revalidatePath("/dashboard/accounting/review");
    revalidatePath("/dashboard/accounting/overview");
    revalidatePath(`/dashboard/accounting/overview/${who.branchId}`);

    return {
      ok: true,
      message: recurringFrom
        ? `נרשמה הוצאה חוזרת — ${money(amount)} כל חודש מ-${recurringFrom}. לא צריך להזין אותה שוב.`
        : `נרשמה הוצאה — ${money(amount)}. היא כבר נכנסה להתחשבנות של ${month}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `השמירה נכשלה: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`,
    };
  }
}

/**
 * Stopping a recurring expense the manager entered — by giving it an END DATE, never by deleting
 * it (פרק טו׳). Deleting would erase the months already settled with the owner along with it.
 */
export async function endRecurringExpenseAction(id: string, lastMonth: string): Promise<SaveResult> {
  try {
    const who = await requireBranchManager();
    if (typeof who === "string") return { ok: false, message: who };
    if (!MONTH_RE.test(lastMonth)) return { ok: false, message: "חודש סיום לא תקין" };

    const db = getAdminFirestore();
    const ref = db.collection(TX_COLLECTION).doc(id);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, message: "השורה לא נמצאה" };
    const tx = snap.data() as { node?: { branchId?: string }; recurring?: { from: string } };
    if (tx.node?.branchId !== who.branchId) return { ok: false, message: "השורה לא שייכת לסניף שלך" };
    if (!tx.recurring?.from) return { ok: false, message: "זו לא הוצאה חוזרת" };
    if (lastMonth < tx.recurring.from) return { ok: false, message: "חודש הסיום מוקדם מחודש ההתחלה" };

    await ref.set({ recurring: { ...tx.recurring, to: lastMonth } }, { merge: true });

    revalidatePath("/dashboard/rentals/my-expenses");
    revalidatePath("/dashboard/accounting/overview");
    return { ok: true, message: `ההוצאה תיפסק אחרי ${lastMonth}. כל החודשים שכבר נוצרו נשארים כפי שהיו.` };
  } catch (err) {
    return {
      ok: false,
      message: `הפעולה נכשלה: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`,
    };
  }
}
