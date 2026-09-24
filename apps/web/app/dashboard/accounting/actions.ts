"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { chargeViaRoute } from "@/lib/collection-charge";
import { countsToMainFromForm } from "@/lib/counts-to-main";
import { resolveExpenseTypeIdFromForm } from "@/lib/recurring-purchases";
import { MAIN_FIXED_EXPENSES_COLLECTION } from "@/lib/main-fixed-expenses";
import { reviseFixedExpenseAmount, type RevisionResult } from "@/lib/fixed-expense-revision";
import type {
  AccountingIncome,
  AccountingExpense,
  AccountingFixedExpense,
  CollectionRoute,
} from "@ultranet/shared-types";

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
    if (v !== undefined && v !== "") {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}


function revalidateMain() {
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/rentals/accounting");
  // הכנסת מזומן נמשכת מקופה של חדר מחשבים, ומוצגת (לתצוגה בלבד) גם בדשבורד המעקב שלו -
  // אחרת היא הייתה מופיעה שם רק בטעינה הבאה שתעקוף את המטמון.
  revalidatePath("/dashboard/computer-rooms-accounting");
  revalidatePath("/dashboard/computer-rooms-accounting/[id]", "page");
  revalidatePath("/dashboard");
}

/**
 * הוספת הכנסה לספר הראשי — ארבעה סוגים, שדה אחד שמבדיל ביניהם.
 *
 * `type` הוא לא תווית תצוגה אלא מה שקובע איזה עוד שדה חייב להגיע: "cash" חייב קופה של
 * חדר מחשבים, "laptops" חייב סניף ניידים, "sale" מזמין את השאלה למי מכרת, ו-"credit"
 * לא צריך כלום מלבד תאריך וסכום. לכן הבדיקה כאן היא switch על `type` ולא רשימת שדות
 * אופציונליים - טופס שנשלח בלי הסניף שלו הוא טופס שבור, לא רשומה חסרה.
 */
export async function createIncomeAction(formData: FormData) {
  await requireOwner();
  const db = getAdminFirestore();
  const type = String(formData.get("type") ?? "credit") as AccountingIncome["type"];
  const date = String(formData.get("date") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!date || !amount) {
    throw new Error("תאריך וסכום הם שדות חובה");
  }

  let business: AccountingIncome["business"] = "general";
  let branchId: string | undefined;
  let soldTo: string | undefined;
  let desc = String(formData.get("desc") ?? "").trim();

  const branchName = async (id: string) =>
    ((await db.collection("n_branches").doc(id).get()).data() as { name?: string } | undefined)?.name ?? "";

  if (type === "laptops") {
    branchId = String(formData.get("branchId") ?? "").trim();
    if (!branchId) throw new Error("נא לבחור סניף ניידים");
    business = "rentals";
    if (!desc) desc = (await branchName(branchId)) || "הכנסת ניידים";
  } else if (type === "cash") {
    branchId = String(formData.get("branchId") ?? "").trim();
    if (!branchId) throw new Error("נא לבחור קופה (סניף חדר מחשבים)");
    business = "computers";
    if (!desc) {
      const name = await branchName(branchId);
      desc = `מזומן מקופה${name ? ` — ${name}` : ""}`;
    }
  } else if (type === "sale") {
    business = "computers";
    soldTo = String(formData.get("soldTo") ?? "").trim() || undefined;
    if (!desc) desc = soldTo ? `מכירת מחשבים — ${soldTo}` : "מכירת מחשבים";
  } else {
    business = "general";
    if (!desc) desc = "הכנסות אשראי";
  }

  const receiptIssued = formData.get("receiptIssued") === "on";

  const data: Omit<AccountingIncome, "id"> = stripUndefined({
    date,
    amount,
    desc,
    business,
    type,
    month: date.slice(0, 7),
    branchId,
    soldTo,
    ...(type === "laptops" ? { receiptIssued } : {}),
  });
  await db.collection("n_ah_income").add(data);
  revalidateMain();
}

export async function deleteIncomeAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_ah_income").doc(id).delete();
  revalidateMain();
}

/** סימון ידני "הוצאנו קבלה" על שורת הכנסת ניידים, בלי להפיק קבלה דרך המערכת. */
export async function setIncomeReceiptIssuedAction(id: string, issued: boolean) {
  await requireOwner();
  await getAdminFirestore().collection("n_ah_income").doc(id).set({ receiptIssued: issued }, { merge: true });
  revalidateMain();
}

/**
 * "הוצאות נוספות" — הוצאה של העסק עצמו, לא של סניף.
 *
 * נכתבת ל-`n_ah_expenses` עם `countsToMain: true` כברירת מחדל, כי זו כל הסיבה שהיא
 * נרשמה כאן ולא במסך ההוצאות של סניף כלשהו. `linkedBranchIds` הוא רשות ולא משנה
 * שקל: רכישה גדולה שתחולק בהמשך בין סניפים - כדי לזכור לאן היא הלכה פיזית, בלי
 * שהיא תתחיל להתחשבן מולם.
 */
