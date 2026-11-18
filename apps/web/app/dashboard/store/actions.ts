"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { currentModuleScope, requireOwner } from "@/lib/perms";
import { DEFAULT_STORE_PROCEDURES } from "@/lib/store-default-procedures";
import { draftMarketPrice, storeAiConfigured, type MarketDraft } from "@/lib/store-ai";
import { applyUsageDefaults, sanitizeSpec, type UsageKey } from "@/lib/store-wizard";
import type { StoreAccessoryQuote, StoreRequest, StoreRequestMode, StoreRequestOption, StoreRequestStatus, StoreSpec } from "@ultranet/shared-types";

const COLLECTION = "n_store_requests";
const STATUSES: StoreRequestStatus[] = ["new", "in_review", "answered", "stock_check", "stock_confirmed", "deal_closed", "shipped", "delivered", "closed", "no_stock"];

export interface CreateStoreRequestInput {
  branchId: string;
  mode: StoreRequestMode;
  customerName: string;
  customerPhone?: string;
  budgetILS?: number;
  spec: Partial<StoreSpec>;
  /** שדות שהלקוח קבע בוודאות (במצב "לפי רצון הלקוח": כל שדה שמולא) */
  lockedFields: string[];
  /** רק באשף השאלות: סוג השימוש שנבחר, ממנו משלימים שדות שהלקוח לא קבע */
  usage?: UsageKey;
  answers: { question: string; answer: string }[];
  notes?: string;
}

const LOCKABLE: (keyof StoreSpec)[] = ["cpu", "ramGb", "storageGb", "screenInches", "touch", "minGeneration", "extras"];

export async function createStoreRequestAction(input: CreateStoreRequestInput): Promise<{ id: string }> {
  const scope = await currentModuleScope("store");
  if (!scope?.granted) throw new Error("אין הרשאה לחנות סניפים");
  if (!input.branchId || !scope.allows(input.branchId)) throw new Error("אין הרשאה לסניף הזה");

  const customerName = input.customerName.trim().slice(0, 80);
  if (!customerName) throw new Error("חובה להזין שם לקוח");

  const mode: StoreRequestMode = input.mode === "guided" ? "guided" : "spec";
  const locked = input.lockedFields.filter((f): f is keyof StoreSpec => (LOCKABLE as string[]).includes(f));
  let spec = sanitizeSpec(input.spec);
  if (mode === "guided" && (input.usage === "basic" || input.usage === "office" || input.usage === "heavy")) {
    spec = applyUsageDefaults(spec, input.usage, locked);
  }

  const db = getAdminFirestore();
  const branch = await db.collection("n_branches").doc(input.branchId).get();
  if (!branch.exists) throw new Error("הסניף לא נמצא");

  const session = await getServerSession(authOptions);
  const now = new Date().toISOString();
  const phone = input.customerPhone?.trim().replace(/[^\d+\-\s]/g, "").slice(0, 20);
  const budget = typeof input.budgetILS === "number" && input.budgetILS > 0 ? Math.round(input.budgetILS) : undefined;

  const doc: Omit<StoreRequest, "id"> = {
    createdAt: now,
    updatedAt: now,
    createdByEmail: session?.user?.email ?? "",
    createdByName: session?.user?.name ?? "",
    branchId: input.branchId,
    branchName: String((branch.data() as { name?: string }).name ?? ""),
    mode,
    customerName,
    ...(phone ? { customerPhone: phone } : {}),
    ...(budget ? { budgetILS: budget } : {}),
    spec,
    lockedFields: locked,
    answers: input.answers.slice(0, 30).map((a) => ({ question: String(a.question).slice(0, 200), answer: String(a.answer).slice(0, 300) })),
    ...(input.notes?.trim() ? { notes: input.notes.trim().slice(0, 1000) } : {}),
    status: "new",
  };
  const ref = await db.collection(COLLECTION).add(doc);
  revalidatePath("/dashboard/store/requests");
  return { id: ref.id };
}

