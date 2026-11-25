import { getAdminFirestore } from "./firebase-admin";
import { mailerConfigured, sendHtmlEmail } from "./mailer";
import { waitUntil } from "@vercel/functions";
import type { StoreListing, StoreRequest } from "@ultranet/shared-types";
import { findCheapestListings } from "./store-listings";
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

/** מייל לבעלים: הלקוח מעוניין - בדיקת מלאי. כולל קישורים לחנויות הזולות ביותר (חיפוש שרץ ברקע, בלי לעכב את הסניף). */
export async function notifyOwnerStockCheck(r: StoreRequest): Promise<void> {
  const task = stockCheckFollowUp(r).catch((e) => console.error("[store-notify] stock check follow-up failed:", e instanceof Error ? e.message : e));
  try {
    waitUntil(task); // ב-Vercel: ממשיך לרוץ אחרי שהתשובה לסניף כבר נשלחה
  } catch {
    void task;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function stockCheckFollowUp(r: StoreRequest): Promise<void> {
  let listings: StoreListing[] = [];
  try {
    listings = (await withTimeout(findCheapestListings(r.spec), 50_000)) ?? [];
  } catch (e) {
    console.error("[store-notify] listings search failed:", e instanceof Error ? e.message : e);
  }
  if (listings.length) {
    await getAdminFirestore().collection("n_store_requests").doc(r.id).update({ listings, listingsAt: new Date().toISOString() }).catch(() => {});
  }
  const chosen = r.options?.[r.chosenOptionIndex ?? -1];
  const lines = [
    `סניף: ${r.branchName} · לקוח: ${r.customerName}`,
    chosen ? `האפשרות שהלקוח אישר: ${chosen.label} - ${chosen.specText}` : specToText(r.spec),
    chosen?.quotedFromILS ? `טווח שנאמר ללקוח: ${chosen.quotedFromILS}-${chosen.quotedToILS} ₪` : "",
    "הלקוח מעוניין - נדרשת בדיקת מלאי ומחיר סופי.",
  ].filter(Boolean);
  const listingsHtml = listings.length
    ? `<h3 style="margin:16px 0 6px">אם אין מלאי אצל היבואנים - איפה הכי זול להזמין</h3>
<ul style="padding-right:18px;margin:0">${listings
        .map((l) => `<li style="margin:4px 0"><a href="${esc(l.url)}">${esc(l.store)}</a> · ${esc(l.title)} · <b>${l.priceILS.toLocaleString("he-IL")} ₪</b></li>`)
        .join("")}</ul><p style="font-size:12px;color:#6b7280">מחירים אלה אינם מחייבים - לבדוק באתר.</p>`
    : "";
  const body = html("בדיקת מלאי חדשה מסניף", lines, r.id).replace("</div>", `${listingsHtml}</div>`);
  for (const to of await ownerEmails()) await safeSend(to, `בדיקת מלאי: ${r.customerName} (${r.branchName})`, body);
}

/** מייל לבעלים: הלקוח אישר והסניף סגר את העסקה - להזמין את המחשב ולשלוח לסניף. כולל איך נגבה, העמלה וקישורי החנויות שנמצאו. */
export async function notifyOwnerDealClosed(r: StoreRequest): Promise<void> {
  const chosen = r.options?.[r.chosenOptionIndex ?? -1];
  const total = (r.finalPriceILS ?? 0) + (r.accessoriesFinalILS ?? 0);
  const how = r.payment
    ? `שולם באשראי דרך נדרים פלוס${r.payment.test ? " (בדיקה)" : ""} · עסקה ${r.payment.transactionId}`
    : r.collection?.by === "branch"
      ? `הסניף גבה${r.collection.method ? ` (${{ cash: "מזומן", card: "אשראי", transfer: "העברה" }[r.collection.method]})` : ""}`
      : "ההנהלה גובה ישירות";
  const lines = [
    `סניף: ${r.branchName} · לקוח: ${r.customerName}${r.customerPhone ? ` · ${r.customerPhone}` : ""}${r.customerEmail ? ` · ${r.customerEmail}` : ""}`,
    chosen ? `${chosen.label} - ${chosen.specText}` : specToText(r.spec),
    r.accessories?.length ? `אביזרים: ${r.accessories.map((a) => a.name).join(", ")}` : "",
    `מחיר סופי: ${total.toLocaleString("he-IL")} ₪ · ${how}`,
    typeof r.commissionILS === "number" ? `עמלת הסניף: ${r.commissionILS.toLocaleString("he-IL")} ₪` : "",
    "העסקה נסגרה - יש להזמין את המחשב ולשלוח לסניף.",
  ].filter(Boolean);
  const listingsHtml = r.listings?.length
    ? `<h3 style="margin:16px 0 6px">איפה הכי זול להזמין</h3><ul style="padding-right:18px;margin:0">${r.listings
        .map((l) => `<li style="margin:4px 0"><a href="${esc(l.url)}">${esc(l.store)}</a> · ${esc(l.title)} · <b>${l.priceILS.toLocaleString("he-IL")} ₪</b></li>`)
        .join("")}</ul>`
    : "";
  const body = html("עסקה נסגרה - להזמין ולשלוח", lines, r.id).replace("</div>", `${listingsHtml}</div>`);
  for (const to of await ownerEmails()) await safeSend(to, `עסקה נסגרה: ${r.customerName} (${r.branchName})`, body);
}

export async function notifyOwnerNewRequest(r: StoreRequest): Promise<void> {
  const body = html("בקשת התאמת מחשב חדשה", [`סניף: ${r.branchName} · לקוח: ${r.customerName}`, specToText(r.spec)], r.id);
  for (const to of await ownerEmails()) await safeSend(to, `בקשה חדשה: ${r.customerName} (${r.branchName})`, body);
}

export async function notifyBranch(r: StoreRequest, title: string, line: string): Promise<void> {
  if (!r.createdByEmail) return;
  await safeSend(r.createdByEmail, `${title}: ${r.customerName}`, html(title, [`לקוח: ${r.customerName}`, line], r.id));
}
