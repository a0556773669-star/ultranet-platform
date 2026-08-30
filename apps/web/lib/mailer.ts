/**
 * Server-side email sending, used by the monthly branch statement (lib/branch-month-report.ts).
 *
 * Deliberately separate from the EmailJS calls in the login/verify-device forms: those run in the
 * browser against a fixed text template (a 6-digit code), which cannot carry a styled HTML
 * document. Resend is already a dependency and sends real HTML from the server.
 *
 * Unconfigured is a normal state, not a crash: until RESEND_API_KEY is set every send returns
 * { ok: false } with a Hebrew message naming exactly what's missing, so the UI can say so.
 */
import { Resend } from "resend";
import type { EmailInlineImage } from "./email-logo";

export interface SendResult {
  ok: boolean;
  message: string;
}

const MISSING_KEY =
  'שליחת המייל לא מוגדרת עדיין: חסר RESEND_API_KEY בקובץ apps/web/.env.local. ' +
  'פתח חשבון ב-resend.com, אמת דומיין שליחה, והדבק את המפתח שם. התצוגה המקדימה עובדת גם בלי זה.';
const MISSING_FROM =
  'שליחת המייל לא מוגדרת עדיין: חסר REPORT_FROM_EMAIL בקובץ apps/web/.env.local ' +
  '(כתובת השולח, למשל "אולטרנט <reports@your-domain.co.il>"). היא חייבת להיות בדומיין שאימתת ב-Resend.';

export function mailerConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.REPORT_FROM_EMAIL;
}

/** The reason the mailer isn't usable, or null when it is. Lets the UI warn before the click. */
export function mailerConfigError(): string | null {
  if (!process.env.RESEND_API_KEY) return MISSING_KEY;
  if (!process.env.REPORT_FROM_EMAIL) return MISSING_FROM;
  return null;
}

export async function sendHtmlEmail(params: {
  to: string;
  subject: string;
  html: string;
  /** Images the HTML references as src="cid:<contentId>" - see lib/email-logo.ts for why the
   *  logo has to travel inside the message rather than as a data: URI. */
  inlineImages?: EmailInlineImage[];
}): Promise<SendResult> {
  const configError = mailerConfigError();
  if (configError) return { ok: false, message: configError };

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const attachments = (params.inlineImages ?? []).map((img) => ({
      content: Buffer.from(img.base64, "base64"),
      filename: img.filename,
      contentType: img.contentType,
      contentId: img.contentId,
    }));
    const { error } = await resend.emails.send({
      from: process.env.REPORT_FROM_EMAIL as string,
      to: params.to,
      subject: params.subject,
      html: params.html,
      ...(attachments.length > 0 ? { attachments } : {}),
    });
    if (error) {
      return { ok: false, message: `שליחת המייל נכשלה: ${error.message ?? "שגיאה לא ידועה מ-Resend"}` };
    }
    return { ok: true, message: `הדו"ח נשלח אל ${params.to}` };
  } catch (err) {
    return { ok: false, message: `שליחת המייל נכשלה: ${err instanceof Error ? err.message : "שגיאה לא ידועה"}` };
  }
}
