"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Firestore } from "firebase-admin/firestore";
import type { Laptop } from "@ultranet/shared-types";
import { roundPrice } from "@/lib/rental-pricing";

async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  return session;
}

async function requireOwner() {
  const session = await requireSession();
  if (session.user?.role !== "owner") throw new Error("אין הרשאה");
  return session;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out = {} as T;
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

/** "מחשב 20" -> "סטיק 20"; falls back to the full laptop name if it has no number in it. */
function stickNameForLaptop(laptopName: string): string {
  const match = laptopName.match(/\d+/);
  return match ? `סטיק ${match[0]}` : `סטיק - ${laptopName}`;
}

type StickPricing = {
  day1: number;
  day2: number;
  day3plus: number;
  weekPrice: number;
  monthPrice: number;
};

/** כל מחיר במערכת נשמר כשקל שלם - אין אגורות בהשכרות. */
function priceField(formData: FormData, key: string): number {
  return roundPrice(Number(formData.get(key)) || 0);
}

/**
 * Keeps n_sticks in sync with a laptop's "יש סטיק משוייך" flag: creates the linked stick the
 * first time hasStick is on, otherwise updates the existing one in place (matched by
 * linkedLaptopId). Never deletes - turning hasStick off just stops updating the stick, so an
 * already-rented stick's history/active rental is never destroyed by an unrelated laptop edit.
 */
async function syncLinkedStick(
  db: Firestore,
  laptopId: string,
  laptop: { branchId: string; name: string; hasStick?: boolean; simNumber?: string },
  pricing: StickPricing
) {
  if (!laptop.hasStick) return;
  const existing = await db.collection("n_sticks").where("linkedLaptopId", "==", laptopId).limit(1).get();
  const data = stripUndefined({
    branchId: laptop.branchId,
    name: stickNameForLaptop(laptop.name),
    sim: laptop.simNumber,
    linkedLaptopId: laptopId,
    day1: pricing.day1,
    day2: pricing.day2,
    day3plus: pricing.day3plus,
    weekPrice: pricing.weekPrice,
    monthPrice: pricing.monthPrice,
  });
  if (existing.empty) {
    await db.collection("n_sticks").add(data);
  } else {
    await db.collection("n_sticks").doc(existing.docs[0]!.id).set(data, { merge: true });
  }
}

function parseLaptopForm(formData: FormData, branchId: string): Omit<Laptop, "id"> {
  const name = String(formData.get("name") ?? "").trim();
  const dayPrice = priceField(formData, "dayPrice");
  const weekPrice = priceField(formData, "weekPrice");
  const monthPrice = priceField(formData, "monthPrice");
  const hasStick = formData.get("hasStick") === "on";
  const simNumber = hasStick ? String(formData.get("simNumber") ?? "").trim() || undefined : undefined;
  // "בלי סטיק" הוא עכשיו חלק קבוע מהמחירון: מספיק למלא מחיר אחד בעמודה הזו כדי
  // שההשכרה בלי סטיק תתומחר לפיו. שדה ריק נופל חזרה למחיר "עם סטיק" (laptopRatesFor).
  const noInternetDayPrice = priceField(formData, "noInternetDayPrice");
  const noInternetWeekPrice = priceField(formData, "noInternetWeekPrice");
  const noInternetMonthPrice = priceField(formData, "noInternetMonthPrice");
  const altPricing = noInternetDayPrice > 0 || noInternetWeekPrice > 0 || noInternetMonthPrice > 0;
  const hasPartner = formData.get("hasPartner") === "on";
  const partnerName = hasPartner ? String(formData.get("partnerName") ?? "").trim() || undefined : undefined;
  const partnerPct = hasPartner ? Number(formData.get("partnerPct")) || 15 : undefined;
  return {
    branchId,
    name,
    dayPrice,
    weekPrice,
    monthPrice,
    hasStick,
    simNumber,
    altPricing,
    noInternetDayPrice,
    noInternetWeekPrice,
    noInternetMonthPrice,
    hasPartner,
    partnerName,
    partnerPct,
  };
}

function parseStickPricing(formData: FormData): StickPricing {
  return {
    day1: priceField(formData, "stickDay1"),
    day2: priceField(formData, "stickDay2"),
    day3plus: priceField(formData, "stickDay3plus"),
    weekPrice: priceField(formData, "stickWeekPrice"),
    monthPrice: priceField(formData, "stickMonthPrice"),
  };
}

export async function createLaptopAction(formData: FormData) {
  const session = await requireSession();
  const role = session.user?.role;
  const branchId =
    role === "owner" ? String(formData.get("branchId") ?? "").trim() : String(session.user?.branchId ?? "").trim();
  const data = parseLaptopForm(formData, branchId);
  (data as Record<string, unknown>).addedDate = new Date().toISOString().slice(0, 10);
  if (!data.branchId || !data.name) {
    redirect(`/dashboard/rentals/laptops/new?error=${role !== "owner" && !data.branchId ? "no-branch" : "missing"}`);
  }
  const db = getAdminFirestore();
  let laptopId: string;
  try {
    const ref = await db.collection("n_laptops").add(stripUndefined(data));
    laptopId = ref.id;
    await syncLinkedStick(db, laptopId, data, parseStickPricing(formData));
  } catch (e) {
    throw new Error("שגיאה בשמירת המחשב ל-Firestore: " + (e instanceof Error ? e.message : String(e)));
  }
  revalidatePath("/dashboard/rentals", "layout");
  redirect("/dashboard/rentals/laptops");
}

export async function updateLaptopAction(id: string, formData: FormData) {
  const session = await requireSession();
  const role = session.user?.role;
  const existing = await getAdminFirestore().collection("n_laptops").doc(id).get();
  const existingBranchId = (existing.data() as Omit<Laptop, "id"> | undefined)?.branchId ?? "";
  const branchId = role === "owner" ? String(formData.get("branchId") ?? "").trim() : existingBranchId;
  const data = parseLaptopForm(formData, branchId);
  if (!data.branchId || !data.name) {
    redirect(`/dashboard/rentals/laptops/${id}?error=${role !== "owner" && !data.branchId ? "no-branch" : "missing"}`);
  }
  const db = getAdminFirestore();
  try {
    await db.collection("n_laptops").doc(id).set(stripUndefined(data), { merge: true });
    await syncLinkedStick(db, id, data, parseStickPricing(formData));
  } catch (e) {
    throw new Error("שגיאה בעדכון המחשב ב-Firestore: " + (e instanceof Error ? e.message : String(e)));
  }
  revalidatePath("/dashboard/rentals", "layout");
  redirect("/dashboard/rentals/laptops");
}

export async function deleteLaptopAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_laptops").doc(id).delete();
  revalidatePath("/dashboard/rentals", "layout");
  redirect("/dashboard/rentals/laptops");
}

