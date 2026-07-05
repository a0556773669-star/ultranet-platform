"use server";

import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export type LoginCodeResult =
  | { ok: true; message: string; code: string; name: string }
  | { ok: false; message: string };

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
  const approved = approvedSnap.data() as { name?: string } | undefined;

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);

  await db.collection("n_login_codes").doc(email).set({
    code,
    expiresAt,
    createdAt: Timestamp.now(),
  });

  return {
    ok: true,
    message: "קוד נוצר, שולח אימייל...",
    code,
    name: approved?.name ?? email,
  };
}
