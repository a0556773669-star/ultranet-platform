"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { chargeViaRoute } from "@/lib/collection-charge";
import type { RentalClient, Laptop, Rental } from "@ultranet/shared-types";
import { calcRentalPrice, calcRentalDays } from "@/lib/rental-pricing";

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
    redirect("/dashboard/rentals/clients?error=missing");
  }
  const depositType = String(formData.get("depositType") ?? "none") as "none" | "check" | "credit";
  const data: Omit<RentalClient, "id"> = {
    branchId,
    name,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    email: String(formData.get("email") ?? "").trim() || undefined,
    idNum: String(formData.get("idNum") ?? "").trim() || undefined,
    address: String(formData.get("address") ?? "").trim() || undefined,
    signedTerms: formData.get("signedTerms") === "on",
    depositType,
    cardLast4: depositType === "credit" ? (String(formData.get("cardLast4") ?? "").trim().slice(-4) || undefined) : undefined,
    cardExpiry: depositType === "credit" ? (String(formData.get("cardExpiry") ?? "").trim() || undefined) : undefined,
  };
  await getAdminFirestore().collection("n_rental_clients").add(stripUndefined(data));
  revalidatePath("/dashboard/rentals/clients");
  redirect("/dashboard/rentals/clients");
}

export async function updateClientAction(id: string, formData: FormData) {
  await requireSession();
  const branchId = String(formData.get("branchId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!branchId || !name) {
    redirect(`/dashboard/rentals/clients/${id}?error=missing`);
  }
  const depositType = String(formData.get("depositType") ?? "none") as "none" | "check" | "credit";
  const data: Omit<RentalClient, "id"> = {
    branchId,
    name,
    phone: String(formData.get("phone") ?? "").trim() || undefined,
    email: String(formData.get("email") ?? "").trim() || undefined,
    idNum: String(formData.get("idNum") ?? "").trim() || undefined,
    address: String(formData.get("address") ?? "").trim() || undefined,
    signedTerms: formData.get("signedTerms") === "on",
    depositType,
    cardLast4: depositType === "credit" ? (String(formData.get("cardLast4") ?? "").trim().slice(-4) || undefined) : undefined,
    cardExpiry: depositType === "credit" ? (String(formData.get("cardExpiry") ?? "").trim() || undefined) : undefined,
  };
  await getAdminFirestore().collection("n_rental_clients").doc(id).set(stripUndefined(data), { merge: true });
  revalidatePath("/dashboard/rentals/clients");
  redirect("/dashboard/rentals/clients");
}

export async function deleteClientAction(id: string) {
  const session = await requireSession();
  if (session.user?.role !== "owner") {
    redirect("/dashboard/rentals/clients?error=forbidden");
  }
  await getAdminFirestore().collection("n_rental_clients").doc(id).delete();
  revalidatePath("/dashboard/rentals/clients");
  redirect("/dashboard/rentals/clients");
}


export async function createRentalAction(formData: FormData) {
  await requireSession();
  const branchId = String(formData.get("branchId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const collectionRouteId = String(formData.get("collectionRouteId") ?? "").trim() || undefined;
  if (!branchId || !clientId || !itemId || !startDate || !endDate) {
    throw new Error("יש למלא את כל השדות");
  }
  const laptopDoc = await getAdminFirestore().collection("n_laptops").doc(itemId).get();
  const laptop = laptopDoc.data() as Omit<Laptop, "id"> | undefined;
  const rentalDays = calcRentalDays(startDate, endDate);
  const calcPrice = laptop ? calcRentalPrice(rentalDays, laptop.dayPrice, laptop.weekPrice, laptop.monthPrice) : 0;
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
