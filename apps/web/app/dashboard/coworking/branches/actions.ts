"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { setupCostCountsToMainFromForm } from "@/lib/counts-to-main";
import type { Branch, SetupCostItem } from "@ultranet/shared-types";

/**
 * סניפי המשרד השיתופי.
 *
 * עד עכשיו לא הייתה דרך להקים סניף כזה מתוך המערכת: כל מסכי המשרד השיתופי שואלים
 * `n_branches` על `branchType == "coworking"`, אבל את המסמך עצמו היה צריך ליצור ביד
 * ב-Firestore. אותו מודל בדיוק כמו בחדרי מחשבים - אותו קולקשן, אותם שדות, רק `branchType` אחר.
 */

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
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

function parseSetupItems(raw: FormDataEntryValue | null): SetupCostItem[] | undefined {
  if (typeof raw !== "string" || raw === "") return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    return parsed
      .map((entry) => {
        const item = entry as Partial<SetupCostItem>;
        return { label: String(item?.label ?? "").trim(), amount: Number(item?.amount) || 0 };
      })
      .filter((item) => item.label !== "" || item.amount !== 0);
  } catch {
    return undefined;
  }
}

function parseCoworkingBranchForm(formData: FormData): Omit<Branch, "id"> {
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || undefined;
  const phone = String(formData.get("phone") ?? "").trim() || undefined;
  // נשמר כ-"" ולא כ-undefined כשריק, כדי שניקוי השדה בטופס באמת ינקה אותו (stripUndefined
  // היה משמיט אותו מה-merge ומשאיר את הערך הישן).
  const openedAt = String(formData.get("openedAt") ?? "").trim();
  const notStarted = formData.get("notStarted") === "on";
  const isMine = formData.get("isMine") === "on";
  const partnerName = String(formData.get("partnerName") ?? "").trim() || undefined;
  const partnerEmail = String(formData.get("partnerEmail") ?? "").trim() || undefined;
  const myPct = Number(formData.get("myPct") ?? 100);
  const partnerPct = Number(formData.get("partnerPct") ?? 0);
  // הסכום מחושב מהשורות ולא נלקח כמו שהוא, בדיוק כמו בחדרי מחשבים.
  const setupItems = parseSetupItems(formData.get("setupItems"));
  const setupCostRaw = formData.get("setupCost");
  const setupCost = setupItems
    ? setupItems.reduce((total, item) => total + item.amount, 0)
    : setupCostRaw
      ? Number(setupCostRaw)
      : undefined;
  const setupCountsToMain = setupCostCountsToMainFromForm(formData);
  const notes = String(formData.get("notes") ?? "").trim() || undefined;

  return {
    name,
    branchType: "coworking",
    location,
    phone,
    openedAt,
    notStarted,
    isMine,
    partnerName,
    partnerEmail,
    myPct,
    partnerPct,
    setupCost,
    setupItems,
    setupCountsToMain,
    notes,
    parentBranchId: null,
  };
}

function revalidateCoworking(id?: string) {
  revalidatePath("/dashboard/coworking");
  revalidatePath("/dashboard/coworking/expenses");
  revalidatePath("/dashboard/coworking/accounting");
  revalidatePath("/dashboard/accounting");
  if (id) revalidatePath(`/dashboard/coworking/branches/${id}`);
}

export async function createCoworkingBranchAction(formData: FormData) {
  await requireOwner();
  const data = parseCoworkingBranchForm(formData);
  if (!data.name) {
    throw new Error("שם הסניף הוא שדה חובה");
  }
  await getAdminFirestore().collection("n_branches").add(stripUndefined(data));
  revalidateCoworking();
  redirect("/dashboard/coworking");
}

export async function updateCoworkingBranchAction(id: string, formData: FormData) {
  await requireOwner();
  const data = parseCoworkingBranchForm(formData);
  await getAdminFirestore().collection("n_branches").doc(id).set(stripUndefined(data), { merge: true });
  revalidateCoworking(id);
  redirect("/dashboard/coworking");
}

/**
 * מחיקה רכה בלבד, כמו בהשכרות: להוצאות, לתשלומים וללקוחות שכבר משויכים ל-`branchId`
 * הזה יש היסטוריה, ומסמך שנמחק באמת היה הופך אותה לשורות בלי שם.
 */
export async function deleteCoworkingBranchAction(id: string) {
  await requireOwner();
  await getAdminFirestore()
    .collection("n_branches")
    .doc(id)
    .set({ deleted: true, deletedAt: new Date().toISOString() }, { merge: true });
  revalidateCoworking(id);
  redirect("/dashboard/coworking");
}