export async function createExtraExpenseAction(formData: FormData) {
  await requireOwner();
  const date = String(formData.get("date") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!date || !amount) throw new Error("תאריך וסכום הם שדות חובה");
  const category = String(formData.get("category") ?? "").trim();
  const linkedBranchIds = formData.getAll("linkedBranchIds").map((v) => String(v)).filter(Boolean);

  const business = String(formData.get("business") ?? "general") as AccountingExpense["business"];
  // סימון "רכישה חוזרת" באותו שדה בדיוק כמו בהוצאה של סניף - זה מה שמחבר קנייה של
  // העסק עצמו לאותו מוצר שנקנה בסניף, בלי שום מודול באמצע.
  const expenseTypeId = await resolveExpenseTypeIdFromForm(formData, business);

  const data: Omit<AccountingExpense, "id"> = stripUndefined({
    date,
    amount,
    desc: String(formData.get("desc") ?? "").trim() || category || "הוצאה",
    business,
    month: date.slice(0, 7),
    countsToMain: countsToMainFromForm(formData),
    expenseTypeId,
    ...(category ? { category } : {}),
    ...(linkedBranchIds.length > 0 ? { linkedBranchIds } : {}),
  });
  await getAdminFirestore().collection("n_ah_expenses").add(data);
  revalidateMain();
}

export async function deleteExtraExpenseAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_ah_expenses").doc(id).delete();
  revalidateMain();
}

/**
 * הוצאה קבועה של העסק עצמו — אותו סכום כל חודש, מתאריך ההתחלה ועד שמפסיקים אותה.
 *
 * זו אחותה של ההוצאה הקבועה של סניף (`n_fixed_expenses`) בספר הראשי, ולכן היא נשמרת
 * כשורה אחת עם סכום חודשי ולא כרכישה חדשה בכל חודש: כך אפשר לראות אותה כשורה אחת,
 * להפסיק אותה ביום שהיא נגמרה, ולקבל את הצבירה שלה מחושבת ולא מוקלדת. הצ'קבוקס
 * "לחשבן בהנה"ח הראשית" נפתח מסומן — זו הוצאה של העסק, זה כל מה שהיא.
 */
export async function createMainFixedExpenseAction(formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const startDate = String(formData.get("startDate") ?? "").trim();
  if (!name || !amount || !startDate) {
    throw new Error("שם, סכום חודשי ותאריך התחלה הם שדות חובה");
  }
  const category = String(formData.get("category") ?? "").trim();
  const data: Omit<AccountingFixedExpense, "id"> = stripUndefined({
    name,
    amount,
    startDate,
    business: String(formData.get("business") ?? "general") as AccountingFixedExpense["business"],
    countsToMain: countsToMainFromForm(formData),
    createdAt: new Date().toISOString(),
    ...(category ? { category } : {}),
  });
  await getAdminFirestore().collection(MAIN_FIXED_EXPENSES_COLLECTION).add(data);
  revalidateMain();
}

/**
 * הפסקת הוצאה קבועה — `endDate` ולא מחיקה, כי החודשים שהיא כן הייתה פעילה בהם באמת
 * יצאו מהכיס וצריכים להישאר בספר. מחיקה היא לטעות הקלדה בלבד.
 */
export async function endMainFixedExpenseAction(id: string, formData: FormData) {
  await requireOwner();
  const ref = getAdminFirestore().collection(MAIN_FIXED_EXPENSES_COLLECTION).doc(id);
  if (!(await ref.get()).exists) throw new Error("ההוצאה לא נמצאה");
  const endDate = String(formData.get("endDate") ?? "").trim() || new Date().toISOString().slice(0, 10);
  await ref.set({ endDate }, { merge: true });
  revalidateMain();
}

export async function deleteMainFixedExpenseAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection(MAIN_FIXED_EXPENSES_COLLECTION).doc(id).delete();
  revalidateMain();
}

