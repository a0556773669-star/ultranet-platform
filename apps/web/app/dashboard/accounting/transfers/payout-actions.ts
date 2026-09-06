"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { PartnerPayout } from "@ultranet/shared-types";
import { PARTNER_PAYOUTS_COLLECTION, payoutDocId } from "@/lib/partner-payouts";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") throw new Error("גישה זו מוגבלת לבעלים בלבד");
  return session;
}

/**
 * רושם כמה הועבר לשותף עבור חודש מסוים.
 *
 * `paidAmount` של 0 מוחק את הרשומה במקום לכתוב אפס: "לא העברתי" הוא היעדר רשומה, לא
 * רשומה שאומרת אפס - כך ביטול סימון מחזיר את החוב ליתרה בלי שדה נוסף שמסמן ביטול.
 */
export async function recordPartnerPayoutAction(partnerName: string, month: string, formData: FormData) {
  await requireOwner();
  const amount = Number(formData.get("paidAmount"));
  if (!Number.isFinite(amount)) throw new Error("סכום לא תקין");
  const note = String(formData.get("note") ?? "").trim();

  const db = getAdminFirestore();
  const ref = db.collection(PARTNER_PAYOUTS_COLLECTION).doc(payoutDocId(partnerName, month));
  if (amount <= 0) {
    await ref.delete().catch(() => undefined);
  } else {
    const data: Omit<PartnerPayout, "id"> = {
      partnerName,
      month,
      paidAmount: amount,
      paidAt: new Date().toISOString(),
      ...(note ? { note } : {}),
    };
    await ref.set(data, { merge: true });
  }
  revalidatePath("/dashboard/accounting/transfers");
}
