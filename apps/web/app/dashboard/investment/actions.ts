"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { currentModuleScope } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { InvestmentEntry, InvestmentEntryKind } from "@ultranet/shared-types";
import { INVESTMENT_COLLECTION, isValidDate, round2 } from "@/lib/investment";

export interface InvestmentActionResult {
  ok: boolean;
  message: string;
}

const KINDS: readonly InvestmentEntryKind[] = ["deposit", "expense", "income", "profit_payout", "principal_return"];

/** עריכה — לבעלים בלבד. המשקיע (הרשאת `investment`) רק צופה. */
async function requireOwnerScope() {
  const scope = await currentModuleScope("investment");
  if (!scope?.isOwner) throw new Error("עריכה בטאב ההשקעה — לבעלים בלבד");
}

export interface InvestmentEntryInput {
  id?: string;
  kind: InvestmentEntryKind;
  date: string;
  amount: number;
  description: string;
  category?: string;
  expenseType?: "capital" | "operating";
  note?: string;
}

export async function saveInvestmentEntryAction(input: InvestmentEntryInput): Promise<InvestmentActionResult> {
  try {
    await requireOwnerScope();
    if (!KINDS.includes(input.kind)) return { ok: false, message: "סוג תנועה לא תקין" };
    if (!isValidDate(input.date)) return { ok: false, message: "תאריך לא תקין" };
    const amount = round2(Number(input.amount));
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "הסכום חייב להיות גדול מאפס" };
    const description = String(input.description ?? "").trim();
    if (!description) return { ok: false, message: "יש להזין תיאור" };

    const session = await getServerSession(authOptions);
    const data: Omit<InvestmentEntry, "id" | "createdAt"> = {
      kind: input.kind,
      date: input.date,
      amount,
      description,
      source: "manual",
      ...(input.kind === "expense"
        ? {
            category: String(input.category ?? "").trim() || "אחר",
            expenseType: input.expenseType === "operating" ? "operating" : "capital",
          }
        : {}),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    };

    const db = getAdminFirestore();
    if (input.id) {
      const ref = db.collection(INVESTMENT_COLLECTION).doc(input.id);
      const snap = await ref.get();
      if (!snap.exists) return { ok: false, message: "השורה לא נמצאה" };
      // set (לא merge): שדות שהוסרו בעריכה — למשל קטגוריה אחרי שינוי סוג — נעלמים באמת.
      await ref.set({ ...data, createdAt: (snap.data() as InvestmentEntry).createdAt, updatedAt: new Date().toISOString() });
    } else {
      await db.collection(INVESTMENT_COLLECTION).add({
        ...data,
        createdAt: new Date().toISOString(),
        createdBy: session?.user?.email ?? undefined,
      });
    }
    revalidatePath("/dashboard/investment");
    return { ok: true, message: "נשמר" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "אירעה שגיאה" };
  }
}

export async function deleteInvestmentEntryAction(id: string): Promise<InvestmentActionResult> {
  try {
    await requireOwnerScope();
    if (!id) return { ok: false, message: "חסר מזהה" };
    await getAdminFirestore().collection(INVESTMENT_COLLECTION).doc(id).delete();
    revalidatePath("/dashboard/investment");
    return { ok: true, message: "נמחק" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "אירעה שגיאה" };
  }
}
