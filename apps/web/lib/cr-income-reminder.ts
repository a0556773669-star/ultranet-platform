/**
 * תזכורת חודשית להזנת הכנסות חדרי המחשבים מסייפר.
 *
 * המספרים של כל סניף מגיעים מהאתר של סייפר, והם נמשכים פעם בחודש על החודש שנסגר. ה-cron
 * (`/api/cron/cr-income-check`, ב-1 לחודש) בודק לאילו סניפים עוד אין שורת מעקב
 * (`n_branch_income`) לחודש הקודם, ואם יש כאלה - שולח לבעלים מייל עם קישור שפותח ישר את
 * חלון "הכנסות החודש" על אותו חודש. כשהכול כבר מולא, לא נשלח כלום.
 *
 * מזומן מהקופה (`main-cash`) לא נחשב כאן "מילוי": הוא נרשם בנפרד בספר הראשי ומוצג בחלון לבד,
 * והמספר מסייפר עדיין חסר גם כשיש לסניף מזומן באותו חודש.
 */
import { branchMonthlyIncomeRows, loadComputerRoomAccounting } from "./computer-room-accounting";
import { monthLabel } from "./branch-income-excel";
import { loadOwnerEmail } from "./branch-report-recipients";
import { sendHtmlEmail, type SendResult } from "./mailer";

/** הסניפים שאין להם עדיין הכנסה מוזנת לחודש. */
export async function findBranchesMissingIncome(month: string): Promise<string[]> {
  const data = await loadComputerRoomAccounting();
  return branchMonthlyIncomeRows(data)
    .filter((b) => !((b.manualByMonth[month] ?? 0) > 0))
    .map((b) => b.name);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** הקישור שפותח את חלון ההזנה ישר על החודש החסר. */
export function incomeEntryUrl(month: string): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  return `${base}/dashboard/computer-rooms-accounting?enter=${month}`;
}

export async function sendMissingIncomeReminder(
  month: string,
): Promise<{ missing: string[]; sent: SendResult | null }> {
  const missing = await findBranchesMissingIncome(month);
  if (missing.length === 0) return { missing, sent: null };

  const to = await loadOwnerEmail();
  if (!to) return { missing, sent: { ok: false, message: "לא נמצאה כתובת מייל לבעלים" } };

  const label = monthLabel(month);
  const url = incomeEntryUrl(month);
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2937">
  <p>שלום,</p>
  <p>הכנסות חדרי המחשבים של <b>${label}</b> עוד לא הוזנו. צריך לפתוח את האתר של סייפר ולהעתיק את
  המספרים של החודש עבור הסניפים הבאים:</p>
  <ul>${missing.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
  <p>המזומן שנמשך מהקופה נספר לבד — אין צורך להזין אותו שוב.</p>
  <p><a href="${url}" style="display:inline-block;background:#1f9e8f;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">פתיחת חלון הזנת ההכנסות של ${label}</a></p>
</div>`;

  const sent = await sendHtmlEmail({ to, subject: `להזין הכנסות חדרי מחשבים - ${label}`, html });
  return { missing, sent };
}
