import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CollectionRoute } from "@ultranet/shared-types";

export type EzcountCreds = { apiKey: string; developerEmail: string };

/**
 * Resolves which EZcount account to issue receipts through for a given branch:
 * 1. A route explicitly assigned to the branch (branch.collectionRouteId), if it has
 *    receiptsProvider "ezcount" configured.
 * 2. Otherwise, any global EZcount-receipts route (branchScope === null).
 * Mirrors resolveNedarimCreds in lib/nedarim.ts.
 */
export async function resolveEzcountCreds(branchId?: string | null): Promise<EzcountCreds | null> {
  const db = getAdminFirestore();

  if (branchId) {
    const branchDoc = await db.collection("n_branches").doc(branchId).get();
    const collectionRouteId = (branchDoc.data() as { collectionRouteId?: string | null } | undefined)
      ?.collectionRouteId;
    if (collectionRouteId) {
      const routeDoc = await db.collection("n_collection_routes").doc(collectionRouteId).get();
      if (routeDoc.exists) {
        const route = routeDoc.data() as Omit<CollectionRoute, "id">;
        if (route.receiptsProvider === "ezcount" && route.receiptsApiKey && route.receiptsCompanyId) {
          return { apiKey: route.receiptsApiKey, developerEmail: route.receiptsCompanyId };
        }
      }
    }
  }

  const globalSnap = await db
    .collection("n_collection_routes")
    .where("receiptsProvider", "==", "ezcount")
    .where("branchScope", "==", null)
    .limit(1)
    .get();
  if (!globalSnap.empty) {
    const route = globalSnap.docs[0]!.data() as Omit<CollectionRoute, "id">;
    if (route.receiptsApiKey && route.receiptsCompanyId) {
      return { apiKey: route.receiptsApiKey, developerEmail: route.receiptsCompanyId };
    }
  }

  return null;
}

const EZCOUNT_API = "https://api.ezcount.co.il/api/createDoc";

/**
 * סוג המסמך שמופק ב-EZcount.
 *
 * 320 = **חשבונית מס קבלה** — מסמך אחד שגם מחייב וגם מאשר תשלום. זה מה שהעסק מפיק בפועל,
 * וזה גם מה שנדרים פלוס מפיק אוטומטית על כל עסקה שעוברת דרכו.
 * 400 = **קבלה** בלבד — אישור תשלום ללא חיוב, לשימוש במקרה שכבר קיימת חשבונית נפרדת.
 *
 * ברירת המחדל היא 320 בכוונה: מסמך מסוג 400 על תשלום שכבר קיבל חשבונית מס קבלה מנדרים
 * יוצר **שני מסמכים על אותו תשלום** — וזה בדיוק מה שקרה בעבר.
 */
export const EZCOUNT_DOC_TYPES = {
  taxInvoiceReceipt: 320,
  receiptOnly: 400,
} as const;

export type EzcountDocType = (typeof EZCOUNT_DOC_TYPES)[keyof typeof EZCOUNT_DOC_TYPES];

export type EzcountReceiptParams = {
  creds: EzcountCreds;
  amount: number;
  clientName: string;
  clientEmail?: string;
  clientIdNum?: string;
  desc?: string;
  /**
   * 1 = מזומן, 4 = העברה בנקאית (מתוך טבלת `payment_type` של EZcount).
   *
   * **אשראי (3) הוסר מהטיפוס בכוונה, וזה אילוץ עסקי.** עסקת אשראי נסלקת בנדרים פלוס,
   * שמפיק עליה חשבונית מס קבלה בעצמו — מסמך נוסף מכאן על אותה עסקה הוא כפילות בספרים.
   * המערכת מפיקה מסמכים **רק** על כסף שלא עבר סליקה: מזומן שנמשך מקופה, והעברות.
   */
  paymentType: 1 | 4;
  /** ברירת מחדל: חשבונית מס קבלה (320). ראה `EZCOUNT_DOC_TYPES`. */
  docType?: EzcountDocType;
};

export type EzcountReceiptResult =
  | { ok: true; docUuid: string; docNumber: string; pdfLink: string; sentMails: string[] }
  | { ok: false; message: string };

/**
 * מפיק מסמך ב-EZcount ושולח אותו ללקוח במייל אם יש כתובת.
 *
 * **לעולם לא נקרא אוטומטית.** כל שלושת מקומות הקריאה הם לחיצת כפתור מפורשת, וזו לא
 * מקריות: הגבייה עוברת דרך נדרים פלוס, ושם מוגדר שכל עסקה מפיקה חשבונית מס קבלה בעצמה.
 * הפקה אוטומטית גם מכאן הייתה יוצרת מסמך שני על אותו תשלום.
 */
export async function createEzcountReceipt(params: EzcountReceiptParams): Promise<EzcountReceiptResult> {
  const { creds, amount, clientName, clientEmail, clientIdNum, desc, paymentType } = params;
  const docType: EzcountDocType = params.docType ?? EZCOUNT_DOC_TYPES.taxInvoiceReceipt;

  // חגורה מעל השלייקס: הטיפוס כבר לא מאפשר אשראי, והבדיקה הזו תופסת קריאה שהגיעה
  // מדאטה חיצוני או מ-cast. עסקת אשראי לא מקבלת מסמך מהמערכת, נקודה.
  if ((paymentType as number) === 3) {
    return { ok: false, message: "המערכת לא מפיקה מסמך על עסקת אשראי - נדרים פלוס מפיק אותו בעצמו" };
  }

  const payment: Record<string, unknown> = {
    payment_type: paymentType,
    payment_sum: amount,
  };

  const body = {
    api_key: creds.apiKey,
    developer_email: creds.developerEmail,
    // required by EZcount whenever the account is registered as a "distributor" -
    // for a single-business account (not proxying other EZcount users) this is
    // just the account's own api_key.
    created_by_api_key: creds.apiKey,
    type: docType,
    customer_name: clientName,
    customer_email: clientEmail || undefined,
    customer_crn: clientIdNum || undefined,
    description: desc,
    forceItemsIntoNonItemsDocument: true,
    dont_send_email: clientEmail ? 0 : 1,
    payment: [payment],
  };

  let res: Response;
  try {
    res = await fetch(EZCOUNT_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, message: "שגיאת תקשורת מול EZcount" };
  }

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    return { ok: false, message: "תגובה לא תקינה מ-EZcount" };
  }

  if (data.success !== true) {
    return { ok: false, message: String(data.errMsg ?? "יצירת הקבלה נכשלה") };
  }

  return {
    ok: true,
    docUuid: String(data.doc_uuid ?? ""),
    docNumber: String(data.doc_number ?? ""),
    pdfLink: String(data.pdf_link ?? ""),
    sentMails: Array.isArray(data.sent_mails) ? (data.sent_mails as string[]) : [],
  };
}
