"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { chargeViaRoute } from "@/lib/collection-charge";
import { Timestamp } from "firebase-admin/firestore";
import type { RentalClient, Laptop, Stick, Rental, Branch } from "@ultranet/shared-types";
import { parseClientsWorkbook } from "@/lib/client-excel";
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

export async function importClientsAction(formData: FormData) {
  const session = await requireSession();
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;
  const isOwner = role === "owner";

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect("/dashboard/rentals/clients?importError=missing");
  }

  const buf = Buffer.from(await (file as File).arrayBuffer());
  const { rows, errors } = parseClientsWorkbook(buf);

  const db = getAdminFirestore();
  const branchesSnap = await db.collection("n_branches").where("branchType", "==", "rentals").get();
  const branches = branchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }));
  const branchIdByName = new Map(branches.map((b) => [b.name.trim(), b.id]));

  let created = 0;
  let updated = 0;
  let skipped = errors.length;

  for (const row of rows) {
    let branchId = myBranchId ?? "";
    if (isOwner) {
      const resolved = row.branchName ? branchIdByName.get(row.branchName.trim()) : undefined;
      if (!resolved) {
        skipped++;
        continue;
      }
      branchId = resolved;
    }
    if (!branchId) {
      skipped++;
      continue;
    }

    const data: Omit<RentalClient, "id"> = {
      branchId,
      name: row.name,
      phone: row.phone,
      email: row.email,
      idNum: row.idNum,
      address: row.address,
      signedTerms: row.signedTerms,
      depositType: row.depositType,
    };

    let existingId: string | null = null;
    if (row.idNum) {
      const match = await db
        .collection("n_rental_clients")
        .where("branchId", "==", branchId)
        .where("idNum", "==", row.idNum)
        .limit(1)
        .get();
      if (!match.empty) existingId = match.docs[0]!.id;
    }
    if (!existingId) {
      const matchByName = await db
        .collection("n_rental_clients")
        .where("branchId", "==", branchId)
        .where("name", "==", row.name)
        .limit(1)
        .get();
      if (!matchByName.empty) existingId = matchByName.docs[0]!.id;
    }

    if (existingId) {
      await db.collection("n_rental_clients").doc(existingId).set(stripUndefined(data), { merge: true });
      updated++;
    } else {
      await db.collection("n_rental_clients").add(stripUndefined(data));
      created++;
    }
  }

  revalidatePath("/dashboard/rentals/clients");
  redirect(`/dashboard/rentals/clients?imported=${created}&updated=${updated}&skipped=${skipped}`);
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
  const ref = await getAdminFirestore().collection("n_rental_clients").add(stripUndefined(data));
  revalidatePath("/dashboard/rentals/clients");
  if (depositType === "credit") {
    redirect(`/dashboard/rentals/clients/${ref.id}?openCard=1`);
  }
  redirect("/dashboard/rentals/clients");
}

export async function saveClientCardTokenAction(clientId: string, token: string, last4: string, cardExpiry?: string) {
  await requireSession();
  await getAdminFirestore().collection("n_rental_clients").doc(clientId).set(
    { gatewayToken: token, cardLast4: last4, cardExpiry: cardExpiry || "", depositType: "credit" },
    { merge: true }
  );
  revalidatePath(`/dashboard/rentals/clients/${clientId}`);
}

