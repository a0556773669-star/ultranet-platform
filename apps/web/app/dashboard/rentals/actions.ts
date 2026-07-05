"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { chargeViaRoute } from "@/lib/collection-charge";
import type { RentalClient, Laptop, Rental } from "@ultranet/shared-types";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error("יש להתחבר");
  }
  return session;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

export async function createClientAction(formData: FormData) {
  await requireSession();
  const branchId = String(formData.get("branchId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!branchId || !name) {
    throw new Error("סניף ושם לקוח הם שדות חובה");
  }
  const data: Omit<RentalClient, "id"> = {
    branchId,
    name,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    idNum: String(formData.get("idNum") ?? "").trim() || undefined,
    address: String(formData.get("address") ?? "").trim() || undefined,
  };
  await getAdminFirestore().collection("n_rental_clients").add(stripUndefined(data));
  revalidatePath("/dashboard/rentals/clients");
}

export async function createLaptopAction(formData: FormData) {
  await requireSession();
  const branchId = String(formData.get("branchId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!branchId || !name) {
    throw new Error("סניף ושם מחשב הם שדות חובה");
  }
  const data: Omit<Laptop, "id"> = {
    branchId,
    name,
    dayPrice: Number(formData.get("dayPrice") ?? 0),
    weekPrice: Number(formData.get("weekPrice") ?? 0),
    monthPrice: Number(formData.get("monthPrice") ?? 0),
    serial: String(formData.get("serial") ?? "").trim() || undefined,
  };
  await getAdminFirestore().collection("n_laptops").add(stripUndefined(data));
  revalidatePath("/dashboard/rentals/laptops");
}

export async function createRentalAction(formData: FormData) {
  await requireSession();
  const branchId = String(formData.get("branchId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const calcPrice = Number(formData.get("calcPrice") ?? 0);
  const collectionRouteId = String(formData.get("collectionRouteId") ?? "").trim() || undefined;
  if (!branchId || !clientId || !itemId || !startDate || !endDate) {
    throw new Error("יש למלא את כל השדות");
  }
  const data: Omit<Rental, "id"> = {
    branchId,
    clientId,
    itemId,
    kind: "laptop",
    startDate,
    endDate,
    calcPrice,
    collectionRouteId,
    status: "active",
    paid: false,
  };
  await getAdminFirestore().collection("n_rentals").add(stripUndefined(data));
  revalidatePath("/dashboard/rentals");
  redirect("/dashboard/rentals");
}

export async function markReturnedAction(id: string) {
  await requireSession();
  const db = getAdminFirestore();
  const rentalRef = db.collection("n_rentals").doc(id);
  const snap = await rentalRef.get();
  const rental = snap.data() as Omit<Rental, "id"> | undefined;
  await rentalRef.set(
    { status: "returned", returnDate: new Date().toISOString().slice(0, 10) },
    { merge: true },
  );
  if (rental && rental.collectionRouteId && !rental.paid) {
    const amount = rental.finalPrice ?? rental.calcPrice;
    const result = await chargeViaRoute({
      routeId: rental.collectionRouteId,
      amount,
      desc: "גביית השכרה #" + id,
      business: "rentals",
    });
    if (result.ok) {
      await rentalRef.set({ paid: true, paymentMethod: "route" }, { merge: true });
    }
  }
  revalidatePath("/dashboard/rentals");
}
