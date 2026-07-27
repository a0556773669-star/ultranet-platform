"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { resolveEzcountCreds, createEzcountReceipt } from "@/lib/ezcount";
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
  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }));
  const branchIdByName = new Map(branches.map((b) => [b.name.trim(), b.id]));

  let created = 0;
  let updated = 0;
  const skipReasons: string[] = [...errors];

  for (const row of rows) {
    let branchId = myBranchId ?? "";
    if (isOwner) {
      const resolved = row.branchName ? branchIdByName.get(row.branchName.trim()) : undefined;
      if (!resolved) {
        skipReasons.push(
          row.branchName
            ? `הלקוח "${row.name}": לא נמצא סניף השכרות בשם "${row.branchName}" (ודא שם מדויק כפי שמופיע במערכת)`
            : `הלקוח "${row.name}": עמודת הסניף ריקה`
        );
        continue;
      }
      branchId = resolved;
    }
    if (!branchId) {
      skipReasons.push(`הלקוח "${row.name}": המשתמש שלך אינו משויך לסניף - פנה למנהל המערכת`);
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

  revalidatePath("/dashboard/rentals", "layout");
  const params = new URLSearchParams();
  params.set("imported", String(created));
  params.set("updated", String(updated));
  params.set("skipped", String(skipReasons.length));
  const MAX_REASONS = 8;
  for (const reason of skipReasons.slice(0, MAX_REASONS)) params.append("reason", reason);
  if (skipReasons.length > MAX_REASONS) params.set("reasonMore", String(skipReasons.length - MAX_REASONS));
  redirect(`/dashboard/rentals/clients?${params.toString()}`);
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
    referralSource: String(formData.get("referralSource") ?? "").trim() || undefined,
    signedTerms: formData.get("signedTerms") === "on",
    depositType,
    cardLast4: depositType === "credit" ? (String(formData.get("cardLast4") ?? "").trim().slice(-4) || undefined) : undefined,
    cardExpiry: depositType === "credit" ? (String(formData.get("cardExpiry") ?? "").trim() || undefined) : undefined,
  };
  const ref = await getAdminFirestore().collection("n_rental_clients").add(stripUndefined(data));
  // Layout-wide, not just /clients: otherwise a client created here can still show as "missing"
  // right after on /dashboard/rentals/new (stale router cache) until a second, unrelated
  // navigation happens to invalidate it - this was the "customer doesn't exist on first try" bug.
  revalidatePath("/dashboard/rentals", "layout");
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
    referralSource: String(formData.get("referralSource") ?? "").trim() || undefined,
    signedTerms: formData.get("signedTerms") === "on",
    depositType,
    cardLast4: depositType === "credit" ? (String(formData.get("cardLast4") ?? "").trim().slice(-4) || undefined) : undefined,
    cardExpiry: depositType === "credit" ? (String(formData.get("cardExpiry") ?? "").trim() || undefined) : undefined,
  };
  await getAdminFirestore().collection("n_rental_clients").doc(id).set(stripUndefined(data), { merge: true });
  revalidatePath("/dashboard/rentals", "layout");
  redirect("/dashboard/rentals/clients");
}

export async function deleteClientAction(id: string) {
  const session = await requireSession();
  if (session.user?.role !== "owner" && session.user?.role !== "partner") {
    redirect("/dashboard/rentals/clients?error=forbidden");
  }
  await getAdminFirestore().collection("n_rental_clients").doc(id).delete();
  revalidatePath("/dashboard/rentals", "layout");
  redirect("/dashboard/rentals/clients");
}


/**
 * Marks a rental as paid. Deliberately never writes to n_ah_income (the main ledger): rental
 * income only reaches the main accounting when the owner manually adds it there via the
 * "ניידים" income type (/dashboard/accounting) - this action is purely internal rental-tracking
 * bookkeeping (n_rentals), independent of the main ledger.
 */