export async function createNedarimTransactionAction(
  mosadId: string,
  apiValid: string,
  amount: number,
  clientName: string,
  clientPhone?: string,
  clientIdNum?: string
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const session = await requireSession();
  const role = session.user?.role;
  const perms = (session.user as { perms?: Partial<Record<string, boolean>> } | undefined)?.perms;
  if (role !== "owner" && !perms?.charging) {
    return { ok: false, message: "אין לך הרשאה לבצע חיוב" };
  }
  if (!amount || amount <= 0) {
    return { ok: false, message: "סכום לא תקין" };
  }
  const body = new URLSearchParams({
    Mosad: mosadId,
    ApiValid: apiValid,
    PaymentType: "Ragil",
    Amount: amount.toFixed(2),
    Tashlumim: "1",
    Zeout: clientIdNum ?? "",
    FirstName: clientName,
    Phone: clientPhone ?? "",
    Comment: `חיוב לקוח - ${clientName}`,
  });

  let res: Response;
  try {
    res = await fetch(
      "https://matara.pro/nedarimplus/V6/Files/WebServices/DebitIframe.aspx?Action=CreateTransaction",
      { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
  } catch {
    return { ok: false, message: "שגיאת תקשורת מול נדרים פלוס" };
  }

  const text = await res.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, message: `תגובה לא צפויה מנדרים פלוס: ${text.slice(0, 200)}` };
  }

  const status = String(data.Status ?? "");
  const id = String(data.Id ?? data.ID ?? "");
  if (status !== "OK" || !id) {
    return { ok: false, message: String(data.Message ?? "יצירת העסקה נכשלה") };
  }
  return { ok: true, id };
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

export async function toggleClientOwesMeAction(clientId: string, owesMe: boolean) {
  const session = await requireSession();
  const uid = session.user?.email;
  if (!uid) throw new Error("יש להתחבר");
  await getAdminFirestore()
    .collection("n_client_private_flags")
    .doc(`${uid}_${clientId}`)
    .set({ uid, clientId, owesMe, updatedAt: Timestamp.now() }, { merge: true });
  revalidatePath("/dashboard/rentals/clients");
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


export async function markRentalPaidAction(rentalId: string, paymentMethod: "cash" | "nedarim" | "route", routeId?: string) {
  await requireSession();
  const db = getAdminFirestore();
  const ref = db.collection("n_rentals").doc(rentalId);
  const snap = await ref.get();
  const rental = snap.data() as Omit<Rental, "id"> | undefined;
  if (!rental) throw new Error("השכרה לא נמצאה");
  const amount = rental.finalPrice ?? rental.calcPrice;
  let receiptIssued = false;

  const effectiveRouteId = routeId || rental.collectionRouteId;
  if (paymentMethod === "route" && effectiveRouteId) {
    const result = await chargeViaRoute({
      routeId: effectiveRouteId,
      amount,
      desc: "השכרה #" + rentalId,
      business: "rentals",
    });
    if (!result.ok) throw new Error(result.message);
    receiptIssued = true;
  } else {
    const date = new Date().toISOString().slice(0, 10);
    await db.collection("n_ah_income").add({
      date,
      amount,
      desc: "השכרה #" + rentalId + " (" + (paymentMethod === "nedarim" ? "נדרים פלאס" : "מזומן") + ")",
      business: "rentals",
      type: "cash",
      month: date.slice(0, 7),
      createdAt: Timestamp.now(),
    });
  }

  await ref.set({ paid: true, paymentMethod, receiptIssued }, { merge: true });
  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function closeRentalAction(
  rentalId: string,
  data: { returnDate: string; finalPrice: number; priceOverrideReason?: string; notes?: string }
) {
  await requireSession();
  await getAdminFirestore()
    .collection("n_rentals")
    .doc(rentalId)
    .set(
      stripUndefined({
        status: "returned",
        returnDate: data.returnDate,
        finalPrice: data.finalPrice,
        priceOverrideReason: data.priceOverrideReason,
        notes: data.notes,
      }),
      { merge: true }
    );
  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard");
}

export async function createRentalAction(formData: FormData) {
  const session = await requireSession();
  const role = session.user?.role;
  const branchId =
    role === "owner"
      ? String(formData.get("branchId") ?? "").trim()
      : String(session.user?.branchId ?? "").trim();
  const clientId = String(formData.get("clientId") ?? "");
  const kind = (String(formData.get("kind") ?? "laptop") as "laptop" | "stick");
  const itemId = String(formData.get("itemId") ?? "");
  const pricingVariant = (String(formData.get("pricingVariant") ?? "normal") as "normal" | "noInternet");
  const startDate = String(formData.get("startDate") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const collectionRouteId = String(formData.get("collectionRouteId") ?? "").trim() || undefined;
  if (!branchId) {
    redirect(`/dashboard/rentals/new?error=${role !== "owner" ? "no-branch" : "missing"}`);
  }
  if (!clientId || !itemId || !startDate) {
    redirect("/dashboard/rentals/new?error=missing");
  }

  let calcPrice = 0;
  if (kind === "laptop") {
    const laptopDoc = await getAdminFirestore().collection("n_laptops").doc(itemId).get();
    const laptop = laptopDoc.data() as Omit<Laptop, "id"> | undefined;
    if (laptop) {
      calcPrice =
        pricingVariant === "noInternet" && laptop.altPricing
          ? (laptop.noInternetDayPrice ?? laptop.dayPrice)
          : laptop.dayPrice;
    }
  } else {
    const stickDoc = await getAdminFirestore().collection("n_sticks").doc(itemId).get();
    const stick = stickDoc.data() as Omit<Stick, "id"> | undefined;
    if (stick) {
      calcPrice = stick.day1;
    }
  }

  const data: Omit<Rental, "id"> = {
    branchId,
    clientId,
    itemId,
    kind,
    pricingVariant: kind === "laptop" ? pricingVariant : undefined,
    startDate,
    calcPrice,
    notes,
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

export async function deleteRentalAction(rentalId: string) {
  const session = await requireSession();
  if (session.user?.role !== "owner") {
    throw new Error("רק מנהל יכול למחוק השכרה");
  }
  await getAdminFirestore().collection("n_rentals").doc(rentalId).delete();
  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard");
}