/** תשובת הבעלים/המזכירה: אפשרויות עם טווח מחיר. רק בעלים. */
export async function respondStoreRequestAction(id: string, formData: FormData): Promise<void> {
  const session = await requireOwner();
  const db = getAdminFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("הבקשה לא נמצאה");

  const num = (key: string): number | undefined => {
    const v = Number(String(formData.get(key) ?? "").replace(/[^\d.]/g, ""));
    return Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;
  };

  const options: StoreRequestOption[] = [];
  for (const prefix of ["opt0", "opt1", "opt2"]) {
    const label = String(formData.get(`${prefix}_label`) ?? "").trim();
    const specText = String(formData.get(`${prefix}_spec`) ?? "").trim();
    if (!label && !specText) continue;
    const marketLowILS = num(`${prefix}_low`);
    const quotedFromILS = num(`${prefix}_from`);
    const quotedToILS = num(`${prefix}_to`);
    const whyBetter = String(formData.get(`${prefix}_why`) ?? "").trim();
    options.push({
      label: label || "אפשרות",
      kind: prefix === "opt0" ? "as_requested" : "upgrade",
      specText,
      ...(whyBetter ? { whyBetter: whyBetter.slice(0, 800) } : {}),
      ...(marketLowILS ? { marketLowILS } : {}),
      ...(quotedFromILS ? { quotedFromILS } : {}),
      ...(quotedToILS ? { quotedToILS } : {}),
    });
  }
  if (!options.length) throw new Error("יש להזין לפחות אפשרות אחת");

  const accessories: StoreAccessoryQuote[] = [];
  for (let i = 0; i < 4; i++) {
    const name = String(formData.get(`acc${i}_name`) ?? "").trim();
    if (!name) continue;
    const marketLowILS = num(`acc${i}_low`);
    const quotedFromILS = num(`acc${i}_from`);
    const quotedToILS = num(`acc${i}_to`);
    accessories.push({
      name: name.slice(0, 60),
      ...(marketLowILS ? { marketLowILS } : {}),
      ...(quotedFromILS ? { quotedFromILS } : {}),
      ...(quotedToILS ? { quotedToILS } : {}),
    });
  }

  const now = new Date().toISOString();
  await ref.update({
    options,
    accessories,
    responseNote: String(formData.get("responseNote") ?? "").trim().slice(0, 1000),
    status: "answered" satisfies StoreRequestStatus,
    respondedAt: now,
    respondedBy: session.user?.name ?? session.user?.email ?? "",
    updatedAt: now,
  } satisfies Partial<StoreRequest>);
  revalidatePath("/dashboard/store/requests");
  revalidatePath(`/dashboard/store/requests/${id}`);
}

export async function setStoreRequestStatusAction(id: string, status: StoreRequestStatus): Promise<void> {
  await requireOwner();
  if (!STATUSES.includes(status)) throw new Error("סטטוס לא תקין");
  await getAdminFirestore().collection(COLLECTION).doc(id).update({ status, updatedAt: new Date().toISOString() });
  revalidatePath("/dashboard/store/requests");
  revalidatePath(`/dashboard/store/requests/${id}`);
}

// ---------------------------------------------------------------------------
// שלב ב': מהצעה לעסקה - בדיקת מלאי, סגירה, משלוח וקבלה
// ---------------------------------------------------------------------------

/** טוען בקשה ומוודא שהמשתמש רשאי לגעת בה בתור הסניף שלה (או בעלים). */
async function loadForBranch(id: string) {
  const scope = await currentModuleScope("store");
  if (!scope?.granted) throw new Error("אין הרשאה לחנות סניפים");
  const ref = getAdminFirestore().collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("הבקשה לא נמצאה");
  const request = { ...(snap.data() as Omit<StoreRequest, "id">), id } as StoreRequest;
  if (!scope.isOwner && !scope.allows(request.branchId)) throw new Error("אין הרשאה לסניף הזה");
  return { ref, request };
}

function revalidateRequest(id: string) {
  revalidatePath("/dashboard/store/requests");
  revalidatePath(`/dashboard/store/requests/${id}`);
}

/** הלקוח אישר אפשרות - הסניף מבקש בדיקת מלאי. עובר לטיפול של הבעלים/המזכירה. */
export async function requestStockCheckAction(id: string, optionIndex: number): Promise<void> {
  const { ref, request } = await loadForBranch(id);
  if (request.status !== "answered") throw new Error("אפשר לבקש בדיקת מלאי רק אחרי שהתקבלה הצעה");
  if (!request.options?.[optionIndex]) throw new Error("האפשרות לא נמצאה");
  const now = new Date().toISOString();
  await ref.update({ status: "stock_check", chosenOptionIndex: optionIndex, stockCheckAt: now, updatedAt: now });
  revalidateRequest(id);
}

