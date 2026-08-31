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

export type EzcountReceiptParams = {
  creds: EzcountCreds;
  amount: number;
  clientName: string;
  clientEmail?: string;
  clientIdNum?: string;
  desc?: string;
  /** 1 cash, 3 credit card, 4 bank transfer - per EZcount payment_type table */
  paymentType: 1 | 3 | 4;
  cardLast4?: string;
};

export type EzcountReceiptResult =
  | { ok: true; docUuid: string; docNumber: string; pdfLink: string; sentMails: string[] }
  | { ok: false; message: string };

/** Creates a plain receipt (doc type 400, no VAT) via EZcount and emails it to the client if an email is on file. */
export async function createEzcountReceipt(params: EzcountReceiptParams): Promise<EzcountReceiptResult> {
  const { creds, amount, clientName, clientEmail, clientIdNum, desc, paymentType, cardLast4 } = params;

  const payment: Record<string, unknown> = {
    payment_type: paymentType,
    payment_sum: amount,
  };
  if (paymentType === 3) {
    payment.cc_type = 0;
    payment.cc_type_name = "כרטיס אשראי";
    payment.cc_number = cardLast4 ?? "";
    payment.cc_deal_type = 1;
    payment.cc_num_of_payments = 1;
  }

  const body = {
    api_key: creds.apiKey,
    developer_email: creds.developerEmail,
    // required by EZcount whenever the account is registered as a "distributor" -
    // for a single-business account (not proxying other EZcount users) this is
    // just the account's own api_key.
    created_by_api_key: creds.apiKey,
    type: 400,
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
