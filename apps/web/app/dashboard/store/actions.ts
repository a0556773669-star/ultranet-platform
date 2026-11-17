"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { currentModuleScope, requireOwner } from "@/lib/perms";
import { applyUsageDefaults, sanitizeSpec, type UsageKey } from "@/lib/store-wizard";
import type { StoreRequest, StoreRequestMode, StoreRequestOption, StoreRequestStatus, StoreSpec } from "@ultranet/shared-types";

const COLLECTION = "n_store_requests";
const STATUSES: StoreRequestStatus[] = ["new", "in_review", "answered", "closed"];

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

  const now = new Date().toISOString();
  await ref.update({
    options,
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
