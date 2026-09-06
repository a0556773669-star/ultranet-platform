"use server";

/**
 * הפקת קבלה על הכנסת ניידים, ישירות מהספר הראשי.
 *
 * הקבלה מופקת ב-EZcount ונשלחת ללקוח במייל באותה קריאה: EZcount מקים את הלקוח אצלו
 * לפי השם והמייל שנשלחים כאן (`customer_name` / `customer_email`), ואם יש מייל הוא
 * שולח את המסמך אליו בעצמו - לכן אין כאן שליחת מייל נפרדת, ואין רשימת לקוחות שצריך
 * לתחזק במקביל.
 *
 * מה שצריך כדי שזה יעבוד (הגדרות → "הגדרות גבייה", `/dashboard/accounting/routes`):
 *   1. מסלול גבייה עם `receiptsProvider = ezcount`.
 *   2. `receiptsApiKey`  = ה-API key של החשבון ב-EZcount.
 *   3. `receiptsCompanyId` = כתובת ה-developer email של החשבון (EZcount שולח אותה כ-`developer_email`).
 * מסלול שמשוייך לסניף מסוים גובר על מסלול גלובלי - ראה `lib/ezcount.ts`.
 */
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingIncome } from "@ultranet/shared-types";
import { resolveEzcountCreds, createEzcountReceipt } from "@/lib/ezcount";

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
  return session;
}

export type IssueReceiptResult =
  | { ok: true; docNumber: string; pdfLink: string; sentTo: string[] }
  | { ok: false; message: string };

export async function issueIncomeReceiptAction(
  incomeId: string,
  formData: FormData,
): Promise<IssueReceiptResult> {
  await requireOwner();
  const db = getAdminFirestore();
  const ref = db.collection("n_ah_income").doc(incomeId);
  const doc = await ref.get();
  const income = doc.data() as Omit<AccountingIncome, "id"> | undefined;
  if (!income) return { ok: false, message: "שורת ההכנסה לא נמצאה" };

  const clientName = String(formData.get("clientName") ?? "").trim();
  const clientEmail = String(formData.get("clientEmail") ?? "").trim();
  const clientIdNum = String(formData.get("clientIdNum") ?? "").trim();
  const paymentTypeRaw = String(formData.get("paymentType") ?? "4");
  const paymentType = paymentTypeRaw === "1" ? 1 : paymentTypeRaw === "3" ? 3 : 4;
  if (!clientName) return { ok: false, message: "חובה להזין שם לקוח לקבלה" };

  const creds = await resolveEzcountCreds(income.branchId ?? null);
  if (!creds) {
    return {
      ok: false,
      message:
        'לא מוגדר חשבון EZcount. יש להגדיר מסלול גבייה עם ספק קבלות "ezcount", מפתח API וכתובת developer email תחת "הגדרות גבייה".',
    };
  }

  const result = await createEzcountReceipt({
    creds,
    amount: income.amount,
    clientName,
    clientEmail: clientEmail || undefined,
    clientIdNum: clientIdNum || undefined,
    desc: income.desc,
    paymentType,
  });
  if (!result.ok) return { ok: false, message: result.message };

  await ref.set(
    {
      receiptIssued: true,
      receiptDocNumber: result.docNumber,
      receiptPdfUrl: result.pdfLink,
      receiptClientName: clientName,
      ...(clientEmail ? { receiptClientEmail: clientEmail } : {}),
    },
    { merge: true },
  );
  revalidatePath("/dashboard/accounting");
  return { ok: true, docNumber: result.docNumber, pdfLink: result.pdfLink, sentTo: result.sentMails };
}
