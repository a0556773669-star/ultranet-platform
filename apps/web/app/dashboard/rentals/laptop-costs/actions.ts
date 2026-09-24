"use server";

import { revalidatePath } from "next/cache";
import { currentModuleScope } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { LaptopCostItem, LaptopCostRate } from "@ultranet/shared-types";
import { LAPTOP_COST_RATES_COLLECTION, sumCostItems } from "@/lib/laptop-costs";

export interface CostActionResult {
  ok: boolean;
  message: string;
}

async function requireOwner() {
  const scope = await currentModuleScope("rentals");
  if (!scope?.isOwner) throw new Error("בעלים בלבד");
}

function revalidate() {
  revalidatePath("/dashboard/rentals", "layout");
  revalidatePath("/dashboard/accounting/mobile");
}

/**
 * גרסת מחיר חדשה לסוג מחשב — "עדכון מחיר". לא עורכת את הקודמת: מחשב שנוסף לפני `from`
 * ממשיך לעלות את מה שעלה ביום שנוסף. אותו `from` לאותו סוג = החלפה של הגרסה באותו יום
 * (תיקון טעות הקלדה), כדי שלא ייווצרו שתי גרסאות שחלות מאותו יום.
 */
export async function saveLaptopCostRateAction(input: {
  kind: LaptopCostRate["kind"];
  from: string;
  items: LaptopCostItem[];
}): Promise<CostActionResult> {
  try {
    await requireOwner();
    if (input.kind !== "standard" && input.kind !== "graphics") return { ok: false, message: "סוג לא תקין" };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from)) return { ok: false, message: "תאריך לא תקין" };
    const items = (input.items ?? [])
      .map((i) => ({ label: String(i.label ?? "").trim(), amount: Math.round((Number(i.amount) || 0) * 100) / 100 }))
      .filter((i) => i.label && i.amount > 0);
    if (items.length === 0) return { ok: false, message: "יש להזין לפחות שורה אחת עם סכום" };
    const total = sumCostItems(items);

    const db = getAdminFirestore();
    const existing = await db
      .collection(LAPTOP_COST_RATES_COLLECTION)
      .where("kind", "==", input.kind)
      .where("from", "==", input.from)
      .limit(1)
      .get();
    const data: Omit<LaptopCostRate, "id"> = {
      kind: input.kind,
      from: input.from,
      items,
      total,
      createdAt: new Date().toISOString(),
    };
    if (existing.empty) await db.collection(LAPTOP_COST_RATES_COLLECTION).add(data);
    else await existing.docs[0]!.ref.set(data);
    revalidate();
    return { ok: true, message: `נשמר: ${total.toLocaleString("he-IL")} ₪ למחשב, החל מ-${input.from}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "אירעה שגיאה" };
  }
}

/** מחיקת גרסה שנרשמה בטעות. מחשבים שנוספו בתקופה שלה יחזרו לגרסה שלפניה. */
export async function deleteLaptopCostRateAction(id: string): Promise<CostActionResult> {
  try {
    await requireOwner();
    await getAdminFirestore().collection(LAPTOP_COST_RATES_COLLECTION).doc(id).delete();
    revalidate();
    return { ok: true, message: "הגרסה נמחקה" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "אירעה שגיאה" };
  }
}

/**
 * מחשבים ותיקים שאין להם שום תאריך (לא `addedDate`, לא תאריך פתיחה לסניף ולא השכרה) לא
 * נזקפים — אין חודש לשים בו את העלות. הפעולה הזו קובעת להם `addedDate` שנבחר, פעם אחת.
 */
export async function stampMissingAddedDatesAction(ids: string[], date: string): Promise<CostActionResult> {
  try {
    await requireOwner();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "תאריך לא תקין" };
    const db = getAdminFirestore();
    const batch = db.batch();
    let count = 0;
    for (const id of ids.slice(0, 450)) {
      const ref = db.collection("n_laptops").doc(id);
      const snap = await ref.get();
      if (!snap.exists || (snap.data() as { addedDate?: string }).addedDate) continue;
      batch.set(ref, { addedDate: date }, { merge: true });
      count++;
    }
    await batch.commit();
    revalidate();
    return { ok: true, message: `נקבע תאריך הוספה ל-${count} מחשבים` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "אירעה שגיאה" };
  }
}
