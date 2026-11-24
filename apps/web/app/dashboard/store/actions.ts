"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { currentModuleScope, requireOwner } from "@/lib/perms";
import { COMMISSION_CATEGORIES, COMMISSION_RULES_COLLECTION, currentIsraelMonth, loadCommissionRules } from "@/lib/store-commission-data";
import { computeDealCommission } from "@/lib/store-commission";
import { anthropicConfigured, createAnthropic, describeKey } from "@/lib/anthropic-client";
import { advisorChat, type AdvisorReply, type AdvisorTurn, type ChatOption } from "@/lib/store-advisor";
import { loadPriceGuide, PRICE_GUIDE_DOC } from "@/lib/store-price-guide";
import { estimateMany } from "@/lib/store-market";
import { notifyBranch, notifyOwnerNewRequest, notifyOwnerStockCheck } from "@/lib/store-notify";
import type { PriceEstimate } from "@/lib/store-price-guide";
import { FAQ_COLLECTION } from "@/lib/store-faq";
import { DEFAULT_GLOSSARY, GLOSSARY_COLLECTION } from "@/lib/store-glossary";
import { DEFAULT_STORE_PROCEDURES } from "@/lib/store-default-procedures";
import { draftMarketPrice, draftPriceGuide, storeAiConfigured, type MarketDraft } from "@/lib/store-ai";
import { applyUsageDefaults, sanitizeSpec, specToText, type UsageKey } from "@/lib/store-wizard";
import type { StoreAccessoryQuote, StoreCollection, StoreCommissionCategory, StoreRequest, StoreRequestMode, StoreRequestOption, StoreRequestStatus, StoreSpec } from "@ultranet/shared-types";

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
  await notifyOwnerNewRequest({ ...doc, id: ref.id } as StoreRequest);
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
  await notifyOwnerStockCheck({ ...request, status: "stock_check", chosenOptionIndex: optionIndex, id });
  revalidateRequest(id);
}

