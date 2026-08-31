"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/perms";
import { getOwnerName } from "@/lib/owner-name";
import { loadBranchAccountingRawData } from "@/lib/branch-accounting-data";
import { loadReportLogoUrl } from "@/lib/branch-month-report";
import { buildBranchReportEmail, sendMonthlyReports, type BranchSendOutcome } from "@/lib/branch-report-send";
import { sendHtmlEmail, type SendResult } from "@/lib/mailer";

/**
 * Emails one branch's monthly statement to one address, owner-only.
 *
 * Recipient and branch are independent on purpose - that's what makes this a *test* send: the
 * owner picks any branch's report and has it delivered to their own inbox to check how it looks
 * before it ever goes to a partner. It deliberately does NOT stamp reportSentAt, so a test never
 * causes the real monthly run to skip that branch.
 *
 * Returns a result object rather than throwing, because "the mailer isn't configured yet" is a
 * normal answer that the UI needs to display in full.
 */
export async function sendBranchReportAction(
  branchId: string,
  month: string,
  toEmail: string
): Promise<SendResult> {
  const session = await requireOwner();

  const email = toEmail.trim();
  if (!email || !email.includes("@")) return { ok: false, message: "כתובת מייל לא תקינה" };
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, message: "חודש לא תקין" };

  const raw = await loadBranchAccountingRawData();
  const branch = raw.branches.find((b) => b.id === branchId);
  if (!branch) return { ok: false, message: "הסניף לא נמצא" };

  const [logoUrl, ownerName] = await Promise.all([loadReportLogoUrl(), getOwnerName(session.user?.name)]);
  const { subject, html, inlineImages } = buildBranchReportEmail({
    branch,
    raw,
    month,
    logoUrl,
    ownerName,
    testNotice: 'מייל בדיקה - נשלח אליך כדי לראות איך הדו"ח נראה',
  });

  return sendHtmlEmail({ to: email, subject: `[בדיקה] ${subject}`, html, inlineImages });
}

/**
 * Sends the month's real statement to every rentals branch that has an address, owner-only.
 * This one DOES stamp reportSentAt, and skips branches already mailed for that month.
 */
export async function sendMonthlyReportsAction(month: string): Promise<BranchSendOutcome[]> {
  const session = await requireOwner();
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return [{ branchId: "", branchName: "", email: null, ok: false, message: "חודש לא תקין" }];
  }

  const outcomes = await sendMonthlyReports({
    month,
    ownerDisplayName: session.user?.name,
    skipAlreadySent: true,
  });
  revalidatePath("/dashboard/settlement");
  return outcomes;
}
