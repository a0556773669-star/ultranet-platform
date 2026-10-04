"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentModuleScope, scopedSession } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Firestore } from "firebase-admin/firestore";
import type { Laptop, LaptopSale, LaptopSaleItems, Stick } from "@ultranet/shared-types";
import { roundPrice } from "@/lib/rental-pricing";
import {
  isLaptopActive,
  laptopDisplayName,
  parseLaptopName,
  stickNameForLaptop,
} from "@/lib/laptop-names";
import { LAPTOP_SALES_COLLECTION } from "@/lib/branch-accounting-data";
import { nextMonth, reviseFixedExpenseAmount } from "@/lib/fixed-expense-revision";

/** ה-session של מודול ההשכרות — ראה `scopedSession`. */
async function requireSession() {
  return scopedSession("rentals");
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

/**
 * השם לא מוקלד: מזינים מספר ומסמנים גרפיקה, והשם נגזר ("מחשב 145" / "מחשב 56 גרפיקה").
 * מספר חסר או לא תקין מחזיר שם ריק, וזה מה שמחזיר את הטופס עם `error=missing`.
 */
function parseLaptopForm(formData: FormData, branchId: string): Omit<Laptop, "id"> {
  const rawNumber = Number(String(formData.get("number") ?? "").trim());
  const number = Number.isInteger(rawNumber) && rawNumber > 0 ? rawNumber : undefined;
  const isGraphics = formData.get("isGraphics") === "on";
  const name = number ? laptopDisplayName(number, isGraphics) : "";
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
    number,
    isGraphics,
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
  // תאריך ההוספה קובע גם את עלות ההוספה שנזקפת לסניף (לפי המחיר שבתוקף ביום הזה), ולכן
  // הבעלים יכול לקבוע אותו — למשל מחשב שהגיע בשבוע שעבר ונרשם רק היום.
  const addedDateInput = String(formData.get("addedDate") ?? "").trim();
  (data as Record<string, unknown>).addedDate =
    role === "owner" && /^\d{4}-\d{2}-\d{2}$/.test(addedDateInput)
      ? addedDateInput
      : new Date().toISOString().slice(0, 10);
  if (!data.branchId || !data.name) {
    redirect(`/dashboard/rentals/laptops/new?error=${role !== "owner" && !data.branchId ? "no-branch" : "missing"}`);
  }
  if (await numberTaken(data.branchId, data.number!, null)) {
    redirect(`/dashboard/rentals/laptops/new?error=duplicate`);
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
  if (await numberTaken(data.branchId, data.number!, id)) {
    redirect(`/dashboard/rentals/laptops/${id}?error=duplicate`);
  }
  if (role === "owner") {
    const addedDateInput = String(formData.get("addedDate") ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(addedDateInput)) (data as Record<string, unknown>).addedDate = addedDateInput;
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

/** האם יש כבר מחשב פעיל אחר באותו סניף עם אותו מספר. */
async function numberTaken(branchId: string, number: number, exceptId: string | null): Promise<boolean> {
  const snap = await getAdminFirestore().collection("n_laptops").where("branchId", "==", branchId).get();
  return snap.docs.some((d) => {
    if (d.id === exceptId) return false;
    const l = d.data() as Omit<Laptop, "id">;
    if (!isLaptopActive(l)) return false;
    const n = l.number ?? parseLaptopName(l.name ?? "").number;
    return n === number;
  });
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

/* ------------------------------------------------------------------ *
 * מכירה והוצאה של מחשב — המחשב לא נמחק, הוא משנה מצב
 * ------------------------------------------------------------------ */

/**
 * מה לעשות עם ההוצאות הקבועות של הסניף כשמחשב יוצא ממנו (סים שנמכר → אין יותר סינון לשלם עליו).
 * `stop` = ההוצאה נעצרת; תאריך היציאה הוא החודש האחרון שנספר.
 * `reduce` = הסכום החודשי יורד ב-`reduceBy` מהחודש שאחרי (מי שרשם 650 ₪ על עשרה סימים ומוכר
 * אחד, עובר ל-585 ₪) — כך שהחודש של היציאה עצמו נספר במלואו, בדיוק כמו בעצירה.
 */
export interface ExpenseChange {
  id: string;
  mode: "stop" | "reduce";
  reduceBy?: number;
}

export interface LaptopExitResult {
  ok: boolean;
  message: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function loadLaptopForExit(id: string) {
  const db = getAdminFirestore();
  const ref = db.collection("n_laptops").doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("המחשב לא נמצא");
  const laptop = { ...(snap.data() as Omit<Laptop, "id">), id } as Laptop;
  if (!isLaptopActive(laptop)) throw new Error("המחשב כבר לא פעיל בסניף");
  const [activeLaptopRentals, stickSnap] = await Promise.all([
    db.collection("n_rentals").where("itemId", "==", id).where("status", "==", "active").limit(1).get(),
    db.collection("n_sticks").where("linkedLaptopId", "==", id).limit(1).get(),
  ]);
  if (!activeLaptopRentals.empty) throw new Error("המחשב מושכר כרגע — יש לסגור את ההשכרה לפני");
  const stickDoc = stickSnap.docs[0];
  const stick = stickDoc ? ({ ...(stickDoc.data() as Omit<Stick, "id">), id: stickDoc.id } as Stick) : null;
  let stickRented = false;
  if (stick) {
    const r = await db.collection("n_rentals").where("itemId", "==", stick.id).where("status", "==", "active").limit(1).get();
    stickRented = !r.empty;
  }
  return { ref, laptop, stick, stickRented };
}

/** מחיל את השינויים שנבחרו על ההוצאות הקבועות — רק של הסניף עצמו, ולא של הספר המשותף. */
async function applyExpenseChanges(branchId: string, date: string, changes: ExpenseChange[]): Promise<string[]> {
  const notes: string[] = [];
  const db = getAdminFirestore();
  const guard = (data: Record<string, unknown>) => {
    if (data.branchId !== branchId) throw new Error("ההוצאה לא שייכת לסניף הזה");
  };
  for (const change of changes) {
    if (change.mode === "stop") {
      const ref = db.collection("n_fixed_expenses").doc(change.id);
      const snap = await ref.get();
      const data = snap.data() as Record<string, unknown> | undefined;
      if (!data) continue;
      guard(data);
      const existingEnd = typeof data.endDate === "string" ? data.endDate : null;
      if (existingEnd && existingEnd <= date) continue;
      const startDate = typeof data.startDate === "string" ? data.startDate : "";
      await ref.set({ endDate: startDate > date ? startDate : date }, { merge: true });
      notes.push(`${String(data.name ?? "הוצאה")} נעצרה`);
    } else {
      const reduceBy = Number(change.reduceBy) || 0;
      if (reduceBy <= 0) continue;
      const snap = await db.collection("n_fixed_expenses").doc(change.id).get();
      const data = snap.data() as { amount?: number; name?: string; branchId?: string } | undefined;
      if (!data) continue;
      const newAmount = Math.max(0, (data.amount || 0) - reduceBy);
      const result = await reviseFixedExpenseAmount({
        collection: "n_fixed_expenses",
        id: change.id,
        fromMonth: nextMonth(date.slice(0, 7)),
        newAmount,
        guard,
      });
      notes.push(result.ok ? `${data.name ?? "הוצאה"}: ${result.message}` : `${data.name ?? "הוצאה"}: ${result.message}`);
    }
  }
  return notes;
}

function revalidateRentals() {
  revalidatePath("/dashboard/rentals", "layout");
  revalidatePath("/dashboard/accounting/mobile");
  revalidatePath("/dashboard/accounting");
}

/**
 * מכירת מחשב. פתוח לבעלים ולשותף של הסניף (לא לעובד).
 *
 * המחיר כולו של הבעלים ונכנס כחוב של הסניף בהעברה החודשית — ראו `LaptopSale`. המחשב עובר ל-
 * `status: "sold"`; אם הסטיק נמכר איתו, גם הסטיק. סטיק שלא נמכר נשאר פעיל להשכרה.
 */
export async function sellLaptopAction(
  id: string,
  input: {
    date: string;
    price: number;
    items: LaptopSaleItems;
    simTransferred?: boolean;
    netfreeTransferred?: boolean;
    buyerName?: string;
    notes?: string;
    expenseChanges?: ExpenseChange[];
  },
): Promise<LaptopExitResult> {
  try {
    const scope = await currentModuleScope("rentals");
    if (!scope?.granted || !scope.isManager) return { ok: false, message: "מכירה פתוחה לבעלים ולשותף בלבד" };
    if (!DATE_RE.test(input.date)) return { ok: false, message: "תאריך לא תקין" };
    const price = roundPrice(Number(input.price) || 0);
    if (price <= 0) return { ok: false, message: "יש להזין את מחיר המכירה" };
    const items: LaptopSaleItems = {
      laptop: !!input.items?.laptop,
      charger: !!input.items?.charger,
      stick: !!input.items?.stick,
      sim: !!input.items?.sim,
      bag: !!input.items?.bag,
    };
    if (!Object.values(items).some(Boolean)) return { ok: false, message: "יש לסמן מה נמכר" };

    const { ref, laptop, stick, stickRented } = await loadLaptopForExit(id);
    if (!scope.allows(laptop.branchId)) return { ok: false, message: "אין הרשאה לסניף הזה" };
    if (items.stick && stickRented) return { ok: false, message: "הסטיק של המחשב מושכר כרגע — יש לסגור את ההשכרה לפני" };

    const session = await scopedSession("rentals");
    const db = getAdminFirestore();
    const sale: Omit<LaptopSale, "id"> = stripUndefined({
      branchId: laptop.branchId,
      laptopId: id,
      laptopName: laptop.name,
      date: input.date,
      month: input.date.slice(0, 7),
      price,
      items,
      simTransferred: items.sim ? !!input.simTransferred : undefined,
      netfreeTransferred: items.sim ? !!input.netfreeTransferred : undefined,
      buyerName: input.buyerName?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
      createdBy: session.user?.email ?? session.user?.name ?? undefined,
    });

    const batch = db.batch();
    batch.set(db.collection(LAPTOP_SALES_COLLECTION).doc(), sale);
    // "מחשב" לא סומן = נמכר רק ציוד נלווה; המחשב עצמו נשאר בסניף.
    if (items.laptop) batch.set(ref, { status: "sold", endedAt: input.date }, { merge: true });
    if (stick && items.stick) {
      batch.set(db.collection("n_sticks").doc(stick.id), { status: "sold", endedAt: input.date }, { merge: true });
    }
    await batch.commit();

    const notes = await applyExpenseChanges(laptop.branchId, input.date, input.expenseChanges ?? []);
    revalidateRentals();
    return {
      ok: true,
      message: [`המכירה נרשמה: ${price.toLocaleString("he-IL")} ₪ יתווספו להעברה של החודש.`, ...notes].join(" · "),
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "אירעה שגיאה" };
  }
}

/**
 * הוצאת מחשב מהסניף — בעלים בלבד. המחשב לא נמחק: מאותו יום הוא לא נספר בסניף (מהחודש שאחרי
 * במעקב), והעלות שנזקפה עליו נשארת — ההשקעה כבר נעשתה. הסטיק המקושר יוצא איתו.
 */
export async function removeLaptopAction(
  id: string,
  input: { date: string; note?: string; expenseChanges?: ExpenseChange[] },
): Promise<LaptopExitResult> {
  try {
    const scope = await currentModuleScope("rentals");
    if (!scope?.isOwner) return { ok: false, message: "הוצאת מחשב פתוחה לבעלים בלבד" };
    if (!DATE_RE.test(input.date)) return { ok: false, message: "תאריך לא תקין" };
    const { ref, laptop, stick, stickRented } = await loadLaptopForExit(id);
    if (stickRented) return { ok: false, message: "הסטיק של המחשב מושכר כרגע — יש לסגור את ההשכרה לפני" };

    const db = getAdminFirestore();
    const batch = db.batch();
    batch.set(
      ref,
      stripUndefined({ status: "removed", endedAt: input.date, endNote: input.note?.trim() || undefined }),
      { merge: true },
    );
    if (stick) batch.set(db.collection("n_sticks").doc(stick.id), { status: "removed", endedAt: input.date }, { merge: true });
    await batch.commit();

    const notes = await applyExpenseChanges(laptop.branchId, input.date, input.expenseChanges ?? []);
    revalidateRentals();
    return { ok: true, message: [`${laptop.name} הוצא מהסניף מ-${input.date}.`, ...notes].join(" · ") };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "אירעה שגיאה" };
  }
}

/** ביטול טעות: מחזיר מחשב שהוצא/נמכר למצב פעיל. מכירה שנרשמה לא נמחקת כאן. בעלים בלבד. */
export async function reactivateLaptopAction(id: string): Promise<LaptopExitResult> {
  const scope = await currentModuleScope("rentals");
  if (!scope?.isOwner) return { ok: false, message: "בעלים בלבד" };
  const db = getAdminFirestore();
  const { FieldValue } = await import("firebase-admin/firestore");
  await db
    .collection("n_laptops")
    .doc(id)
    .set({ status: FieldValue.delete(), endedAt: FieldValue.delete(), endNote: FieldValue.delete() }, { merge: true });
  const stickSnap = await db.collection("n_sticks").where("linkedLaptopId", "==", id).limit(1).get();
  if (!stickSnap.empty) {
    await stickSnap.docs[0]!.ref.set({ status: FieldValue.delete(), endedAt: FieldValue.delete() }, { merge: true });
  }
  revalidateRentals();
  return { ok: true, message: "המחשב חזר להיות פעיל" };
}

/** מחיקת מכירה שנרשמה בטעות — בעלים בלבד. המחשב לא חוזר אוטומטית (יש לכך כפתור נפרד). */
export async function deleteLaptopSaleAction(saleId: string): Promise<LaptopExitResult> {
  const scope = await currentModuleScope("rentals");
  if (!scope?.isOwner) return { ok: false, message: "בעלים בלבד" };
  await getAdminFirestore().collection(LAPTOP_SALES_COLLECTION).doc(saleId).delete();
  revalidateRentals();
  return { ok: true, message: "המכירה נמחקה" };
}

/* ------------------------------------------------------------------ *
 * האחדת שמות — "מחשב N" / "מחשב N גרפיקה"
 * ------------------------------------------------------------------ */

export interface RenamePlanRow {
  id: string;
  branchId: string;
  from: string;
  to: string | null;
  number: number | null;
  isGraphics: boolean;
}

async function buildRenamePlan(): Promise<RenamePlanRow[]> {
  const snap = await getAdminFirestore().collection("n_laptops").get();
  return snap.docs
    .map((d) => {
      const l = d.data() as Omit<Laptop, "id">;
      const parsed = parseLaptopName(l.name ?? "");
      const isGraphics = l.isGraphics ?? parsed.isGraphics;
      const number = l.number ?? parsed.number;
      return {
        id: d.id,
        branchId: l.branchId,
        from: l.name ?? "",
        to: number ? laptopDisplayName(number, isGraphics) : null,
        number,
        isGraphics,
        needs: !number || l.name !== laptopDisplayName(number, isGraphics) || l.number !== number || l.isGraphics !== isGraphics,
      };
    })
    .filter((r) => r.needs)
    .map(({ needs: _needs, ...r }) => r)
    .sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
}

/** תצוגה מקדימה: אילו שמות ישתנו, ואילו אי אפשר לנרמל (אין מספר בשם). בעלים בלבד. */
export async function previewLaptopRenameAction(): Promise<RenamePlanRow[]> {
  await requireOwner();
  return buildRenamePlan();
}

/**
 * מחיל את האחדת השמות על כל מחשב שיש בשמו מספר, ומעדכן גם את שם הסטיק המקושר ("סטיק N").
 * אידמפוטנטי: מחשב שכבר בשם הנכון לא נוגעים בו. בעלים בלבד.
 */
export async function applyLaptopRenameAction(): Promise<{ renamed: number; skipped: number }> {
  await requireOwner();
  const db = getAdminFirestore();
  const plan = await buildRenamePlan();
  const [sticksSnap] = await Promise.all([db.collection("n_sticks").get()]);
  const stickByLaptop = new Map<string, string>();
  for (const d of sticksSnap.docs) {
    const linked = (d.data() as { linkedLaptopId?: string }).linkedLaptopId;
    if (linked) stickByLaptop.set(linked, d.id);
  }
  let renamed = 0;
  let skipped = 0;
  const writes: ((b: FirebaseFirestore.WriteBatch) => void)[] = [];
  for (const row of plan) {
    if (!row.to || !row.number) {
      skipped++;
      continue;
    }
    const name = row.to;
    const number = row.number;
    const isGraphics = row.isGraphics;
    writes.push((b) => b.set(db.collection("n_laptops").doc(row.id), { name, number, isGraphics }, { merge: true }));
    const stickId = stickByLaptop.get(row.id);
    if (stickId) writes.push((b) => b.set(db.collection("n_sticks").doc(stickId), { name: stickNameForLaptop(name) }, { merge: true }));
    renamed++;
  }
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) w(batch);
    await batch.commit();
  }
  revalidatePath("/dashboard/rentals", "layout");
  return { renamed, skipped };
}