export async function markRentalPaidAction(
  rentalId: string,
  paymentMethod: "cash" | "nedarim" | "route",
  _routeId?: string,
  receiptPdfLink?: string
) {
  await requireSession();
  const db = getAdminFirestore();
  const ref = db.collection("n_rentals").doc(rentalId);
  const snap = await ref.get();
  const rental = snap.data() as Omit<Rental, "id"> | undefined;
  if (!rental) throw new Error("השכרה לא נמצאה");
  const receiptIssued = !!receiptPdfLink;

  await ref.set(
    stripUndefined({ paid: true, paymentMethod, receiptIssued, receiptPdfLink }),
    { merge: true }
  );
  revalidatePath("/dashboard/rentals", "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function issueCashReceiptAction(rentalId: string) {
  const session = await requireSession();
  const role = session.user?.role;
  const perms = (session.user as { perms?: Partial<Record<string, boolean>> } | undefined)?.perms;
  if (role !== "owner" && !perms?.charging) {
    return { ok: false as const, message: "אין לך הרשאה להפיק קבלות" };
  }

  const db = getAdminFirestore();
  const rentalSnap = await db.collection("n_rentals").doc(rentalId).get();
  const rental = rentalSnap.data() as Omit<Rental, "id"> | undefined;
  if (!rental) return { ok: false as const, message: "השכרה לא נמצאה" };

  const clientSnap = await db.collection("n_rental_clients").doc(rental.clientId).get();
  const client = clientSnap.data() as RentalClient | undefined;
  if (!client) return { ok: false as const, message: "לקוח לא נמצא" };

  const creds = await resolveEzcountCreds(rental.branchId);
  if (!creds) {
    return { ok: false as const, message: "לא הוגדר ספק קבלות (EZcount) לסניף זה" };
  }

  const amount = rental.finalPrice ?? rental.calcPrice;
  const result = await createEzcountReceipt({
    creds,
    amount,
    clientName: client.name,
    clientEmail: client.email,
    clientIdNum: client.idNum,
    desc: "תשלום השכרה - מזומן/העברה",
    paymentType: 1,
  });
  if (!result.ok) {
    return { ok: false as const, message: result.message };
  }

  await markRentalPaidAction(rentalId, "cash", undefined, result.pdfLink);
  return { ok: true as const, pdfLink: result.pdfLink };
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
  revalidatePath("/dashboard/rentals", "layout");
  revalidatePath("/dashboard");
}

export async function closeRentalWithChargeAction(
  rentalId: string,
  data: { returnDate: string; finalPrice: number; priceOverrideReason?: string; notes?: string },
  receiptPdfLink?: string
) {
  await requireSession();
  // הגבייה המידית (נדרים פלוס) כבר בוצעה בהצלחה בצד הלקוח לפני קריאה לפעולה זו -
  // כאן רק מסמנים שולם וסוגרים את ההשכרה יחד, כדי שלא יישאר מצב ביניים של "חויב אך לא סגור".
  await markRentalPaidAction(rentalId, "nedarim", undefined, receiptPdfLink);
  await closeRentalAction(rentalId, data);
  return { ok: true };
}

export async function updateRentalHistoryAction(
  rentalId: string,
  data: { startDate: string; returnDate: string; finalPrice: number; notes?: string }
) {
  await requireSession();
  if (!data.startDate || !data.returnDate) {
    throw new Error("חובה למלא תאריך התחלה ותאריך החזרה");
  }
  await getAdminFirestore()
    .collection("n_rentals")
    .doc(rentalId)
    .set(
      stripUndefined({
        startDate: data.startDate,
        returnDate: data.returnDate,
        finalPrice: data.finalPrice,
        notes: data.notes,
      }),
      { merge: true }
    );
  revalidatePath("/dashboard/rentals", "layout");
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
  const mine = String(formData.get("mine") ?? "").trim() === "1";
  const mineParam = mine ? "&mine=1" : "";
  if (!branchId) {
    redirect(`/dashboard/rentals/new?error=${role !== "owner" ? "no-branch" : "missing"}${mineParam}`);
  }
  if (!clientId || !itemId || !startDate) {
    const missing = [
      !clientId && "לקוח",
      !itemId && "מחשב/סטיק",
      !startDate && "תאריך התחלה",
    ]
      .filter(Boolean)
      .join(", ");
    redirect(`/dashboard/rentals/new?error=missing&missingFields=${encodeURIComponent(missing)}${mineParam}`);
  }

  const activeForItem = await getAdminFirestore()
    .collection("n_rentals")
    .where("itemId", "==", itemId)
    .where("status", "==", "active")
    .limit(1)
    .get();
  if (!activeForItem.empty) {
    redirect(`/dashboard/rentals/new?error=already-rented${mineParam}`);
  }

  // שכירת סטיק בנפרד: אם הסטיק הזה משוייך למחשב שמושכר כרגע "עם אינטרנט" (ברירת המחדל),
  // הוא בפועל כבר יצא עם הלקוח של המחשב - אין למכור אותו שוב גם אם אין לו רשומת n_rentals משלו.
  if (kind === "stick") {
    const stickDoc = await getAdminFirestore().collection("n_sticks").doc(itemId).get();
    const linkedLaptopId = (stickDoc.data() as Omit<Stick, "id"> | undefined)?.linkedLaptopId;
    if (linkedLaptopId) {
      const bundledRental = await getAdminFirestore()
        .collection("n_rentals")
        .where("itemId", "==", linkedLaptopId)
        .where("status", "==", "active")
        .where("kind", "==", "laptop")
        .limit(1)
        .get();
      const bundled = bundledRental.docs[0]?.data() as Omit<Rental, "id"> | undefined;
      if (bundled && bundled.pricingVariant !== "noInternet") {
        redirect(`/dashboard/rentals/new?error=already-rented${mineParam}`);
      }
    }
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
  revalidatePath("/dashboard/rentals", "layout");
  redirect(mine ? "/dashboard/rentals/mine" : "/dashboard/rentals");
}

export async function markReturnedAction(id: string) {
  await requireSession();
  const db = getAdminFirestore();
  const rentalRef = db.collection("n_rentals").doc(id);
  // Return only updates status/returnDate - it never auto-charges or auto-marks paid (that used
  // to silently write to n_ah_income via chargeViaRoute on every return with a route). Unpaid
  // returned rentals show up in the "לא שולם" list (/dashboard/rentals/manage) for the owner to
  // collect explicitly; income only reaches the main ledger via a manual entry there.
  await rentalRef.set(
    { status: "returned", returnDate: new Date().toISOString().slice(0, 10) },
    { merge: true },
  );
  revalidatePath("/dashboard/rentals", "layout");
}

export async function deleteRentalAction(rentalId: string) {
  const session = await requireSession();
  if (session.user?.role !== "owner" && session.user?.role !== "partner") {
    throw new Error("רק מנהל או שותף יכולים למחוק השכרה");
  }
  await getAdminFirestore().collection("n_rentals").doc(rentalId).delete();
  revalidatePath("/dashboard/rentals", "layout");
  revalidatePath("/dashboard");
}

/**
 * Reassigns a rental to a different laptop/stick of the same kind - e.g. fixing a data-entry
 * mistake ("wrong computer number"). Only checked against other *active* rentals: a returned
 * rental's itemId is just a historical record, so retargeting it can't create a double-booking.
 */
export async function updateRentalItemAction(rentalId: string, itemId: string) {
  await requireSession();
  const db = getAdminFirestore();
  const ref = db.collection("n_rentals").doc(rentalId);
  const snap = await ref.get();
  const rental = snap.data() as Omit<Rental, "id"> | undefined;
  if (!rental) throw new Error("השכרה לא נמצאה");

  const itemCollection = rental.kind === "stick" ? "n_sticks" : "n_laptops";
  const itemDoc = await db.collection(itemCollection).doc(itemId).get();
  const item = itemDoc.data() as { branchId?: string } | undefined;
  if (!item || item.branchId !== rental.branchId) {
    throw new Error("הפריט שנבחר לא שייך לסניף הזה");
  }

  if (rental.status === "active") {
    const clash = await db
      .collection("n_rentals")
      .where("itemId", "==", itemId)
      .where("status", "==", "active")
      .limit(1)
      .get();
    if (!clash.empty && clash.docs[0]!.id !== rentalId) {
      throw new Error("הפריט הזה כבר מושכר בהשכרה פעילה אחרת");
    }
  }

  await ref.set({ itemId }, { merge: true });
  revalidatePath("/dashboard/rentals", "layout");
  revalidatePath("/dashboard");
}

/** Reverts a mistaken "mark as paid" back to unpaid - purely internal bookkeeping (n_rentals), same as markRentalPaidAction. */
export async function markRentalUnpaidAction(rentalId: string) {
  await requireSession();
  await getAdminFirestore()
    .collection("n_rentals")
    .doc(rentalId)
    .set(
      { paid: false, paymentMethod: FieldValue.delete(), receiptIssued: false, receiptPdfLink: FieldValue.delete() },
      { merge: true },
    );
  revalidatePath("/dashboard/rentals", "layout");
  revalidatePath("/dashboard");
}
