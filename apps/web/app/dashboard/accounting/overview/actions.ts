"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { TX_COLLECTION, buildTransaction } from "@/lib/tx";
import type { TxBusiness } from "@ultranet/shared-types";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
  return session;
}

function revalidate() {
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/accounting/entries");
  revalidatePath("/dashboard/accounting/bottom-line");
}

/**
 * The business unit a quick-entry category belongs to. It only picks the NODE now - not a
 * collection - because there is one collection. A category that names no unit lands on `hq`,
 * which is the honest answer for an overhead and a visible one for anything mis-filed: the
 * integrity screen lists hq rows that have been sitting unattributed for over a month.
 */
function businessFor(category: string): TxBusiness {
  if (category === "ניידים") return "rentals";
  if (category === "חדרי מחשבים" || category === "מזומן") return "computers";
  if (category === "משרד שיתופי") return "coworking";
  return "hq";
}

function readEntry(formData: FormData) {
  const date = String(formData.get("date") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const category = String(formData.get("category") ?? "").trim();
  const desc = String(formData.get("desc") ?? "").trim();
  if (!date || !amount || amount <= 0) {
    throw new Error("תאריך וסכום הם שדות חובה");
  }
  if (!category) {
    throw new Error("נא לבחור קטגוריה");
  }
  return { date, amount, category, desc, month: date.slice(0, 7) };
}

/**
 * The quick-add rows on the overview card write to n_tx like every other new movement - there is
 * exactly one place a shekel can enter the books (כלל 1), and a second write path here would be
 * a second place, however small the form.
 */
async function addQuickEntry(formData: FormData, direction: "in" | "out") {
  await requireOwner();
  const { date, amount, category, desc } = readEntry(formData);
  const business = businessFor(category);
  const tx = buildTransaction({
    date,
    direction,
    amount,
    // A hand-typed row on the owner's own card is running income or cost. Equipment goes through
    // the purchase screen, which creates the items along with it.
    nature: "operating",
    business,
    branchId: business === "hq" ? "hq" : "shared",
    desc: desc || category,
    category,
    paidBy: "owner",
    // Nothing here is attributed to a partner branch, so it is all the owner's.
    ownerShare: amount,
  });
  await getAdminFirestore().collection(TX_COLLECTION).add(tx);
  revalidate();
}

export async function addMyIncomeAction(formData: FormData) {
  await addQuickEntry(formData, "in");
}

export async function addMyExpenseAction(formData: FormData) {
  await addQuickEntry(formData, "out");
}
