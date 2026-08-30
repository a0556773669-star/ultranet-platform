"use server";

/**
 * "תנועה חדשה" — the single screen in the whole system that creates money (כלל 1).
 *
 * Every other screen classifies, splits or displays; none of them creates. That is what makes
 * "a shekel is recorded once" enforceable rather than merely intended: there is exactly one
 * place a new shekel can enter the books.
 *
 * The form carries what the seven old collections between them could not:
 *   nature       — which layer this belongs to (operating / capital / transfer)
 *   node         — the profit-centre it hangs on, down to the lowest one actually known
 *   ownerShare   — the owner's part in ₪, so a free percentage needs no separate collection
 *   allocations  — a split across branches, so a multi-branch expense needs none either
 *   recurring    — so a fixed monthly charge needs none either
 */
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { TX_COLLECTION, buildTransaction, evenAllocations } from "@/lib/tx";
import type { TxBusiness, TxDirection, TxNature } from "@ultranet/shared-types";

export interface SaveResult {
  ok: boolean;
  message: string;
}

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const NATURES: TxNature[] = ["operating", "capital", "transfer"];
const BUSINESSES: TxBusiness[] = ["rentals", "computers", "coworking", "hq"];

function revalidate(branchIds: (string | undefined)[]) {
  revalidatePath("/dashboard/accounting/entries");
  revalidatePath("/dashboard/accounting/overview");
  revalidatePath("/dashboard/accounting/bottom-line");
  revalidatePath("/dashboard/accounting/integrity");
  revalidatePath("/dashboard/accounting/attribute");
  for (const id of branchIds) if (id) revalidatePath(`/dashboard/accounting/overview/${id}`);
}

export async function createTransactionAction(formData: FormData): Promise<SaveResult> {
  try {
    await requireOwner();

    const date = String(formData.get("date") ?? "").trim();
    const direction: TxDirection = formData.get("direction") === "in" ? "in" : "out";
    const amount = Math.round(Number(String(formData.get("amount") ?? "").replace(/[₪,\s]/g, "")));
    const natureRaw = String(formData.get("nature") ?? "operating");
    const nature: TxNature = NATURES.includes(natureRaw as TxNature) ? (natureRaw as TxNature) : "operating";
    const businessRaw = String(formData.get("business") ?? "rentals");
    const business: TxBusiness = BUSINESSES.includes(businessRaw as TxBusiness)
      ? (businessRaw as TxBusiness)
      : "hq";
    const branchId = String(formData.get("branchId") ?? "").trim() || (business === "hq" ? "hq" : "shared");
    const desc = String(formData.get("desc") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const paidBy = formData.get("paidBy") === "partner" ? "partner" : "owner";
    const note = String(formData.get("note") ?? "").trim();
    const docLink = String(formData.get("doc") ?? "").trim();

    if (!DATE_RE.test(date)) return { ok: false, message: "נא לבחור תאריך" };
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "נא להזין סכום גדול מאפס" };
    if (!desc && !category) return { ok: false, message: "נא להזין תיאור או לבחור קטגוריה" };

    // The owner's share, as a free percentage of the full amount. Capital is always 100% his -
    // the partner never carries equipment (כלל 7) - so the field is ignored for it.
    const ownerPctRaw = String(formData.get("ownerPct") ?? "").trim();
    const ownerPct = ownerPctRaw === "" ? 100 : Number(ownerPctRaw);
    if (!Number.isFinite(ownerPct) || ownerPct < 0 || ownerPct > 100) {
      return { ok: false, message: "חלק הבעלים חייב להיות בין 0 ל-100 אחוז" };
    }
    const ownerShare = nature === "capital" ? amount : (amount * ownerPct) / 100;

    // A split across several branches. One transaction with a split - never N transactions:
    // N rows are N chances for the sum to stop matching what actually left the account.
    const splitBranchIds = formData.getAll("splitBranchIds").map(String).filter(Boolean);
    const allocations = splitBranchIds.length > 0 ? evenAllocations(amount, splitBranchIds) : undefined;

    const recurringFrom = String(formData.get("recurringFrom") ?? "").trim();
    const recurringTo = String(formData.get("recurringTo") ?? "").trim();
    if (recurringFrom && !MONTH_RE.test(recurringFrom)) return { ok: false, message: "חודש התחלה לא תקין" };
    if (recurringTo && !MONTH_RE.test(recurringTo)) return { ok: false, message: "חודש סיום לא תקין" };
    if (recurringFrom && recurringTo && recurringTo < recurringFrom) {
      return { ok: false, message: "חודש הסיום מוקדם מחודש ההתחלה" };
    }

    const tx = buildTransaction({
      date,
      direction,
      amount,
      nature,
      business,
      branchId,
      desc: desc || category,
      paidBy,
      ownerShare,
      ...(category ? { category } : {}),
      ...(allocations ? { allocations } : {}),
      ...(recurringFrom ? { recurring: { from: recurringFrom, ...(recurringTo ? { to: recurringTo } : {}) } } : {}),
      ...(docLink ? { doc: docLink } : {}),
      ...(note ? { note } : {}),
    });

    await getAdminFirestore().collection(TX_COLLECTION).add(tx);
    revalidate([branchId, ...splitBranchIds]);

    return {
      ok: true,
      message: `נרשמה תנועה ${direction === "in" ? "נכנסת" : "יוצאת"} — ${money(amount)}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `השמירה נכשלה: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}`,
    };
  }
}
