import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { AccountingIncome, CollectionRoute } from "@ultranet/shared-types";

export type ChargeResult =
  | { ok: true; incomeId: string; grossAmount: number; feeAmount: number; netAmount: number }
  | { ok: false; message: string };

export async function chargeViaRoute(params: {
  routeId: string;
  amount: number;
  desc: string;
  business: AccountingIncome["business"];
  date?: string;
}): Promise<ChargeResult> {
  if (!params.routeId) return { ok: false, message: "לא נבחר מסלול גביה" };
  if (!params.amount || params.amount <= 0) return { ok: false, message: "סכום לא תקין" };

  const db = getAdminFirestore();
  const routeSnap = await db.collection("n_collection_routes").doc(params.routeId).get();
  if (!routeSnap.exists) return { ok: false, message: "מסלול הגביה לא נמצא" };
  const route = { id: routeSnap.id, ...(routeSnap.data() as Omit<CollectionRoute, "id">) } as CollectionRoute;

  const feePct = route.feePct ?? 0;
  const feeFixed = route.feeFixed ?? 0;
  const feeAmount = Math.round((params.amount * feePct) / 100 + feeFixed);
  const netAmount = params.amount - feeAmount;
  const date = params.date ?? new Date().toISOString().slice(0, 10);

  const desc =
    feeAmount > 0
      ? params.desc + " (עמלת סליקה: " + feeAmount + "₪, מסלול: " + route.name + ")"
      : params.desc + " (מסלול: " + route.name + ")";

  const incomeData: Omit<AccountingIncome, "id"> = {
    date,
    amount: netAmount,
    desc,
    business: params.business,
    type: "cash",
    month: date.slice(0, 7),
  };
  const ref = await db.collection("n_ah_income").add(incomeData);

  if (route.receiptsProvider && route.receiptsProvider !== "none") {
    await db.collection("n_receipts").add({
      routeId: route.id,
      incomeId: ref.id,
      amount: params.amount,
      desc: params.desc,
      date,
      provider: route.receiptsProvider,
      status: "simulated",
      createdAt: Timestamp.now(),
    });
  }

  return { ok: true, incomeId: ref.id, grossAmount: params.amount, feeAmount, netAmount };
}
