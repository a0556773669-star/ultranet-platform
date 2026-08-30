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
  'שליחת המייל לא מוגדרת עדיין: חסר RESEND_API_KEY. פתח חשבון ב-resend.com, צור API Key, ' +
  'והוסף אותו כמשתנה סביבה בפריסה (ב-Vercel: Settings → Environment Variables), ואז Redeploy. ' +
  'התצוגה המקדימה של הדו"ח עובדת גם בלי זה.';

/**
 * Resend's shared sandbox sender, usable with any API key and no DNS setup at all - but it can
 * only deliver to the address the Resend account itself was opened with. That makes it exactly
 * right for "send myself a test" and useless for mailing partners, which is why
 * mailerSandboxMode() exists: the UI has to say so rather than let a send to a partner fail
 * with an unexplained Resend error.
 */
const SANDBOX_FROM = "onboarding@resend.dev";

export const SANDBOX_NOTICE =
  'מצב בדיקה: לא הוגדרה כתובת שולח (REPORT_FROM_EMAIL), ולכן המייל נשלח מכתובת הבדיקה של Resend. ' +
  'היא מצליחה להגיע רק לכתובת שאיתה נרשמת ל-Resend. כדי לשלוח לשותפים צריך לאמת דומיין ב-Resend ' +
  'ולהגדיר REPORT_FROM_EMAIL.';

function fromAddress(): string {
  return process.env.REPORT_FROM_EMAIL?.trim() || SANDBOX_FROM;
}

export function mailerConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** true when sending falls back to Resend's sandbox sender - deliverable only to your own inbox. */
export function mailerSandboxMode(): boolean {
  return mailerConfigured() && !process.env.REPORT_FROM_EMAIL?.trim();
}

/** The reason the mailer isn't usable at all, or null when it can send. A missing sender address
 *  is NOT a blocker any more - it degrades to the sandbox sender, see mailerSandboxMode(). */
export function mailerConfigError(): string | null {
  return process.env.RESEND_API_KEY ? null : MISSING_KEY;
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
      from: fromAddress(),
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