/**
 * Idempotent backfill that gives every laptop a rentable stick, regardless of whether "יש סטיק
 * משוייך" was ever turned on for it: creates the missing n_sticks doc (priced at 0 until the owner
 * edits the computer and fills in the stick pricing) and flips hasStick on so the laptop's edit
 * form shows the stick fields going forward. Never touches laptops that already have a linked
 * stick.
 */
export async function syncAllSticksAction() {
  await requireOwner();
  const db = getAdminFirestore();
  const laptopsSnap = await db.collection("n_laptops").get();
  let created = 0;
  for (const doc of laptopsSnap.docs) {
    const laptop = doc.data() as Omit<Laptop, "id">;
    const existing = await db.collection("n_sticks").where("linkedLaptopId", "==", doc.id).limit(1).get();
    if (!existing.empty) continue;
    await db.collection("n_sticks").add(
      stripUndefined({
        branchId: laptop.branchId,
        name: stickNameForLaptop(laptop.name),
        sim: laptop.simNumber,
        linkedLaptopId: doc.id,
        day1: 0,
        day2: 0,
        day3plus: 0,
        weekPrice: 0,
        monthPrice: 0,
      })
    );
    if (!laptop.hasStick) {
      await db.collection("n_laptops").doc(doc.id).set({ hasStick: true }, { merge: true });
    }
    created++;
  }
  revalidatePath("/dashboard/rentals", "layout");
  redirect(`/dashboard/rentals/laptops?synced=${created}`);
}