/** הבעלים מאשר מלאי ומחיר סופי. */
export async function confirmStockAction(id: string, formData: FormData): Promise<void> {
  await requireOwner();
  const price = Number(String(formData.get("finalPriceILS") ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(price) || price <= 0) throw new Error("יש להזין מחיר סופי");
  const now = new Date().toISOString();
  await getAdminFirestore().collection(COLLECTION).doc(id).update({
    status: "stock_confirmed" satisfies StoreRequestStatus,
    finalPriceILS: Math.round(price),
    stockNote: String(formData.get("stockNote") ?? "").trim().slice(0, 500),
    stockConfirmedAt: now,
    updatedAt: now,
  });
  revalidateRequest(id);
}

export async function noStockAction(id: string, formData: FormData): Promise<void> {
  await requireOwner();
  const now = new Date().toISOString();
  await getAdminFirestore().collection(COLLECTION).doc(id).update({
    status: "no_stock" satisfies StoreRequestStatus,
    stockNote: String(formData.get("stockNote") ?? "").trim().slice(0, 500),
    updatedAt: now,
  });
  revalidateRequest(id);
}

/** הסניף סגר את העסקה עם הלקוח במחיר הסופי. */
export async function closeDealAction(id: string): Promise<void> {
  const { ref, request } = await loadForBranch(id);
  if (request.status !== "stock_confirmed") throw new Error("אפשר לסגור עסקה רק אחרי אישור מלאי");
  const now = new Date().toISOString();
  await ref.update({ status: "deal_closed", dealClosedAt: now, updatedAt: now });
  revalidateRequest(id);
}

/** הבעלים מוציא משלוח (בדרך כלל באותו יום). */
export async function markShippedAction(id: string, formData: FormData): Promise<void> {
  await requireOwner();
  const now = new Date().toISOString();
  await getAdminFirestore().collection(COLLECTION).doc(id).update({
    status: "shipped" satisfies StoreRequestStatus,
    shippedAt: now,
    shippingNote: String(formData.get("shippingNote") ?? "").trim().slice(0, 300),
    updatedAt: now,
  });
  revalidateRequest(id);
}

/** המחשב הגיע לסניף. */
export async function markDeliveredAction(id: string): Promise<void> {
  const { ref, request } = await loadForBranch(id);
  if (request.status !== "shipped") throw new Error("המשלוח עדיין לא יצא");
  const now = new Date().toISOString();
  await ref.update({ status: "delivered", deliveredAt: now, updatedAt: now });
  revalidateRequest(id);
}

/** טיוטת סקירת שוק אוטומטית (Haiku, זול). בעלים בלבד; דורש ANTHROPIC_API_KEY. */
export async function aiMarketDraftAction(id: string): Promise<MarketDraft> {
  await requireOwner();
  if (!storeAiConfigured()) throw new Error("ההכנה האוטומטית לא מופעלת (חסר ANTHROPIC_API_KEY)");
  const snap = await getAdminFirestore().collection(COLLECTION).doc(id).get();
  if (!snap.exists) throw new Error("הבקשה לא נמצאה");
  return draftMarketPrice({ ...(snap.data() as Omit<StoreRequest, "id">), id } as StoreRequest);
}

/** טעינה חד-פעמית של נהלי ברירת המחדל לחנות. לא דורסת נוהל קיים (מזהים קבועים). בעלים בלבד. */
export async function seedStoreProceduresAction(): Promise<{ created: number }> {
  const session = await requireOwner();
  const db = getAdminFirestore();
  const now = Date.now();
  const by = session.user?.name ?? session.user?.email ?? "";
  let created = 0;
  for (const [index, p] of DEFAULT_STORE_PROCEDURES.entries()) {
    const ref = db.collection("n_procedures").doc(p.id);
    if ((await ref.get()).exists) continue;
    await ref.set({
      title: p.title,
      content: p.content,
      category: p.category,
      summary: p.summary,
      version: "1",
      status: "active",
      ownerName: by,
      supersedesId: null,
      attachmentName: "",
      attachmentDataUrl: "",
      order: index,
      createdAt: now,
      updatedAt: now,
      createdBy: by,
      updatedBy: by,
      audience: { mode: "store" },
    });
    created++;
  }
  revalidatePath("/dashboard/store");
  return { created };
}
