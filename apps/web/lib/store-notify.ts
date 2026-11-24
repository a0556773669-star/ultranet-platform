import { getAdminFirestore } from "./firebase-admin";
import { mailerConfigured, sendHtmlEmail } from "./mailer";
import type { StoreRequest } from "@ultranet/shared-types";
import { specToText } from "./store-wizard";

/**
 * התראות מייל של חנות הסניפים: הבעלים מקבל מייל כשבקשה מחכה לו (בדיקת מלאי / בקשה חדשה), והסניף מקבל מייל כשהבעלים
 * ענה (מלאי אושר / אין מלאי / נשלח). שליחה היא best-effort: אם המייל לא מוגדר או נכשל - הפעולה עצמה לא נכשלת.
 * נמענים לבעלים: `STORE_NOTIFY_EMAIL` (כתובות מופרדות בפסיק), ואחרת כל משתמשי הבעלים.
 */
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function baseUrl(): string {
  return (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
}

async function ownerEmails(): Promise<string[]> {
  const fromEnv = (process.env.STORE_NOTIFY_EMAIL ?? "").split(",").map((e) => e.trim()).filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const snap = await getAdminFirestore().collection("n_users").where("role", "==", "owner").get();
  return Array.from(new Set(snap.docs.map((d) => String(d.data().email ?? "").trim().toLowerCase()).filter(Boolean)));
}

function html(title: string, lines: string[], id: string): string {
  const link = `${baseUrl()}/dashboard/store/requests/${id}`;
  return `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1f2933">
<h2 style="margin:0 0 8px">${esc(title)}</h2>
${lines.map((l) => `<p style="margin:4px 0">${esc(l)}</p>`).join("")}
<p style="margin-top:16px"><a href="${link}" style="background:#0f766e;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">פתיחת הבקשה</a></p></div>`;
}

async function safeSend(to: string, subject: string, body: string): Promise<void> {
  if (!mailerConfigured()) return;
  try {
    await sendHtmlEmail({ to, subject, html: body });
  } catch {
    // התראה היא בונוס - לא מפילים את הפעולה
  }
}

export async function notifyOwnerStockCheck(r: StoreRequest): Promise<void> {
  const chosen = r.options?.[r.chosenOptionIndex ?? -1];
  const lines = [
    `סניף: ${r.branchName} · לקוח: ${r.customerName}`,
    chosen ? `האפשרות שהלקוח אישר: ${chosen.label} - ${chosen.specText}` : specToText(r.spec),
    chosen?.quotedFromILS ? `טווח שנאמר ללקוח: ${chosen.quotedFromILS}-${chosen.quotedToILS} ₪` : "",
    "הלקוח מעוניין - נדרשת בדיקת מלאי ומחיר סופי.",
  ].filter(Boolean);
  const body = html("בדיקת מלאי חדשה מסניף", lines, r.id);
  for (const to of await ownerEmails()) await safeSend(to, `בדיקת מלאי: ${r.customerName} (${r.branchName})`, body);
}

export async function notifyOwnerNewRequest(r: StoreRequest): Promise<void> {
  const body = html("בקשת התאמת מחשב חדשה", [`סניף: ${r.branchName} · לקוח: ${r.customerName}`, specToText(r.spec)], r.id);
  for (const to of await ownerEmails()) await safeSend(to, `בקשה חדשה: ${r.customerName} (${r.branchName})`, body);
}

export async function notifyBranch(r: StoreRequest, title: string, line: string): Promise<void> {
  if (!r.createdByEmail) return;
  await safeSend(r.createdByEmail, `${title}: ${r.customerName}`, html(title, [`לקוח: ${r.customerName}`, line], r.id));
}
