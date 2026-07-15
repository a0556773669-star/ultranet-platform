import { getAdminFirestore } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

const NEDARIUM_API = "https://matara.pro/nedarimplus/V6/Files/WebServices/DebitCard.aspx";
const MOSAD = "7013078";
const CURRENCY = "1";

export async function POST(req: NextRequest) {
  try {
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

    const postData = new URLSearchParams({
      Mosad: MOSAD,
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

    const response = await fetch(NEDARIUM_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: postData.toString(),
    });

    const responseText = await response.text();
    const result = JSON.parse(responseText);

    if (result.Status === "OK") {
      await db.collection("n_rental_transactions").add({
        clientId,
        amount,
        tashloumim,
        confirmation: result.Confirmation,
        nedarium_id: result["נדרים פלוס - בדיקהID"],
        status: "completed",
        paymentMethod: "credit_token",
        createdAt: new Date(),
      });

      return NextResponse.json({
        success: true,
        message: "חיוב בוצע בהצלחה",
        confirmation: result.Confirmation,
        nedarium_id: result["נדרים פלוס - בדיקהID"],
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: `שגיאה בחיוב: ${result.Message}`,
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