/** הבעלים מאשר מלאי ומחיר סופי. */
export async function confirmStockAction(id: string, formData: FormData): Promise<void> {
  await requireOwner();
  const price = Number(String(formData.get("finalPriceILS") ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(price) || price <= 0) throw new Error("יש להזין מחיר סופי");
  const commRaw = String(formData.get("commissionOverrideILS") ?? "").trim();
  const commOverride = commRaw === "" ? undefined : Math.round(Number(commRaw.replace(/[^\d.]/g, "")));
  if (commOverride !== undefined && !Number.isFinite(commOverride)) throw new Error("סכום עמלה לא תקין");
  const accRaw = Number(String(formData.get("accessoriesFinalILS") ?? "").replace(/[^\d.]/g, ""));
  const accFinal = Number.isFinite(accRaw) && accRaw > 0 ? Math.round(accRaw) : 0;
  const now = new Date().toISOString();
  const ref = getAdminFirestore().collection(COLLECTION).doc(id);
  const before = (await ref.get()).data() as Omit<StoreRequest, "id"> | undefined;
  await ref.update({
    status: "stock_confirmed" satisfies StoreRequestStatus,
    finalPriceILS: Math.round(price),
    ...(accFinal ? { accessoriesFinalILS: accFinal } : {}),
    ...(commOverride !== undefined ? { commissionOverrideILS: commOverride } : {}),
    stockNote: String(formData.get("stockNote") ?? "").trim().slice(0, 500),
    stockConfirmedAt: now,
    updatedAt: now,
  });
  if (before) await notifyBranch({ ...before, id }, "יש מלאי - אפשר לסגור עסקה", `המחיר הסופי ללקוח: ${(Math.round(price) + accFinal).toLocaleString("he-IL")} ₪. היכנסו למערכת וסגרו את העסקה.`);
  revalidateRequest(id);
}

export async function noStockAction(id: string, formData: FormData): Promise<void> {
  await requireOwner();
  const now = new Date().toISOString();
  const ref = getAdminFirestore().collection(COLLECTION).doc(id);
  const before = (await ref.get()).data() as Omit<StoreRequest, "id"> | undefined;
  const note = String(formData.get("stockNote") ?? "").trim().slice(0, 500);
  await ref.update({ status: "no_stock" satisfies StoreRequestStatus, stockNote: note, updatedAt: now });
  if (before) await notifyBranch({ ...before, id }, "אין מלאי כרגע", note || "נחזור אליכם עם חלופה.");
  revalidateRequest(id);
}

export interface CloseDealInput {
  /** מי גובה: הסניף (זכאי לעמלה, והסכום נכנס להתחשבנות מול הבעלים) או הבעלים ישירות */
  collectedBy: "branch" | "owner";
  method?: "cash" | "card" | "transfer";
}

/**
 * הסניף סגר את העסקה עם הלקוח במחיר הסופי, ובוחר מי גובה.
 *
 * `branch`: הסכום (מחיר סופי למחשב + לציוד) נכנס להתחשבנות החודשית של הסניף, והעמלה לפי כללי הבעלים
 * מופחתת ממנה אוטומטית. `owner`: אין עמלה ואין שינוי בהתחשבנות של הסניף.
 */
export async function closeDealAction(id: string, input: CloseDealInput): Promise<void> {
  const { ref, request } = await loadForBranch(id);
  if (request.status !== "stock_confirmed") throw new Error("אפשר לסגור עסקה רק אחרי אישור מלאי");
  if (input.collectedBy !== "branch" && input.collectedBy !== "owner") throw new Error("יש לבחור מי גובה");
  const total = (request.finalPriceILS ?? 0) + (request.accessoriesFinalILS ?? 0);
  if (!(total > 0)) throw new Error("אין מחיר סופי לעסקה");
  const now = new Date().toISOString();
  const collection: StoreCollection = {
    by: input.collectedBy,
    ...(input.collectedBy === "branch" && input.method ? { method: input.method } : {}),
    amountILS: total,
    at: now,
    month: currentIsraelMonth(),
  };
  const commissionILS = input.collectedBy === "branch" ? computeDealCommission(request, await loadCommissionRules()) : 0;
  await ref.update({ status: "deal_closed", dealClosedAt: now, collection, commissionILS, updatedAt: now });
  revalidateRequest(id);
  revalidatePath("/dashboard/store/commissions");
}

/** הבעלים מתקן עמלה של עסקה (למשל הסכמה חריגה). עסקה שנגבתה ע"י הסניף בלבד. */
export async function adjustCommissionAction(id: string, formData: FormData): Promise<void> {
  await requireOwner();
  const ref = getAdminFirestore().collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("הבקשה לא נמצאה");
  const request = snap.data() as StoreRequest;
  if (request.collection?.by !== "branch") throw new Error("עמלה רלוונטית רק לעסקה שהסניף גבה");
  const amount = Number(String(formData.get("commissionILS") ?? "").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount < 0) throw new Error("סכום עמלה לא תקין");
  await ref.update({
    commissionILS: Math.round(amount),
    commissionNote: String(formData.get("commissionNote") ?? "").trim().slice(0, 200),
    updatedAt: new Date().toISOString(),
  });
  revalidateRequest(id);
  revalidatePath("/dashboard/store/commissions");
}

/** שמירת כללי העמלה (סכום קבוע או אחוז) לכל קטגוריה. ערך ריק/0 = אין עמלה לקטגוריה. */
export async function saveCommissionRulesAction(formData: FormData): Promise<void> {
  await requireOwner();
  const db = getAdminFirestore();
  for (const category of COMMISSION_CATEGORIES) {
    const kind = formData.get(`${category}_kind`) === "percent" ? "percent" : "fixed";
    const value = Number(String(formData.get(`${category}_value`) ?? "").replace(/[^\d.]/g, ""));
    const ref = db.collection(COMMISSION_RULES_COLLECTION).doc(category satisfies StoreCommissionCategory);
    // ריק או 0 = בכוונה בלי עמלה לקטגוריה (כלל שמור עם ערך 0); מחיקת כלל לא מתבצעת כדי לא לחזור לברירת המחדל בטעות.
    if (!Number.isFinite(value) || value <= 0) {
      await ref.set({ kind, value: 0 });
      continue;
    }
    if (kind === "percent" && value > 100) throw new Error("אחוז עמלה לא יכול לעבור 100");
    await ref.set({ kind, value });
  }
  revalidatePath("/dashboard/store/commissions");
}

/** הבעלים מוציא משלוח (בדרך כלל באותו יום). */
export async function markShippedAction(id: string, formData: FormData): Promise<void> {
  await requireOwner();
  const now = new Date().toISOString();
  const ref = getAdminFirestore().collection(COLLECTION).doc(id);
  const before = (await ref.get()).data() as Omit<StoreRequest, "id"> | undefined;
  const note = String(formData.get("shippingNote") ?? "").trim().slice(0, 300);
  await ref.update({ status: "shipped" satisfies StoreRequestStatus, shippedAt: now, shippingNote: note, updatedAt: now });
  if (before) await notifyBranch({ ...before, id }, "המחשב נשלח לסניף", note || "יגיע בעוד כמה ימים.");
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

/** תור אחד בצ'אט היועץ. פתוח לכל מי שיש לו הרשאת חנות סניפים; עלות מוגבלת ושאלות חוזרות נענות בלי מודל. */
export async function advisorChatAction(history: AdvisorTurn[]): Promise<AdvisorReply> {
  const scope = await currentModuleScope("store");
  if (!scope?.granted) throw new Error("אין הרשאה לחנות סניפים");
  const clean = (Array.isArray(history) ? history : [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .map((t) => ({ role: t.role, content: t.content }));
  return advisorChat(clean);
}

/**
 * מחיר שוק חי לאפשרויות שהוצגו בצ'אט (נקרא מהדפדפן אחרי שהתשובה כבר הוצגה, כדי שהצ'אט לא יחכה לחיפוש).
 * מאגר יומי: מפרט שכבר נבדק היום לא נבדק שוב. פתוח לכל מי שיש לו הרשאת חנות.
 */
export async function priceOptionsAction(specs: Partial<StoreSpec>[]): Promise<{ estimate: PriceEstimate | null; source: "market" | "guide" | "none" }[]> {
  const scope = await currentModuleScope("store");
  if (!scope?.granted) throw new Error("אין הרשאה לחנות סניפים");
  const clean = (Array.isArray(specs) ? specs : []).slice(0, 3).map((x) => sanitizeSpec(x));
  if (!clean.length) return [];
  return estimateMany(clean, await loadPriceGuide(), { allowLookup: true });
}

export interface CreateChatRequestInput {
  branchId: string;
  customerName: string;
  customerPhone?: string;
  transcript: AdvisorTurn[];
  /** האפשרויות שהוצגו בצ'אט - נבנות מחדש בשרת (המחירים מחושבים כאן, לא נלקחים מהדפדפן) */
  options: Pick<ChatOption, "label" | "kind" | "spec" | "whyBetter" | "pros" | "cons">[];
  /** האפשרות שהלקוח אישר. חסר = שמירה בלי אישור */
  chosenIndex?: number | null;
  lockedFields: string[];
  budgetILS?: number | null;
  notes?: string;
}

/**
 * יצירת בקשה מצ'אט היועץ. ההצעות (לפי המחירון) נשמרות כתשובה אוטומטית (`status: answered`), ואם הלקוח אישר
 * אפשרות - הבקשה עוברת ישר לבדיקת מלאי (`stock_check`). הבעלים רשאי לעדכן הכול בטופס המענה.
 */
/** משפט ההסבר + יתרונות/חסרונות, כטקסט אחד שנשמר על ההצעה. */
function whyText(o: { whyBetter?: string; pros?: string[]; cons?: string[] }): string {
  const pros = (o.pros ?? []).map((x) => String(x).slice(0, 90)).slice(0, 3);
  const cons = (o.cons ?? []).map((x) => String(x).slice(0, 90)).slice(0, 2);
  return [String(o.whyBetter ?? "").slice(0, 300), pros.length ? `יתרונות: ${pros.join(", ")}` : "", cons.length ? `חסרונות: ${cons.join(", ")}` : ""]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 800);
}

export async function createChatRequestAction(input: CreateChatRequestInput): Promise<{ id: string }> {
  const scope = await currentModuleScope("store");
  if (!scope?.granted) throw new Error("אין הרשאה לחנות סניפים");
  if (!input.branchId || !scope.allows(input.branchId)) throw new Error("אין הרשאה לסניף הזה");
  const customerName = input.customerName.trim().slice(0, 80);
  if (!customerName) throw new Error("חובה להזין שם לקוח");
  if (!Array.isArray(input.options) || input.options.length === 0) throw new Error("אין אפשרויות לשמירה - המשיכו את השיחה עד שהיועץ מציע");

  const db = getAdminFirestore();
  const branch = await db.collection("n_branches").doc(input.branchId).get();
  if (!branch.exists) throw new Error("הסניף לא נמצא");
  // המחיר כבר הוצג בצ'אט ונשמר במאגר היומי - כאן רק קוראים אותו (בלי חיפוש חדש ובלי עלות)
  const estimates = await estimateMany(input.options.slice(0, 3).map((o) => sanitizeSpec(o.spec)), await loadPriceGuide(), { allowLookup: false });

  const chosenIdx = typeof input.chosenIndex === "number" && input.options[input.chosenIndex] ? input.chosenIndex : null;
  const options: StoreRequestOption[] = [];
  let chosenAccessories: StoreAccessoryQuote[] = [];
  let spec: StoreSpec = sanitizeSpec(input.options[0]!.spec);
  input.options.slice(0, 3).forEach((o, i) => {
    const optSpec = sanitizeSpec(o.spec);
    const est = estimates[i]?.estimate ?? null;
    if (i === (chosenIdx ?? 0)) {
      spec = optSpec;
      chosenAccessories = (est?.accessories ?? []).map((a) => ({ name: a.name, quotedFromILS: a.fromILS, quotedToILS: a.toILS }));
    }
    options.push({
      label: String(o.label ?? "").slice(0, 60) || "אפשרות",
      kind: o.kind === "upgrade" ? "upgrade" : "as_requested",
      source: "ai",
      specText: specToText(optSpec),
      ...(whyText(o) ? { whyBetter: whyText(o) } : {}),
      ...(est ? { quotedFromILS: est.fromILS, quotedToILS: est.toILS } : {}),
      ...(est?.accessories.length ? { accessoriesText: est.accessories.map((a) => `${a.name} ${a.fromILS}-${a.toILS}`).join(" · ") } : {}),
    });
  });
  const chosen = chosenIdx;

  const { getServerSession } = await import("next-auth");
  const { authOptions } = await import("@/lib/auth");
  const session = await getServerSession(authOptions);
  const now = new Date().toISOString();
  const phone = input.customerPhone?.trim().replace(/[^\d+\-\s]/g, "").slice(0, 20);
  const budget = typeof input.budgetILS === "number" && input.budgetILS > 0 ? Math.round(input.budgetILS) : undefined;
  const transcript = (Array.isArray(input.transcript) ? input.transcript : []).slice(-40);

  const doc: Omit<StoreRequest, "id"> = {
    createdAt: now,
    updatedAt: now,
    createdByEmail: session?.user?.email ?? "",
    createdByName: session?.user?.name ?? "",
    branchId: input.branchId,
    branchName: String((branch.data() as { name?: string }).name ?? ""),
    mode: "guided",
    createdVia: "chat",
    customerName,
    ...(phone ? { customerPhone: phone } : {}),
    ...(budget ? { budgetILS: budget } : {}),
    spec,
    lockedFields: input.lockedFields.filter((f): f is keyof StoreSpec => (LOCKABLE as string[]).includes(f)),
    answers: transcript
      .map((t, i) => (t.role === "user" ? { question: String(transcript[i - 1]?.content ?? "פתיחה").slice(0, 200), answer: String(t.content).slice(0, 300) } : null))
      .filter((a): a is { question: string; answer: string } => a !== null)
      .slice(0, 30),
    ...(input.notes?.trim() ? { notes: input.notes.trim().slice(0, 1000) } : {}),
    status: chosen !== null ? "stock_check" : "answered",
    options,
    ...(chosenAccessories.length ? { accessories: chosenAccessories } : {}),
    respondedAt: now,
    respondedBy: "יועץ אוטומטי",
    ...(chosen !== null ? { chosenOptionIndex: chosen, stockCheckAt: now } : {}),
  };
  const ref = await db.collection(COLLECTION).add(doc);
  if (chosen !== null) await notifyOwnerStockCheck({ ...doc, id: ref.id } as StoreRequest);
  revalidatePath("/dashboard/store/requests");
  return { id: ref.id };
}

// ---------------------------------------------------------------------------
// מחירון שוק פנימי (בעלים בלבד)
// ---------------------------------------------------------------------------

function numField(formData: FormData, key: string): number | undefined {
  const v = Number(String(formData.get(key) ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(v) && v > 0 ? Math.round(v) : undefined;
}

export async function savePriceGuideAction(formData: FormData): Promise<void> {
  await requireOwner();
  const pick = (keys: string[], prefix: string) =>
    Object.fromEntries(keys.map((k) => [k, numField(formData, `${prefix}_${k}`)]).filter(([, v]) => v !== undefined)) as Record<string, number>;
  const guide = {
    laptopBase: pick(["i3", "i5", "i7"], "lb"),
    desktopBase: pick(["i3", "i5", "i7"], "db"),
    ramAdd: pick(["16", "32"], "ram"),
    storageAdd: pick(["512", "1000", "2000"], "st"),
    accessoriesLow: pick(["monitor", "keyboardMouse", "keyboard", "mouse", "stick", "speakers"], "acc"),
    ...(numField(formData, "touch") ? { touchAdd: numField(formData, "touch") } : {}),
    ...(numField(formData, "s17") ? { screen17Add: numField(formData, "s17") } : {}),
    note: String(formData.get("note") ?? "").trim().slice(0, 300),
    updatedAt: new Date().toISOString(),
  };
  await getAdminFirestore().collection(PRICE_GUIDE_DOC.collection).doc(PRICE_GUIDE_DOC.id).set(guide);
  revalidatePath("/dashboard/store/prices");
}

/** רענון המחירון באמצעות Haiku + חיפוש ברשת. מחזיר **טיוטה** בלבד - הבעלים בודק ושומר. עלות: כמה סנטים. */
export async function refreshPriceGuideDraftAction() {
  await requireOwner();
  if (!storeAiConfigured()) throw new Error("ההכנה האוטומטית לא מופעלת (חסר ANTHROPIC_API_KEY)");
  return draftPriceGuide();
}

// ---------------------------------------------------------------------------
// שאלות נפוצות (בעלים בלבד)
// ---------------------------------------------------------------------------

export async function saveFaqAction(formData: FormData): Promise<void> {
  await requireOwner();
  const question = String(formData.get("question") ?? "").trim().slice(0, 200);
  const answer = String(formData.get("answer") ?? "").trim().slice(0, 800);
  if (!question || !answer) throw new Error("חובה למלא שאלה ותשובה");
  const keywords = String(formData.get("keywords") ?? "").split(/[,\n]/).map((k) => k.trim()).filter(Boolean).slice(0, 10);
  const id = String(formData.get("id") ?? "").trim();
  const col = getAdminFirestore().collection(FAQ_COLLECTION);
  if (id) await col.doc(id).set({ question, answer, keywords, approved: formData.get("approved") !== "off" }, { merge: true });
  else await col.add({ question, answer, keywords, approved: true, source: "owner", hits: 0, createdAt: new Date().toISOString() });
  revalidatePath("/dashboard/store/faq");
}

export async function approveFaqAction(id: string): Promise<void> {
  await requireOwner();
  await getAdminFirestore().collection(FAQ_COLLECTION).doc(id).update({ approved: true });
  revalidatePath("/dashboard/store/faq");
}

export async function deleteFaqAction(id: string): Promise<void> {
  await requireOwner();
  await getAdminFirestore().collection(FAQ_COLLECTION).doc(id).delete();
  revalidatePath("/dashboard/store/faq");
}

// ---------------------------------------------------------------------------
// מושגי היועץ (בעלים בלבד)
// ---------------------------------------------------------------------------

export async function saveGlossaryTermAction(formData: FormData): Promise<void> {
  await requireOwner();
  const term = String(formData.get("term") ?? "").trim().slice(0, 80);
  const guidance = String(formData.get("guidance") ?? "").trim().slice(0, 800);
  if (!term || !guidance) throw new Error("חובה למלא מושג והנחיה");
  const id = String(formData.get("id") ?? "").trim();
  const col = getAdminFirestore().collection(GLOSSARY_COLLECTION);
  const data = { term, guidance, active: formData.get("active") !== "off" };
  if (id) await col.doc(id).set(data, { merge: true });
  else await col.add(data);
  revalidatePath("/dashboard/store/glossary");
}

export async function deleteGlossaryTermAction(id: string): Promise<void> {
  await requireOwner();
  await getAdminFirestore().collection(GLOSSARY_COLLECTION).doc(id).delete();
  revalidatePath("/dashboard/store/glossary");
}

/** העתקת מושגי ברירת המחדל למסד, כדי שיהיה אפשר לערוך אותם. רק כשאין מושגים. */
export async function seedGlossaryAction(): Promise<void> {
  await requireOwner();
  const col = getAdminFirestore().collection(GLOSSARY_COLLECTION);
  if (!(await col.limit(1).get()).empty) return;
  for (const t of DEFAULT_GLOSSARY) await col.add({ ...t, active: true });
  revalidatePath("/dashboard/store/glossary");
}

/** בדיקת חיבור ל-API: קריאה מינימלית אחת ל-Haiku (עלות זניחה). בעלים בלבד. */
export async function testAiConnectionAction(): Promise<{ ok: boolean; message: string }> {
  await requireOwner();
  if (!anthropicConfigured()) return { ok: false, message: "ANTHROPIC_API_KEY לא מוגדר בשרת (ב-Vercel, ואחרי הגדרה צריך Redeploy)" };
  try {
    const res = await createAnthropic().messages.create({
      model: "claude-haiku-5-5",
      max_tokens: 16,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: "ענה במילה אחת: שלום" }],
    });
    return { ok: true, message: `החיבור תקין (${res.usage.input_tokens + res.usage.output_tokens} טוקנים)` };
  } catch (e) {
    return { ok: false, message: `${e instanceof Error ? e.message : "שגיאה לא ידועה"} || אבחון מפתח: ${describeKey()}` };
  }
}