export async function createCollectionRouteAction(formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("שם המסלול הוא שדה חובה");
  }
  const data: Omit<CollectionRoute, "id"> = {
    terminalId: String(formData.get("terminalId") ?? "").trim(),
    status: "not_connected" as CollectionRoute["status"],
    name,
    branchScope: String(formData.get("branchScope") ?? "").trim() || null,
    provider: String(formData.get("provider") ?? "manual") as CollectionRoute["provider"],
    currency: String(formData.get("currency") ?? "ILS").trim() || undefined,
    feePct: formData.get("feePct") ? Number(formData.get("feePct")) : undefined,
    feeFixed: formData.get("feeFixed") ? Number(formData.get("feeFixed")) : undefined,
    depositsTo: String(formData.get("depositsTo") ?? "owner") as CollectionRoute["depositsTo"],
    apiKey: String(formData.get("apiKey") ?? "").trim() || undefined,
    apiSecret: String(formData.get("apiSecret") ?? "").trim() || undefined,
    receiptsProvider: (String(formData.get("receiptsProvider") ?? "none").trim() ||
      "none") as CollectionRoute["receiptsProvider"],
    receiptsCompanyId: String(formData.get("receiptsCompanyId") ?? "").trim() || undefined,
    receiptsApiKey: String(formData.get("receiptsApiKey") ?? "").trim() || undefined,
    receiptsApiSecret: String(formData.get("receiptsApiSecret") ?? "").trim() || undefined,
    defaultForNewCards: formData.get("defaultForNewCards") === "on",
  };
  await getAdminFirestore().collection("n_collection_routes").add(stripUndefined(data));
  revalidatePath("/dashboard/accounting/routes");
}

export async function updateCollectionRouteAction(id: string, formData: FormData) {
  await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("שם המסלול הוא שדה חובה");
  }

  const db = getAdminFirestore();
  const existingDoc = await db.collection("n_collection_routes").doc(id).get();
  const existing = existingDoc.data() as Omit<CollectionRoute, "id"> | undefined;
  if (!existing) {
    throw new Error("מסלול לא נמצא");
  }

  // secret fields: only overwrite if the admin typed a new value, otherwise keep what's stored
  // (the form leaves these blank on load instead of re-displaying the stored secret)
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const apiSecret = String(formData.get("apiSecret") ?? "").trim();
  const receiptsApiKey = String(formData.get("receiptsApiKey") ?? "").trim();
  const receiptsApiSecret = String(formData.get("receiptsApiSecret") ?? "").trim();

  const data: Omit<CollectionRoute, "id"> = {
    terminalId: String(formData.get("terminalId") ?? "").trim(),
    status: existing.status,
    name,
    branchScope: String(formData.get("branchScope") ?? "").trim() || null,
    provider: String(formData.get("provider") ?? "manual") as CollectionRoute["provider"],
    currency: String(formData.get("currency") ?? "ILS").trim() || undefined,
    feePct: formData.get("feePct") ? Number(formData.get("feePct")) : undefined,
    feeFixed: formData.get("feeFixed") ? Number(formData.get("feeFixed")) : undefined,
    depositsTo: String(formData.get("depositsTo") ?? "owner") as CollectionRoute["depositsTo"],
    apiKey: apiKey || existing.apiKey,
    apiSecret: apiSecret || existing.apiSecret,
    receiptsProvider: (String(formData.get("receiptsProvider") ?? "none").trim() ||
      "none") as CollectionRoute["receiptsProvider"],
    receiptsCompanyId: String(formData.get("receiptsCompanyId") ?? "").trim() || undefined,
    receiptsApiKey: receiptsApiKey || existing.receiptsApiKey,
    receiptsApiSecret: receiptsApiSecret || existing.receiptsApiSecret,
    defaultForNewCards: formData.get("defaultForNewCards") === "on",
  };
  await db.collection("n_collection_routes").doc(id).set(stripUndefined(data), { merge: false });
  revalidatePath("/dashboard/accounting/routes");
  redirect("/dashboard/accounting/routes");
}

export async function deleteCollectionRouteAction(id: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_collection_routes").doc(id).delete();
  revalidatePath("/dashboard/accounting/routes");
}

export async function manualChargeAction(formData: FormData) {
  await requireOwner();
  const routeId = String(formData.get("routeId") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const desc = String(formData.get("desc") ?? "").trim() || "גביה ידנית";
  const business = String(formData.get("business") ?? "general") as AccountingIncome["business"];
  const date = String(formData.get("date") ?? "").trim() || new Date().toISOString().slice(0, 10);
  if (!routeId || !amount) {
    throw new Error("נא לבחור מסלול גביה ולהזין סכום");
  }
  const result = await chargeViaRoute({ routeId, amount, desc, business, date });
  if (!result.ok) {
    throw new Error(result.message);
  }
  revalidateMain();
}

/** "עדכון מחיר" של הוצאה קבועה של העסק — מ-`fromMonth` והלאה, העבר לא משתנה. */
export async function reviseMainFixedExpenseAction(
  id: string,
  fromMonth: string,
  newAmount: number,
): Promise<RevisionResult> {
  await requireOwner();
  const result = await reviseFixedExpenseAmount({
    collection: MAIN_FIXED_EXPENSES_COLLECTION as "n_ah_fixed_expenses",
    id,
    fromMonth,
    newAmount,
  });
  revalidateMain();
  return result;
}
