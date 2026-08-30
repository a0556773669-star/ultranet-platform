/**
 * הפקה ושליחה של הדו"ח החודשי לסניפים.
 *
 * One place builds the message, so the browser preview, the test send and the automatic monthly
 * run can never drift apart: they all call buildBranchReportEmail() and differ only in what they
 * do with the result.
 *
 * The `reportSentAt` stamp lives on the branch's n_branch_transfers doc for that month (the
 * record that already represents "this branch, this month's settlement"), so a month can't be
 * mailed out twice by accident - the automatic run skips anything already sent.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { loadBranchAccountingRawData, type BranchAccountingRawData } from "./branch-accounting-data";
import {
  buildBranchMonthReport,
  branchMonthReportSubject,
  loadReportLogoUrl,
  renderBranchMonthReportHtml,
} from "./branch-month-report";
import { logoForEmail } from "./email-logo";
import { loadReportRecipients } from "./branch-report-recipients";
import { sendHtmlEmail, type SendResult } from "./mailer";
import { getOwnerName } from "./owner-name";

export interface BuiltReportEmail {
  subject: string;
  html: string;
  inlineImages: NonNullable<Parameters<typeof sendHtmlEmail>[0]["inlineImages"]>;
}

export function buildBranchReportEmail(params: {
  branch: Branch;
  raw: BranchAccountingRawData;
  month: string;
  logoUrl: string;
  ownerName: string;
  testNotice?: string;
}): BuiltReportEmail {
  const report = buildBranchMonthReport(params.branch, params.raw, params.month);
  const logo = logoForEmail(params.logoUrl);
  const html = renderBranchMonthReportHtml(report, {
    logoUrl: logo.src ?? "",
    ownerName: params.ownerName,
    testNotice: params.testNotice,
  });
  return {
    subject: branchMonthReportSubject(report),
    html,
    inlineImages: logo.attachment ? [logo.attachment] : [],
  };
}

export interface BranchSendOutcome {
  branchId: string;
  branchName: string;
  email: string | null;
  ok: boolean;
  message: string;
}

/** Stamps "the statement for this month was mailed" onto the branch/month settlement record. */
async function markReportSent(branchId: string, month: string): Promise<void> {
  await getAdminFirestore()
    .collection("n_branch_transfers")
    .doc(`${branchId}_${month}`)
    .set({ branchId, month, reportSentAt: new Date().toISOString() }, { merge: true });
}

/**
 * Sends the month's statement to every rentals branch that has an address on file.
 * `skipAlreadySent` is what makes the automatic monthly run safe to re-trigger: a branch whose
 * report already went out for that month is reported as skipped rather than mailed again.
 */
export async function sendMonthlyReports(params: {
  month: string;
  ownerDisplayName?: string | null;
  skipAlreadySent: boolean;
}): Promise<BranchSendOutcome[]> {
  const raw = await loadBranchAccountingRawData();
  const branches = raw.branches.filter((b) => b.branchType === "rentals" && !b.deleted && !b.notStarted);

  const [logoUrl, ownerName, recipients] = await Promise.all([
    loadReportLogoUrl(),
    getOwnerName(params.ownerDisplayName),
    loadReportRecipients(branches),
  ]);
  const recipientByBranch = new Map(recipients.map((r) => [r.branchId, r]));

  const outcomes: BranchSendOutcome[] = [];
  for (const branch of branches) {
    const recipient = recipientByBranch.get(branch.id);
    const email = recipient?.email ?? null;
    const base = { branchId: branch.id, branchName: branch.name, email };

    if (!email) {
      outcomes.push({ ...base, ok: false, message: "אין כתובת מייל מוגדרת לסניף" });
      continue;
    }

    const alreadySent = !!raw.transfersByBranchMonth.get(`${branch.id}|${params.month}`)?.reportSentAt;
    if (params.skipAlreadySent && alreadySent) {
      outcomes.push({ ...base, ok: true, message: "כבר נשלח לחודש הזה - דולג" });
      continue;
    }

    const { subject, html, inlineImages } = buildBranchReportEmail({
      branch,
      raw,
      month: params.month,
      logoUrl,
      ownerName,
    });
    const result: SendResult = await sendHtmlEmail({ to: email, subject, html, inlineImages });
    if (result.ok) await markReportSent(branch.id, params.month);
    outcomes.push({ ...base, ok: result.ok, message: result.message });
  }

  return outcomes;
}
