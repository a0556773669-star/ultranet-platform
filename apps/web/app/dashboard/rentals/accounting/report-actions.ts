"use server";

import { requireOwner } from "@/lib/perms";
import { getOwnerName } from "@/lib/owner-name";
import { loadBranchAccountingRawData } from "@/lib/branch-accounting-data";
import {
  buildBranchMonthReport,
  branchMonthReportSubject,
  loadReportLogoUrl,
  renderBranchMonthReportHtml,
} from "@/lib/branch-month-report";
import { sendHtmlEmail, type SendResult } from "@/lib/mailer";

/**
 * Emails one branch's monthly statement to one address, owner-only.
 *
 * Recipient and branch are independent on purpose - that's what makes this a *test* send: the
 * owner picks any branch's report and has it delivered to their own inbox to check how it looks
 * before it ever goes to a partner.
 *
 * Returns a result object rather than throwing, because "the mailer isn't configured yet" is a
 * normal answer that the UI needs to display in full.
 */
export async function sendBranchReportAction(
  branchId: string,
  month: string,
  toEmail: string,
  isTest: boolean
): Promise<SendResult> {
  const session = await requireOwner();

  const email = toEmail.trim();
  if (!email || !email.includes("@")) return { ok: false, message: "כתובת מייל לא תקינה" };
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, message: "חודש לא תקין" };

  const raw = await loadBranchAccountingRawData();
  const branch = raw.branches.find((b) => b.id === branchId);
  if (!branch) return { ok: false, message: "הסניף לא נמצא" };

  const [logoUrl, ownerName] = await Promise.all([
    loadReportLogoUrl(),
    getOwnerName(session.user?.name),
  ]);

  const report = buildBranchMonthReport(branch, raw, month);
  const html = renderBranchMonthReportHtml(report, {
    logoUrl,
    ownerName,
    testNotice: isTest ? "מייל בדיקה - נשלח אליך כדי לראות איך הדו\"ח נראה" : undefined,
  });
  const subject = isTest ? `[בדיקה] ${branchMonthReportSubject(report)}` : branchMonthReportSubject(report);

  return sendHtmlEmail({ to: email, subject, html });
}
