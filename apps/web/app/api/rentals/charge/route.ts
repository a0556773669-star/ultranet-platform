import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { resolveNedarimCreds } from "@/lib/nedarim";
import { resolveEzcountCreds, createEzcountReceipt } from "@/lib/ezcount";
import { NextRequest, NextResponse } from "next/server";

const NEDARIUM_API = "https://matara.pro/nedarimplus/V6/Files/WebServices/DebitCard.aspx";
const CURRENCY = "1";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "יש להתחבר" }, { status: 401 });
    }
    const role = session.user?.role;
    const perms = (session.user as { perms?: Partial<Record<string, boolean>> } | undefined)?.perms;
    if (role !== "owner" && !perms?.charging) {
      return NextResponse.json({ success: false, message: "אין לך הרשאה לבצע חיוב" }, { status: 403 });
    }

    const { clientId, amount, tashloumim = 1 } = await req.json();

    if (!clientId || !amount) {
      return NextResponse.json(
        { success: false, message: "clientId ו-amount נדרשים" },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const clientDoc = await db.collection("n_rental_clients").doc(clientId).get();
    const client = clientDoc.data();

    if (!client || !client.gatewayToken || !client.cardExpiry) {
      return NextResponse.json(
        { success: false, message: "לקוח ללא פרטי אשראי מאוחסנים" },
        { status: 400 }
      );
    }

    const creds = await resolveNedarimCreds(client.branchId);
    if (!creds) {
      return NextResponse.json(
        { success: false, message: "לא נמצא מסלול סליקה של נדרים פלוס לסניף זה" },
        { status: 400 }
      );
    }

    const postData = new URLSearchParams({
      Mosad: creds.mosadId,
      Token: client.gatewayToken,
      Tokef: client.cardExpiry,
      Amount: String(Math.round(amount * 100) / 100),
      Tashloumim: String(tashloumim),
      Currency: CURRENCY,
      ClientName: client.name || "",
      Phone: client.phone || "",
      Mail: client.email || "",
      Zeout: client.idNum || "",
      Adresse: client.address || "",
    });

    let response: Response;
    try {
      response = await fetch(NEDARIUM_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: postData.toString(),
      });
    } catch (networkError) {
      // The request never reached Nedarim Plus (or we never got a response) -
      // no charge could have happened on their end, so this is a real failure.
      console.error("Charge network error:", networkError);
      return NextResponse.json(
        { success: false, message: "שגיאת תקשורת מול נדרים פלוס - החיוב לא בוצע" },
        { status: 502 }
      );
    }

    const responseText = await response.text();
    let result: Record<string, unknown>;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      // Nedarim DID respond - the charge may well have gone through on their
      // side even though we can't parse their reply (e.g. encoding issue).
      // Do not report a plain failure here: log the raw response and tell
      // the user to verify manually instead of risking a false "failed" that
      // could lead to a duplicate charge on retry.
      console.error("Charge response parse error:", parseError, responseText.slice(0, 500));
      await db.collection("n_rental_transactions").add({
        clientId,
        amount,
        tashloumim,
        status: "unknown",
        paymentMethod: "credit_token",
        rawResponse: responseText.slice(0, 1000),
        createdAt: new Date(),
      });
      return NextResponse.json(
        {
          success: false,
          ambiguous: true,
          message:
            "התקבלה תגובה לא תקינה מנדרים פלוס. ייתכן שהחיוב בכל זאת בוצע - יש לבדוק בדוח הסליקה של נדרים פלוס לפני חיוב חוזר.",
        },
        { status: 502 }
      );
    }

    const status = String(result.Status ?? "").trim().toUpperCase();
    const nedarimId = result.ID ?? result.Id ?? result.id;

    if (status === "OK") {
      await db.collection("n_rental_transactions").add({
        clientId,
        amount,
        tashloumim,
        confirmation: result.Confirmation,
        nedarium_id: nedarimId,
        status: "completed",
        paymentMethod: "credit_token",
        createdAt: new Date(),
      });

      let receipt: { pdfLink?: string; message?: string } = {};
      const ezcountCreds = await resolveEzcountCreds(client.branchId);
      if (ezcountCreds) {
        const receiptResult = await createEzcountReceipt({
          creds: ezcountCreds,
          amount,
          clientName: client.name || "",
          clientEmail: client.email,
          clientIdNum: client.idNum,
          desc: "תשלום השכרה - כרטיס אשראי",
          paymentType: 3,
          cardLast4: client.cardLast4,
        });
        if (receiptResult.ok) {
          receipt = { pdfLink: receiptResult.pdfLink };
        } else {
          console.error("EZcount receipt error:", receiptResult.message);
          receipt = { message: receiptResult.message };
        }
      }

      return NextResponse.json({
        success: true,
        message: "חיוב בוצע בהצלחה",
        confirmation: result.Confirmation,
        nedarium_id: nedarimId,
        receiptPdfLink: receipt.pdfLink,
        receiptError: receipt.message,
      });
    } else {
      await db.collection("n_rental_transactions").add({
        clientId,
        amount,
        tashloumim,
        status: "failed",
        paymentMethod: "credit_token",
        rawResponse: responseText.slice(0, 1000),
        createdAt: new Date(),
      });
      return NextResponse.json(
        {
          success: false,
          message: `שגיאה בחיוב: ${result.Message ?? "לא ידוע"}`,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Charge error:", error);
    return NextResponse.json(
      { success: false, message: "שגיאה בשרת" },
      { status: 500 }
    );
  }
}
