"use server";

import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { DEVICE_TRUST_COOKIE, DEVICE_TRUST_MAX_AGE_SECONDS, signDeviceToken } from "@/lib/device-trust";

export type DeviceCodeResult =
  | { ok: true; message: string; code: string; email: string }
  | { ok: false; message: string };
export async function requestDeviceCodeAction(): Promise<DeviceCodeResult> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return { ok: false, message: "אין התחברות פעילה" };
  }

  const db = getAdminFirestore();
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);

  await db.collection("n_device_codes").doc(email).set({ code, expiresAt, createdAt: Timestamp.now() });

  return { ok: true, message: "קוד נוצר", code, email };
}

export async function verifyDeviceCodeAction(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return { ok: false, message: "אין התחברות פעילה" };

  const code = String(formData.get("code") ?? "").trim();
  const remember = formData.get("remember") === "on";

  const db = getAdminFirestore();
  const docRef = db.collection("n_device_codes").doc(email);
  const snap = await docRef.get();
  if (!snap.exists) return { ok: false, message: "לא נמצא קוד, בקש קוד חדש" };
  const data = snap.data() as { code: string; expiresAt: { toMillis(): number } };
  if (data.code !== code) return { ok: false, message: "קוד שגוי" };
  if (data.expiresAt.toMillis() < Date.now()) return { ok: false, message: "הקוד פג תוקף" };

  await docRef.delete();

  const token = signDeviceToken(email);
  const jar = cookies();
  if (remember) {
    jar.set(DEVICE_TRUST_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DEVICE_TRUST_MAX_AGE_SECONDS });
  } else {
    jar.set(DEVICE_TRUST_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  }

  return { ok: true, message: "אומת" };
}
