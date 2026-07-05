"use server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { getResend } from "@/lib/resend";
import { Timestamp } from "firebase-admin/firestore";

export type LoginCodeResult = { ok: boolean; message: string };

export async function requestLoginCodeAction(
  _prevState: LoginCodeResult | undefined,
  formData: FormData
): Promise<LoginCodeResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return { ok: false, message: "יש להזין אימייל" };
  }

  const db = getAdminFirestore();
  const approvedSnap = await db.collection("n_approved_emails").doc(email).get();
  if (!approvedSnap.exists) {
    return { ok: false, message: "האימייל הזה לא מאושר להתחברות. פנה למנהל המערכת." };
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);

  await db.collection("n_login_codes").doc(email).set({
    code,
    expiresAt,
    createdAt: Timestamp.now(),
  });

  try {
    await getResend().emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to: email,
      subject: "קוד ההתחברות שלך לאולטרנט",
      html: `<div dir="rtl" style="font-family: sans-serif; font-size: 16px;">
        <p>קוד ההתחברות שלך למערכת אולטרנט:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">${code}</p>
        <p>הקוד בתוקף ל-10 דקות. אם לא ביקשת קוד זה, אפשר להתעלם מהמייל.</p>
      </div>`,
    });
  } catch (err) {
    console.error("שליחת מייל הקוד נכשלה", err);
    return { ok: false, message: "שליחת המייל נכשלה. נסה שוב מאוחר יותר." };
  }

  return { ok: true, message: "קוד נשלח לאימייל שלך" };
}
